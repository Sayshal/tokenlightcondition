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
}
