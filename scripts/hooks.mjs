import { HOOKS, MODULE, SETTINGS } from './constants.mjs';
import { EffectsManager } from './effects.mjs';
import { effectQueue } from './effect-queue.mjs';
import { calculateTokenLighting, debounceAllTokensCalculation, debounceTokenCalculation } from './lighting-controller.mjs';
import { LightingCalculator } from './lighting.mjs';
import { emitsLight, isValidToken } from './utils.mjs';

/** @type {string[]} Wall document keys that change how light reaches a token. */
const WALL_KEYS = ['c', 'ds', 'light', 'sight', 'dir', 'threshold'];

/** @type {string[]} Tile document keys that change how light reaches a token. */
const TILE_KEYS = ['restrictions.light', 'elevation', 'x', 'y', 'width', 'height'];

/** @type {number} How long an animated darkness transition is given to settle. */
const DARKNESS_SETTLE_MS = 250;

/** @type {number|undefined} Pending darkness-settle timer, cleared on canvasTearDown. */
let darknessTimeoutId;

/**
 * Collapse an animated darkness transition, which fires once per frame, into a single refresh
 * @returns {void}
 */
function onDarknessChange() {
  if (!game.users.activeGM?.isSelf) return;
  clearTimeout(darknessTimeoutId);
  darknessTimeoutId = setTimeout(() => debounceAllTokensCalculation(), DARKNESS_SETTLE_MS);
}

/**
 * Listen for darkness changes on the drawn scene and refresh every token
 * @returns {void}
 */
function onCanvasReady() {
  canvas.environment.addEventListener('darknessChange', onDarknessChange);
  if (!game.users.activeGM?.isSelf) return;
  ATLAS.log(3, `Canvas ready on ${canvas.scene?.name}, refreshing all token lighting`);
  debounceAllTokensCalculation();
}

/**
 * Drop the darkness listener and abandon anything the queue still holds for the outgoing scene
 * @returns {void}
 */
function onCanvasTearDown() {
  canvas.environment.removeEventListener('darknessChange', onDarknessChange);
  clearTimeout(darknessTimeoutId);
  effectQueue.pendingOperations.clear();
  effectQueue.resolveDrained?.();
  effectQueue.resolveDrained = null;
}

/**
 * Build the handler that refreshes every token when a placeable changes
 * @param {string} hookName - The hook the handler is registered under
 * @returns {Function} The handler for that hook
 */
function placeableRefreshHandler(hookName) {
  return () => {
    if (!game.users.activeGM?.isSelf) return;
    ATLAS.log(3, `${hookName}: refreshing all token lighting`);
    debounceAllTokensCalculation();
  };
}

/**
 * Refresh every token when a wall's light-relevant geometry changes
 * @param {object} _wallDocument - The updated WallDocument
 * @param {object} changes - The applied changes
 * @returns {void}
 */
function onUpdateWall(_wallDocument, changes) {
  if (!game.users.activeGM?.isSelf) return;
  if (!WALL_KEYS.some((key) => key in changes)) return;
  ATLAS.log(3, 'Wall changed, refreshing all token lighting');
  debounceAllTokensCalculation();
}

/**
 * Refresh every token when a tile's light-relevant geometry changes
 * @param {object} _tileDocument - The updated TileDocument
 * @param {object} changes - The applied changes
 * @returns {void}
 */
function onUpdateTile(_tileDocument, changes) {
  if (!game.users.activeGM?.isSelf) return;
  if (!TILE_KEYS.some((key) => foundry.utils.hasProperty(changes, key))) return;
  ATLAS.log(3, 'Tile changed, refreshing all token lighting');
  debounceAllTokensCalculation();
}

/**
 * Calculate a newly placed token once its placeable has been drawn
 * @param {object} tokenDocument - The created TokenDocument
 * @returns {void}
 */
function onCreateToken(tokenDocument) {
  if (!game.users.activeGM?.isSelf) return;
  ATLAS.log(3, `Token created: ${tokenDocument.id}`);
  setTimeout(() => {
    if (emitsLight(tokenDocument)) return debounceAllTokensCalculation();
    const token = tokenDocument.object;
    if (token && isValidToken(token)) calculateTokenLighting(token);
  }, 150);
}

/**
 * Recalculate whatever a token update can change about the scene's lighting
 * @param {object} tokenDocument - The updated TokenDocument
 * @param {object} changes - The applied changes
 * @returns {void}
 */
function onUpdateToken(tokenDocument, changes) {
  if (!game.users.activeGM?.isSelf) return;
  ATLAS.log(3, `Token updated: ${tokenDocument.id}`, { changes: Object.keys(changes) });
  if ('light' in changes || ('rotation' in changes && emitsLight(tokenDocument))) {
    ATLAS.log(3, 'Emitted light changed, updating all tokens');
    debounceAllTokensCalculation();
  } else if ('hidden' in changes) {
    if (emitsLight(tokenDocument)) debounceAllTokensCalculation();
    else {
      const token = tokenDocument.object;
      if (token && isValidToken(token)) debounceTokenCalculation(token);
    }
  }
}

/**
 * Recalculate a token once its movement animation has finished
 * @param {object} tokenDocument - The moved TokenDocument
 * @param {object} movement - The movement operation
 * @returns {Promise<void>} Resolves once the move has been accounted for
 */
