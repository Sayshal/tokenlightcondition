import { MODULE } from './constants.mjs';
import { calculateAllTokensLighting, calculateTokenLighting } from './lighting-controller.mjs';
import { LightingCalculator } from './lighting.mjs';
import { getEffectiveLightLevel, getLightLevel } from './utils.mjs';

/**
 * Publish the lighting API on the module entry and on the global namespace other 3DS modules read
 * @returns {void}
 */
export function exposeApi() {
  const api = {
    /**
     * Derive the level a token would carry at a position, without storing anything.
     * @param {object} token - The Token placeable or TokenDocument to analyze
     * @param {{x: number, y: number, elevation: number}|null} [position] - Resolved center + elevation; falls back to the token's own center
     * @returns {Promise<string>} The lighting condition ('bright', 'dim', or 'dark')
     */
    determineLightLevel: (token, position) => LightingCalculator.determineLightLevel(token, position),

    /** Read a token's stored level, promoting darkness to dim when its vision mode sees unlit ground. */
    getEffectiveLightLevel,

    /** Read the environmental light level currently stored on a token. */
    getLightLevel,

    /**
     * Recalculate one token and queue it when the level has moved.
     * @param {object} token - The Token placeable or TokenDocument to analyze
     * @param {{x: number, y: number, elevation: number}|null} [position] - Resolved center + elevation; falls back to the token's own center
     * @returns {Promise<void>} Resolves once the token has been queued or dismissed
     */
    recalculate: (token, position) => calculateTokenLighting(token, position),

    /**
     * Recalculate every token on the scene, coalescing concurrent requests.
     * @returns {Promise<'refreshed'|'coalesced'>} 'coalesced' when an in-flight refresh absorbed this request
     */
    refreshAllTokenLighting: calculateAllTokensLighting
  };
  game.modules.get(MODULE.ID).api = api;
  globalThis.TLC = { api };
}
