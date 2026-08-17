import { MODULE, SETTINGS, VALID_ACTOR_TYPES } from '../constants.mjs';
import { EffectsManager } from './effects.mjs';
import { LightingCalculator } from './lighting.mjs';

/** Core utility class providing common functionality for the module */
export class TokenHelpers {
  /**
   * Check if the Token Light Condition module is currently enabled
   * @returns {boolean} True if the module is actively processing tokens
   */
  static isModuleEnabled() {
    return game.settings.get(MODULE.ID, SETTINGS.ENABLE);
  }

  /**
   * Toggle the Token Light Condition functionality on/off
   * @param {boolean} enabled - Whether to enable or disable the module
   */
  static async toggleModule(enabled) {
    ATLAS.log(3, `Toggling module to: ${enabled}`);
    try {
      await game.settings.set(MODULE.ID, SETTINGS.ENABLE, enabled);
      if (!game.user.isGM) return;
      if (enabled) {
        await LightingCalculator.refreshAllTokenLighting();
      } else {
        const validTokens = canvas.tokens.placeables.filter((token) => this.isValidToken(token));
        const clearPromises = validTokens.map((token) => EffectsManager.clearEffects(token));
        await Promise.all(clearPromises);
      }
    } catch (error) {
      ATLAS.log(1, 'Error toggling module:', error);
    }
  }

  /**
   * Initialize a token with the module flag and perform initial lighting calculation
   * @param {object} token - The token to initialize
   */
  static async initializeToken(token) {
    if (!game.user.isGM || !token?.actor) return;
    ATLAS.log(3, `Initializing token: ${token.id}`);
    try {
      await token.actor.setFlag(MODULE.ID, 'initialized', true);
      LightingCalculator.calculateTokenLighting(token);
    } catch (error) {
      ATLAS.log(1, `Error initializing token ${token.id}:`, error);
    }
  }

  /**
   * Check if a token is valid for lighting effects processing
   * @param {object} token - The token to validate
   * @returns {boolean} True if the token is valid for processing
   */
  static isValidToken(token) {
    if (!token?.actor) return false;
    const isValidType = VALID_ACTOR_TYPES.includes(token.actor.type);
    if (!isValidType) return false;
    const hasFlag = token.actor.getFlag(MODULE.ID, 'initialized');
    if (!hasFlag) {
      this.initializeToken(token);
      return false;
    }
    return true;
  }

  /**
   * Check if a token has valid HP (is alive)
   * @param {object} token - The token to check
   * @returns {boolean} True if the token has valid HP
   */
  static hasValidHitPoints(token) {
    if (!token?.actor?.system?.attributes?.hp) return false;
    const currentHP = token.actor.system.attributes.hp.value;
    return currentHP > 0;
  }

  /**
   * Find the selected token from a TokenHUD instance
   * @param {object} tokenHUD - The token HUD object
   * @returns {object|undefined} The selected token
   */
  static findSelectedToken(tokenHUD) {
    if (canvas.tokens.controlled.length <= 1) return canvas.tokens.controlled[0];
    const tokenWithHudOpen = canvas.tokens.controlled.find((token) => token.id === tokenHUD.object.actor.token.id);
    return tokenWithHudOpen;
  }
}
