import { VALID_ACTOR_TYPES } from '../constants.mjs';

/** Core utility class providing common functionality for the module */
export class TokenHelpers {
  /**
   * Check if a token is valid for lighting effects processing
   * @param {object} token - The token to validate
   * @returns {boolean} True if the token is valid for processing
   */
  static isValidToken(token) {
    if (!token?.actor) return false;
    return VALID_ACTOR_TYPES.includes(token.actor.type);
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
