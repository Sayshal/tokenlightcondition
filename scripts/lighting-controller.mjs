import { MODULE, SETTINGS } from './constants.mjs';
import { effectQueue } from './effect-queue.mjs';
import { LightingCalculator } from './lighting.mjs';
import { isValidToken } from './utils.mjs';

/** @type {boolean} Whether a full-scene refresh is currently in flight. */
let processingUpdate = false;

/** @type {boolean} Whether a refresh arrived mid-flight and still needs running. */
let pendingRefresh = false;

/** @type {number|undefined} Pending all-token refresh timer, replaced on every new request. */
let refreshTimeoutId;

/** @type {string|null} Scene the drawn-scene warning was last raised for, so it is not repeated per refresh. */
let warnedSceneId = null;

/**
 * Calculate lighting condition for a single token and queue it when the level has moved
 * @param {object} token - The Token placeable or TokenDocument to analyze
 * @param {{x: number, y: number, elevation: number}|null} [position] - Resolved center + elevation; falls back to the token's own center when null
 * @param {object[]|null} [sources] - Pre-gathered source list; gathered on demand when null
 * @returns {Promise<void>} Resolves once the token has been queued or dismissed
 */
export async function calculateTokenLighting(token, position = null, sources = null) {
  if (!ATLAS.isPrimaryGM) return;
  if (!isValidToken(token)) return;
  const tokenDocument = token.document ?? token;
  ATLAS.log(3, `Calculating lighting for token: ${tokenDocument.id}`);
  try {
    const lightLevel = await LightingCalculator.resolveLightLevel(token, position, sources);
    const currentLightLevel = tokenDocument.getFlag(MODULE.ID, 'lightLevel') ?? null;
    if (currentLightLevel === lightLevel) effectQueue.pendingOperations.delete(tokenDocument.id);
    else {
      ATLAS.log(3, `Light level changed from ${currentLightLevel} to ${lightLevel} for token ${tokenDocument.id}`);
      effectQueue.add(tokenDocument.id);
    }
  } catch (error) {
    ATLAS.log(1, `Error calculating lighting for token ${tokenDocument.id}:`, error);
  }
}

/**
 * Refresh lighting calculations for all valid tokens on the scene
 * @returns {Promise<void>} Resolves once every valid token has been queued
 */
async function refreshAllTokenLighting() {
  const activeScene = game.scenes.active;
  if (activeScene && canvas.scene !== activeScene) {
    ATLAS.log(2, `Viewing ${canvas.scene?.name}; lighting can only be computed for the drawn scene, so ${activeScene.name} is not refreshed`);
    if (warnedSceneId !== canvas.scene?.id) {
      warnedSceneId = canvas.scene?.id ?? null;
      ui.notifications.warn('TOKENLIGHTCONDITION.Warnings.SceneNotDrawn', { format: { scene: activeScene.name } });
    }
    return;
  }
  warnedSceneId = null;
  ATLAS.log(3, 'Refreshing lighting for all tokens');
  const validTokens = canvas.tokens.placeables.filter((token) => isValidToken(token));
  const sources = LightingCalculator.gatherLightSources();
  const promises = validTokens.map((token) => calculateTokenLighting(token, null, sources));
  await Promise.all(promises);
  ATLAS.log(3, `Processed ${validTokens.length} tokens against ${sources.length} sources`);
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
      await refreshAllTokenLighting();
      await effectQueue.drained;
    } while (pendingRefresh);
  } finally {
    processingUpdate = false;
  }
  return 'refreshed';
}

/**
 * Debounced function for single token lighting calculation
 * @param {object} token - The token to calculate
 * @returns {void}
 */
export function debounceTokenCalculation(token) {
  const delay = game.settings.get(MODULE.ID, SETTINGS.DELAY_CALCULATIONS);
  if (token._lightingTimeout) clearTimeout(token._lightingTimeout);
  if (delay > 0) token._lightingTimeout = setTimeout(() => calculateTokenLighting(token), delay);
  else calculateTokenLighting(token);
}

/**
 * Debounced function for all tokens lighting calculation
 * @returns {void}
 */
export function debounceAllTokensCalculation() {
  const delay = game.settings.get(MODULE.ID, SETTINGS.DELAY_CALCULATIONS);
  if (refreshTimeoutId) clearTimeout(refreshTimeoutId);
  if (delay > 0) refreshTimeoutId = setTimeout(calculateAllTokensLighting, delay);
  else calculateAllTokensLighting();
}