async function onMoveToken(tokenDocument, movement) {
  if (!game.users.activeGM?.isSelf) return;
  if (!movement.passed.waypoints.length) return;
  ATLAS.log(3, `Token moved: ${tokenDocument.id}`);
  await movement.animation.ended;
  const token = tokenDocument.object;
  if (token && isValidToken(token)) debounceTokenCalculation(token);
  if (emitsLight(tokenDocument)) debounceAllTokensCalculation();
}

/**
 * Clear a deleted token's effects and account for the light it no longer emits
 * @param {object} tokenDocument - The deleted TokenDocument
 * @returns {Promise<void>} Resolves once the effects have been cleared
 */
async function onDeleteToken(tokenDocument) {
  if (!game.users.activeGM?.isSelf) return;
  ATLAS.log(3, `Token deleted: ${tokenDocument.id}`);
  effectQueue.pendingOperations.delete(tokenDocument.id);
  const actor = tokenDocument.actor;
  if (actor && !actor.isToken) {
    const survives = game.scenes.some((scene) => scene.tokens.some((token) => token.actorId === actor.id && token.id !== tokenDocument.id));
    if (!survives) await EffectsManager.clearEffects(tokenDocument);
  }
  if (emitsLight(tokenDocument)) debounceAllTokensCalculation();
}

/**
 * Recalculate an actor's tokens when its hit points move across the alive threshold
 * @param {object} actor - The updated Actor
 * @param {object} changes - The applied changes
 * @returns {void}
 */
function onUpdateActor(actor, changes) {
  if (!game.users.activeGM?.isSelf) return;
  if (!foundry.utils.hasProperty(changes, 'system.attributes.hp.value')) return;
  for (const token of actor.getActiveTokens()) {
    if (isValidToken(token)) debounceTokenCalculation(token);
  }
}

/**
 * Refresh every token when the drawn scene's environment lighting changes
 * @param {object} sceneDocument - The updated Scene
 * @param {object} changes - The applied changes
 * @returns {void}
 */
function onUpdateScene(sceneDocument, changes) {
  if (!game.users.activeGM?.isSelf) return;
  if (sceneDocument.id !== canvas.scene?.id) return;
  const lightingKeys = ['environment.darknessLevel', 'environment.globalLight'];
  const hasLightingChange = lightingKeys.some((key) => foundry.utils.hasProperty(changes, key));
  if (hasLightingChange) {
    ATLAS.log(3, 'Scene lighting changed, refreshing all token lighting');
    debounceAllTokensCalculation();
  }
}

/**
 * Add the stored light level to the token HUD
 * @param {object} tokenHUD - The TokenHUD application
 * @param {HTMLElement} html - The HUD HTML element
 * @returns {void}
 */
function onRenderTokenHUD(tokenHUD, html) {
  const showHUD = game.settings.get(MODULE.ID, SETTINGS.SHOW_TOKEN_HUD);
  if (!showHUD) return;
  LightingCalculator.showLightingHUD(tokenHUD.object, html);
}

/**
 * Announce a committed light level transition to consumers, on every client
 * @param {object} tokenDocument - The updated TokenDocument
 * @param {object} changes - The applied changes
 * @param {object} options - The update options carrying the previous levels
 * @returns {void}
 */
function onUpdateTokenLightLevel(tokenDocument, changes, options) {
  if (!(MODULE.ID in (changes.flags ?? {}))) return;
  const newLevel = tokenDocument.getFlag(MODULE.ID, 'lightLevel') ?? null;
  const oldLevel = options[MODULE.ID]?.[tokenDocument.id] ?? null;
  if (newLevel === oldLevel) return;
  Hooks.callAll(HOOKS.LIGHT_LEVEL_CHANGED, tokenDocument, newLevel, oldLevel);
}

/**
 * Create the world-level effect documents the module applies to tokens
 * @returns {Promise<void>} Resolves once the effects exist
 */
export async function onReady() {
  if (!game.users.activeGM?.isSelf) return;
  await EffectsManager.initializeEffects();
}

/**
 * Wire every runtime hook the module listens on
 * @returns {void}
 */
export function registerHooks() {
  Hooks.on('canvasReady', onCanvasReady);
  Hooks.on('canvasTearDown', onCanvasTearDown);
  Hooks.on('createAmbientLight', placeableRefreshHandler('createAmbientLight'));
  Hooks.on('updateAmbientLight', placeableRefreshHandler('updateAmbientLight'));
  Hooks.on('deleteAmbientLight', placeableRefreshHandler('deleteAmbientLight'));
  Hooks.on('createWall', placeableRefreshHandler('createWall'));
  Hooks.on('deleteWall', placeableRefreshHandler('deleteWall'));
  Hooks.on('createTile', placeableRefreshHandler('createTile'));
  Hooks.on('deleteTile', placeableRefreshHandler('deleteTile'));
  Hooks.on('updateWall', onUpdateWall);
  Hooks.on('updateTile', onUpdateTile);
  Hooks.on('createToken', onCreateToken);
  Hooks.on('updateToken', onUpdateToken);
  Hooks.on('moveToken', onMoveToken);
  Hooks.on('deleteToken', onDeleteToken);
  Hooks.on('updateActor', onUpdateActor);
  Hooks.on('updateScene', onUpdateScene);
  Hooks.on('renderTokenHUD', onRenderTokenHUD);
  Hooks.on('updateToken', onUpdateTokenLightLevel);
  document.addEventListener('visibilitychange', () => effectQueue.scheduleProcessing());
}
