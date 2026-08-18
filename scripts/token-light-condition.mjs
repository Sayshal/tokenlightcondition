import { MODULE, SETTINGS } from './constants.mjs';
import { EffectsManager } from './utils/effects.mjs';
import { TokenHelpers } from './utils/helpers.mjs';
import { LightingCalculator } from './utils/lighting.mjs';

let processingUpdate = false;
let pendingRefresh = false;
let refreshTimeoutId;
let darknessTimeoutId;

const WALL_KEYS = ['c', 'ds', 'light', 'sight', 'dir', 'threshold'];
const TILE_KEYS = ['restrictions.light', 'elevation', 'x', 'y', 'width', 'height'];
const DARKNESS_SETTLE_MS = 250;

/** Effect processing queue. */
export const effectQueue = {
  pendingOperations: new Set(),
  processingActive: false,
  drained: Promise.resolve(),
  resolveDrained: null,

  /**
   * Queue a token for re-derivation on the next drain
   * @param {string} tokenId - The token ID
   */
  add(tokenId) {
    if (!this.resolveDrained) this.drained = new Promise((resolve) => (this.resolveDrained = resolve));
    this.pendingOperations.add(tokenId);
    ATLAS.log(3, `Queued operation for token ${tokenId}`);
    this.scheduleProcessing();
  },

  /** Schedule processing of queued operations; a backgrounded tab runs no animation frames */
  scheduleProcessing() {
    if (this.processingActive) return;
    if (document.hidden) setTimeout(() => this.processQueue(), 0);
    else requestAnimationFrame(() => this.processQueue());
  },

  /** Re-derive, apply and commit every queued token */
  async processQueue() {
    if (this.processingActive || this.pendingOperations.size === 0) return;
    this.processingActive = true;
    ATLAS.log(3, `Processing ${this.pendingOperations.size} queued operations`);
    try {
      const tokenIds = [...this.pendingOperations];
      this.pendingOperations.clear();
      const tokens = tokenIds.map((tokenId) => canvas.tokens.get(tokenId)).filter((token) => token && TokenHelpers.isValidToken(token));
      const sources = LightingCalculator.gatherLightSources();
      const results = await Promise.all(tokens.map((token) => this.processTokenEffects(token, sources)));
      const changes = results.filter((change) => change);
      const updates = changes.map(({ token, newLevel }) =>
        newLevel === null ? { _id: token.id, [`flags.${MODULE.ID}.-=lightLevel`]: null } : { _id: token.id, [`flags.${MODULE.ID}.lightLevel`]: newLevel }
      );
      const previousLevels = Object.fromEntries(changes.map(({ token, oldLevel }) => [token.id, oldLevel]));
      if (updates.length) await canvas.scene.updateEmbeddedDocuments('Token', updates, { [MODULE.ID]: previousLevels });
    } catch (error) {
      ATLAS.log(1, 'Error processing effect queue:', error);
    } finally {
      this.processingActive = false;
      if (this.pendingOperations.size > 0) this.scheduleProcessing();
      else {
        this.resolveDrained?.();
        this.resolveDrained = null;
      }
    }
  },

  /**
   * Re-derive one token's level and apply the matching effects, without committing the flag
   * @param {object} token - The token to process
   * @param {object[]} sources - Pre-gathered source list shared across the drain
   * @returns {Promise<{token: object, newLevel: string|null, oldLevel: string|null}|null>} The transition to commit, or null when nothing changed or the effect writes failed
   */
  async processTokenEffects(token, sources) {
    const oldLevel = token.document.getFlag(MODULE.ID, 'lightLevel') ?? null;
    try {
      const newLevel = await LightingCalculator.resolveLightLevel(token, null, sources);
      if (newLevel === oldLevel) return null;
      ATLAS.log(3, `Processing effects for token ${token.id}: ${oldLevel} -> ${newLevel}`);
      await EffectsManager.syncEffects(token, newLevel);
      return { token, newLevel, oldLevel };
    } catch (error) {
      ATLAS.log(1, `Error processing effects for token ${token.id}:`, error);
      return null;
    }
  }
};

document.addEventListener('visibilitychange', () => effectQueue.scheduleProcessing());

Hooks.once('init', () => {
  const moduleData = game.modules.get(MODULE.ID);
  moduleData.api = {
    determineLightLevel: (token, position) => LightingCalculator.determineLightLevel(token, position),
    getEffectiveLightLevel,
    getLightLevel,
    recalculate: (token, position) => LightingCalculator.calculateTokenLighting(token, position),
    refreshAllTokenLighting: calculateAllTokensLighting
  };
  globalThis.TLC = { api: moduleData.api };
});

