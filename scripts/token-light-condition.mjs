import { MODULE, SETTINGS } from './constants.mjs';
import { EffectsManager } from './utils/effects.mjs';
import { TokenHelpers } from './utils/helpers.mjs';
import { LightingCalculator } from './utils/lighting.mjs';

let processingUpdate = false;
let pendingRefresh = false;
let refreshTimeoutId;

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
      if (updates.length) await canvas.scene.updateEmbeddedDocuments('Token', updates);
      for (const { token, newLevel, oldLevel } of changes) Hooks.callAll(`${MODULE.ID}.lightLevelChanged`, token, newLevel, oldLevel);
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
    const newLevel = await LightingCalculator.resolveLightLevel(token, null, sources);
    if (newLevel === oldLevel) return null;
    ATLAS.log(3, `Processing effects for token ${token.id}: ${oldLevel} -> ${newLevel}`);
    try {
      await EffectsManager.syncEffects(token, newLevel);
    } catch (error) {
      ATLAS.log(1, `Error processing effects for token ${token.id}:`, error);
      return null;
    }
    return { token, newLevel, oldLevel };
  }
};

document.addEventListener('visibilitychange', () => effectQueue.scheduleProcessing());

Hooks.once('ready', async () => {
  const moduleData = game.modules.get(MODULE.ID);
  ATLAS.log(3, `Token Light Condition Ready - Version ${moduleData.version}`);
  moduleData.api = {
    determineLightLevel: (token, position) => LightingCalculator.determineLightLevel(token, position),
    getLightLevel,
    refreshAllTokenLighting: calculateAllTokensLighting
  };
  globalThis.TLC = { api: moduleData.api };
  await EffectsManager.initializeEffects();
  ui.effects?.render(true);
  ATLAS.log(3, 'Token Light Condition initialization complete');
});

Hooks.on('createToken', async (tokenDocument) => {
  if (!game.user.isGM) return;
  ATLAS.log(3, `Token created: ${tokenDocument.id}`);
  const token = tokenDocument.object;
  if (token && TokenHelpers.isValidToken(token)) setTimeout(() => LightingCalculator.calculateTokenLighting(token), 150);
});

Hooks.on('updateToken', (tokenDocument, changes) => {
  if (!game.user.isGM) return;
  ATLAS.log(3, `Token updated: ${tokenDocument.id}`, { changes: Object.keys(changes) });
  const hasHiddenChange = 'hidden' in changes;
  const lightKeys = ['light.bright', 'light.dim', 'light.luminosity', 'light.angle', 'light.rotation'];
  const hasLightChange = lightKeys.some((key) => foundry.utils.hasProperty(changes, key));
  if (hasHiddenChange) {
    const token = tokenDocument.object;
    if (token && TokenHelpers.isValidToken(token)) debounceTokenCalculation(token);
  } else if (hasLightChange) {
    ATLAS.log(3, 'Light properties changed, updating all tokens');
    debounceAllTokensCalculation();
  }
});

Hooks.on('moveToken', (tokenDocument, movement) => {
  if (!game.user.isGM) return;
  const lastWp = movement?.passed?.waypoints?.at(-1);
  if (!lastWp) return;
  const center = tokenDocument.getCenterPoint(lastWp);
  const position = { x: center.x, y: center.y, elevation: lastWp.elevation ?? tokenDocument.elevation };
  const token = tokenDocument.object;
  if (token && TokenHelpers.isValidToken(token)) debounceTokenCalculation(token, position);
});

Hooks.on('updateAmbientLight', () => {
  if (!game.user.isGM) return;
  ATLAS.log(3, 'Ambient light updated, refreshing all token lighting');
  debounceAllTokensCalculation();
});

Hooks.on('createAmbientLight', () => {
  if (!game.user.isGM) return;
  ATLAS.log(3, 'Ambient light created, refreshing all token lighting');
  debounceAllTokensCalculation();
});

Hooks.on('deleteAmbientLight', () => {
  if (!game.user.isGM) return;
  ATLAS.log(3, 'Ambient light deleted, refreshing all token lighting');
  debounceAllTokensCalculation();
});

Hooks.on('updateScene', (sceneDocument, changes) => {
  if (!game.user.isGM) return;
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
  const selectedToken = TokenHelpers.findSelectedToken(tokenHUD);
  if (!TokenHelpers.isValidToken(selectedToken)) return;
  if (game.user.isGM) LightingCalculator.showGMLightingHUD(selectedToken, tokenHUD, html);
  else LightingCalculator.showPlayerLightingHUD(selectedToken, tokenHUD, html);
});

/**
 * Debounced function for single token lighting calculation
 * @param {object} token - The token to calculate
 * @param {{x: number, y: number, elevation: number}|null} [position] - Optional resolved position; pass when called from a movement context
 */
function debounceTokenCalculation(token, position = null) {
  const delay = game.settings.get(MODULE.ID, SETTINGS.DELAY_CALCULATIONS);
  if (token._lightingTimeout) clearTimeout(token._lightingTimeout);
  if (delay > 0) token._lightingTimeout = setTimeout(() => LightingCalculator.calculateTokenLighting(token, position), delay);
  else LightingCalculator.calculateTokenLighting(token, position);
}

/**
 * Read the light level currently stored on a token
 * @param {object} token - The token placeable or TokenDocument to read
 * @returns {string|null} 'bright', 'dim', 'dark', or null when unset (never calculated, or cleared)
 */
function getLightLevel(token) {
  return (token?.document ?? token)?.getFlag(MODULE.ID, 'lightLevel') ?? null;
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