Hooks.once('ready', async () => {
  ATLAS.log(3, `Token Light Condition Ready - Version ${game.modules.get(MODULE.ID).version}`);
  if (!game.users.activeGM?.isSelf) return;
  await EffectsManager.initializeEffects();
  ATLAS.log(3, 'Token Light Condition initialization complete');
});

Hooks.on('canvasReady', () => {
  canvas.environment.addEventListener('darknessChange', onDarknessChange);
  if (!game.users.activeGM?.isSelf) return;
  ATLAS.log(3, `Canvas ready on ${canvas.scene?.name}, refreshing all token lighting`);
  debounceAllTokensCalculation();
});

Hooks.on('canvasTearDown', () => {
  canvas.environment.removeEventListener('darknessChange', onDarknessChange);
  clearTimeout(darknessTimeoutId);
  effectQueue.pendingOperations.clear();
  effectQueue.resolveDrained?.();
  effectQueue.resolveDrained = null;
});

for (const hookName of ['createAmbientLight', 'updateAmbientLight', 'deleteAmbientLight', 'createWall', 'deleteWall', 'createTile', 'deleteTile']) {
  Hooks.on(hookName, () => {
    if (!game.users.activeGM?.isSelf) return;
    ATLAS.log(3, `${hookName}: refreshing all token lighting`);
    debounceAllTokensCalculation();
  });
}

Hooks.on('updateWall', (_wallDocument, changes) => {
  if (!game.users.activeGM?.isSelf) return;
  if (!WALL_KEYS.some((key) => key in changes)) return;
  ATLAS.log(3, 'Wall changed, refreshing all token lighting');
  debounceAllTokensCalculation();
});

Hooks.on('updateTile', (_tileDocument, changes) => {
  if (!game.users.activeGM?.isSelf) return;
  if (!TILE_KEYS.some((key) => foundry.utils.hasProperty(changes, key))) return;
  ATLAS.log(3, 'Tile changed, refreshing all token lighting');
  debounceAllTokensCalculation();
});

Hooks.on('createToken', (tokenDocument) => {
  if (!game.users.activeGM?.isSelf) return;
  ATLAS.log(3, `Token created: ${tokenDocument.id}`);
  setTimeout(() => {
    if (emitsLight(tokenDocument)) return debounceAllTokensCalculation();
    const token = tokenDocument.object;
    if (token && TokenHelpers.isValidToken(token)) LightingCalculator.calculateTokenLighting(token);
  }, 150);
});

Hooks.on('updateToken', (tokenDocument, changes) => {
  if (!game.users.activeGM?.isSelf) return;
  ATLAS.log(3, `Token updated: ${tokenDocument.id}`, { changes: Object.keys(changes) });
  if ('light' in changes || ('rotation' in changes && emitsLight(tokenDocument))) {
    ATLAS.log(3, 'Emitted light changed, updating all tokens');
    debounceAllTokensCalculation();
  } else if ('hidden' in changes) {
    if (emitsLight(tokenDocument)) debounceAllTokensCalculation();
    else {
      const token = tokenDocument.object;
      if (token && TokenHelpers.isValidToken(token)) debounceTokenCalculation(token);
    }
  }
});

Hooks.on('moveToken', async (tokenDocument, movement) => {
  if (!game.users.activeGM?.isSelf) return;
  if (!movement.passed.waypoints.length) return;
  ATLAS.log(3, `Token moved: ${tokenDocument.id}`);
  await movement.animation.ended;
  const token = tokenDocument.object;
  if (token && TokenHelpers.isValidToken(token)) debounceTokenCalculation(token);
  if (emitsLight(tokenDocument)) debounceAllTokensCalculation();
});

Hooks.on('deleteToken', async (tokenDocument) => {
  if (!game.users.activeGM?.isSelf) return;
  ATLAS.log(3, `Token deleted: ${tokenDocument.id}`);
  effectQueue.pendingOperations.delete(tokenDocument.id);
  const actor = tokenDocument.actor;
  if (actor && !actor.isToken) {
    const survives = game.scenes.some((scene) => scene.tokens.some((token) => token.actorId === actor.id && token.id !== tokenDocument.id));
    if (!survives) await EffectsManager.clearEffects(tokenDocument);
  }
  if (emitsLight(tokenDocument)) debounceAllTokensCalculation();
});

Hooks.on('updateActor', (actor, changes) => {
  if (!game.users.activeGM?.isSelf) return;
  if (!foundry.utils.hasProperty(changes, 'system.attributes.hp.value')) return;
  for (const token of actor.getActiveTokens()) {
    if (TokenHelpers.isValidToken(token)) debounceTokenCalculation(token);
  }
});

Hooks.on('updateScene', (sceneDocument, changes) => {
  if (!game.users.activeGM?.isSelf) return;
  if (sceneDocument.id !== canvas.scene?.id) return;
  const lightingKeys = ['environment.darknessLevel', 'environment.globalLight'];
  const hasLightingChange = lightingKeys.some((key) => foundry.utils.hasProperty(changes, key));
  if (hasLightingChange) {
    ATLAS.log(3, 'Scene lighting changed, refreshing all token lighting');
    debounceAllTokensCalculation();
  }
});

Hooks.on('renderTokenHUD', (tokenHUD, html) => {
  const showHUD = game.settings.get(MODULE.ID, SETTINGS.SHOW_TOKEN_HUD);
  if (!showHUD) return;
  LightingCalculator.showLightingHUD(tokenHUD.object, html);
});

Hooks.on('updateToken', (tokenDocument, changes, options) => {
  if (!(MODULE.ID in (changes.flags ?? {}))) return;
  const newLevel = tokenDocument.getFlag(MODULE.ID, 'lightLevel') ?? null;
  const oldLevel = options[MODULE.ID]?.[tokenDocument.id] ?? null;
  if (newLevel === oldLevel) return;
  Hooks.callAll(`${MODULE.ID}.lightLevelChanged`, tokenDocument, newLevel, oldLevel);
});

/**
 * Whether a token contributes light to the scene
 * @param {object} tokenDocument - The TokenDocument to test
 * @returns {boolean} True when the token emits light or darkness
 */
function emitsLight(tokenDocument) {
  const light = tokenDocument.light;
  return Boolean(light?.dim || light?.bright);
}

/** Collapse an animated darkness transition, which fires once per frame, into a single refresh */
function onDarknessChange() {
  if (!game.users.activeGM?.isSelf) return;
  clearTimeout(darknessTimeoutId);
  darknessTimeoutId = setTimeout(() => debounceAllTokensCalculation(), DARKNESS_SETTLE_MS);
}

/**
 * Debounced function for single token lighting calculation
 * @param {object} token - The token to calculate
 */
function debounceTokenCalculation(token) {
  const delay = game.settings.get(MODULE.ID, SETTINGS.DELAY_CALCULATIONS);
  if (token._lightingTimeout) clearTimeout(token._lightingTimeout);
  if (delay > 0) token._lightingTimeout = setTimeout(() => LightingCalculator.calculateTokenLighting(token), delay);
  else LightingCalculator.calculateTokenLighting(token);
}

/**
 * Read the environmental light level currently stored on a token
 * @param {object} token - The Token placeable or TokenDocument to read
 * @returns {string|null} 'bright', 'dim', 'dark', or null when unset (never calculated, or cleared)
 */
function getLightLevel(token) {
  return (token?.document ?? token)?.getFlag(MODULE.ID, 'lightLevel') ?? null;
}

/**
 * Read the light level a token experiences, promoting darkness to dim when its vision mode sees unlit ground
 * @param {object} token - The Token placeable or TokenDocument to read
 * @returns {string|null} 'bright', 'dim', 'dark', or null when unset (never calculated, or cleared)
 */
function getEffectiveLightLevel(token) {
  const level = getLightLevel(token);
  if (level !== 'dark') return level;
  const sight = (token?.document ?? token)?.sight;
  const visionMode = CONFIG.Canvas.visionModes[sight?.visionMode];
  const seesUnlit = visionMode?.lighting.background.visibility === foundry.canvas.perception.VisionMode.LIGHTING_VISIBILITY.REQUIRED;
  return sight?.enabled && seesUnlit ? 'dim' : 'dark';
}

/** Debounced function for all tokens lighting calculation */
function debounceAllTokensCalculation() {
  const delay = game.settings.get(MODULE.ID, SETTINGS.DELAY_CALCULATIONS);
  if (refreshTimeoutId) clearTimeout(refreshTimeoutId);
  if (delay > 0) refreshTimeoutId = setTimeout(calculateAllTokensLighting, delay);
  else calculateAllTokensLighting();
}

/**
 * Calculate lighting for all tokens, coalescing concurrent requests, and settle once the queue has committed
 * @returns {Promise<'refreshed'|'coalesced'>} 'coalesced' when an in-flight refresh absorbed this request
 */
export async function calculateAllTokensLighting() {
  if (processingUpdate) {
    pendingRefresh = true;
    return 'coalesced';
  }
  processingUpdate = true;
  try {
    do {
      pendingRefresh = false;
      await LightingCalculator.refreshAllTokenLighting();
      await effectQueue.drained;
    } while (pendingRefresh);
  } finally {
    processingUpdate = false;
  }
  return 'refreshed';
}
