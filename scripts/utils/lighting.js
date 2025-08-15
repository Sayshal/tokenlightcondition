import { CONSTANTS } from '../constants.js';
import { CoreUtils } from './core.js';
import { Effects } from './effects.js';

/**
 * Manages lighting calculations and effects for tokens
 */
export class LightingManager {
  static processingTokens = new Set();

  /**
   * Determine darkness threshold based on darkness level
   * @param {number} darknessLevel - The scene darkness level
   * @returns {string} The lighting condition ('bright', 'dim', or 'dark')
   */
  static setDarknessThreshold(darknessLevel) {
    if (darknessLevel < CONSTANTS.DARKNESS_THRESHOLDS.BRIGHT_MAX) return 'bright';
    if (darknessLevel < CONSTANTS.DARKNESS_THRESHOLDS.DIM_MAX) return 'dim';
    return 'dark';
  }

  /**
   * Convert darkness level to numeric light level
   * @param {number} darknessLevel - The scene darkness level
   * @returns {number} The light level (0=dark, 1=dim, 2=bright)
   */
  static setLightLevel(darknessLevel) {
    if (darknessLevel < CONSTANTS.DARKNESS_THRESHOLDS.BRIGHT_MAX) return CONSTANTS.LIGHT_LEVELS.BRIGHT;
    if (darknessLevel < CONSTANTS.DARKNESS_THRESHOLDS.DIM_MAX) return CONSTANTS.LIGHT_LEVELS.DIM;
    return CONSTANTS.LIGHT_LEVELS.DARK;
  }

  /**
   * Show light level box in token HUD for GM
   * @param {Token} selectedToken - The selected token
   * @param {TokenHUD} tokenHUD - The token HUD object
   * @param {HTMLElement} html - The HUD HTML element
   */
  static async showLightLevelBox(selectedToken, tokenHUD, html) {
    if (!CoreUtils.isValidActor(selectedToken)) return;
    if (!this._hasValidHp(selectedToken)) return;

    const lightCondition = await this.findTokenLighting(selectedToken);
    const boxString = CONSTANTS.LIGHT_LABELS[lightCondition];
    this._createLightLevelInput(html, boxString);
  }

  /**
   * Show light level box in token HUD for players
   * @param {Token} selectedToken - The selected token
   * @param {TokenHUD} tokenHUD - The token HUD object
   * @param {HTMLElement} html - The HUD HTML element
   */
  static async showLightLevelPlayerBox(selectedToken, tokenHUD, html) {
    if (!CoreUtils.isValidActor(selectedToken)) return;
    if (!this._hasValidHp(selectedToken)) return;

    const storedResult = selectedToken.actor.getFlag(CONSTANTS.MODULE_ID, 'lightLevel');
    const boxString = CONSTANTS.LIGHT_LABELS[storedResult] || 'BRT';
    this._createLightLevelInput(html, boxString);
  }

  /**
   * Create light level input element for HUD
   * @param {HTMLElement} html - The HUD HTML element
   * @param {string} value - The value to display
   * @private
   */
  static _createLightLevelInput(html, value) {
    const input = document.createElement('input');
    Object.assign(input, {
      disabled: true,
      id: 'lightL_scr_inp_box',
      title: 'Light Level',
      type: 'text',
      name: 'lightL_score_inp_box',
      value: value || 'BRT'
    });

    const rightPanel = html.querySelector('.right');
    rightPanel?.appendChild(input);
  }

  /**
   * Check if token has valid HP
   * @param {Token} token - The token to check
   * @returns {boolean} True if token has valid HP
   * @private
   */
  static _hasValidHp(token) {
    return token.actor.system.attributes.hp?.value > 0;
  }

  /**
   * Check lighting for a single token
   * @param {Token} placedToken - The token to check
   */
  static async checkTokenLighting(placedToken) {
    if (!game.user.isGM || !CoreUtils.isValidActor(placedToken)) return;

    if (this._hasValidHp(placedToken)) {
      await this.findTokenLighting(placedToken);
    } else {
      await Effects.clearEffects(placedToken);
    }
  }

  /**
   * Check lighting for all tokens on the scene
   * @returns {Promise<void[]>} Array of promises for all token checks
   */
  static async checkAllTokensLightingRefresh() {
    const promises = canvas.tokens.placeables.map((token) => this.checkTokenLighting(token));
    return Promise.all(promises);
  }

  /**
   * Determine the lighting condition for a token
   * @param {Token} selectedToken - The token to analyze
   * @returns {Promise<string>} The lighting condition ('bright', 'dim', or 'dark')
   */
  static async findTokenLighting(selectedToken) {
    // Prevent concurrent processing of the same token
    if (this.processingTokens.has(selectedToken.id)) {
      return selectedToken.actor.getFlag(CONSTANTS.MODULE_ID, 'lightLevel') || 'bright';
    }

    this.processingTokens.add(selectedToken.id);

    try {
      let lightLevel = this._getGlobalLightLevel();
      const negativeLights = game.settings.get(CONSTANTS.MODULE_ID, 'negativelights');

      if (lightLevel < CONSTANTS.LIGHT_LEVELS.BRIGHT || negativeLights) {
        lightLevel = await this._calculateLightSources(selectedToken, lightLevel, negativeLights);
      }

      await this._applyLightingEffects(selectedToken, lightLevel);

      const lightLevelText = this._getLightLevelText(lightLevel);
      await selectedToken.actor.setFlag(CONSTANTS.MODULE_ID, 'lightLevel', lightLevelText);

      return lightLevelText;
    } finally {
      this.processingTokens.delete(selectedToken.id);
    }
  }

  /**
   * Get global light level from scene settings
   * @returns {number} The global light level
   * @private
   */
  static _getGlobalLightLevel() {
    const globalConfig = game.settings.get(CONSTANTS.MODULE_ID, 'globalIllumination');
    if (!globalConfig) return 0;

    const { globalLight, darknessLevel } = canvas.scene.environment;
    const globalLightThreshold = globalLight.darkness.max ?? 1;

    return globalLight.enabled && darknessLevel <= globalLightThreshold ? CONSTANTS.LIGHT_LEVELS.BRIGHT : 0;
  }

  /**
   * Calculate lighting from all light sources
   * @param {Token} selectedToken - The token to check lighting for
   * @param {number} currentLightLevel - Current light level
   * @param {boolean} negativeLights - Whether to consider negative lights
   * @returns {Promise<number>} The calculated light level
   * @private
   */
  static async _calculateLightSources(selectedToken, currentLightLevel, negativeLights) {
    let lightLevel = currentLightLevel;
    const lightSources = [...canvas.lighting.objects.children, ...canvas.tokens.placeables];

    // Sort by luminosity descending to process brightest lights first
    const sortedLights = lightSources.sort((a, b) => {
      const aLum = (b.document.light ?? b.document.config)?.luminosity || 0;
      const bLum = (a.document.light ?? a.document.config)?.luminosity || 0;
      return aLum - bLum;
    });

    for (const lightSource of sortedLights) {
      const sourceData = this._getLightSourceData(lightSource);
      if (!sourceData?.active) continue;

      const distance = CoreUtils.getCalculatedDistance(selectedToken, sourceData);
      const { dim: dimDistance, bright: brightDistance } = sourceData.data;

      if (distance > Math.max(dimDistance, brightDistance)) continue;

      const isInLightAngle = this._isTokenInLightAngle(selectedToken, lightSource, sourceData);
      if (!isInLightAngle) continue;

      const hasWallCollision = CoreUtils.getWallCollision(selectedToken, lightSource);
      if (hasWallCollision) continue;

      lightLevel = this._applyLightSourceEffect(lightLevel, distance, dimDistance, brightDistance, negativeLights, sourceData.data.luminosity);

      // Early exit if we've reached maximum brightness and not handling negative lights
      if (lightLevel >= CONSTANTS.LIGHT_LEVELS.BRIGHT && !negativeLights) break;
    }

    return lightLevel;
  }

  /**
   * Get light source data from a light source object
   * @param {Object} lightSource - The light source object
   * @returns {Object|null} The light source data
   * @private
   */
  static _getLightSourceData(lightSource) {
    const isToken = Boolean(lightSource.light);
    const source = isToken ? lightSource.light : lightSource.lightSource;
    return source || null;
  }

  /**
   * Check if token is within the light source's angle
   * @param {Token} selectedToken - The token to check
   * @param {Object} lightSource - The light source object
   * @param {Object} sourceData - The light source data
   * @returns {boolean} True if token is within the light angle
   * @private
   */
  static _isTokenInLightAngle(selectedToken, lightSource, sourceData) {
    const lightAngle = sourceData.data.angle;
    if (lightAngle >= 360) return true;

    const lightRotation = sourceData.data.rotation;
    let angle = this.getCalculatedLightAngle(selectedToken, lightSource);
    if (angle < 0) angle += 360;

    let adjustedAngle = Math.abs(angle - lightRotation);
    if (adjustedAngle > 180) adjustedAngle = 360 - adjustedAngle;

    return adjustedAngle <= lightAngle / 2;
  }

  /**
   * Apply light source effect to current light level
   * @param {number} currentLevel - Current light level
   * @param {number} distance - Distance to light source
   * @param {number} dimDistance - Dim light distance
   * @param {number} brightDistance - Bright light distance
   * @param {boolean} negativeLights - Whether to consider negative lights
   * @param {number} luminosity - Light luminosity
   * @returns {number} The updated light level
   * @private
   */
  static _applyLightSourceEffect(currentLevel, distance, dimDistance, brightDistance, negativeLights, luminosity) {
    const isNegativeLight = negativeLights && luminosity < 0;

    if (distance <= dimDistance && dimDistance > 0) {
      if (isNegativeLight && currentLevel > CONSTANTS.LIGHT_LEVELS.DIM) {
        return CONSTANTS.LIGHT_LEVELS.DIM;
      } else if (!isNegativeLight && currentLevel < CONSTANTS.LIGHT_LEVELS.DIM) {
        return CONSTANTS.LIGHT_LEVELS.DIM;
      }
    }

    if (distance <= brightDistance && brightDistance > 0) {
      if (isNegativeLight && currentLevel > CONSTANTS.LIGHT_LEVELS.DARK) {
        return CONSTANTS.LIGHT_LEVELS.DARK;
      } else if (!isNegativeLight && currentLevel < CONSTANTS.LIGHT_LEVELS.BRIGHT) {
        return CONSTANTS.LIGHT_LEVELS.BRIGHT;
      }
    }

    return currentLevel;
  }

  /**
   * Apply lighting effects to token based on light level
   * @param {Token} selectedToken - The token to apply effects to
   * @param {number} lightLevel - The calculated light level
   * @private
   */
  static async _applyLightingEffects(selectedToken, lightLevel) {
    const currentLightLevel = selectedToken.actor.getFlag(CONSTANTS.MODULE_ID, 'lightLevel');
    const newLightLevel = this._getLightLevelText(lightLevel);

    if (currentLightLevel === newLightLevel) return;

    // Always clear effects first to avoid duplicates
    await Effects.clearEffects(selectedToken);

    // Then apply new effect if needed
    switch (lightLevel) {
      case CONSTANTS.LIGHT_LEVELS.DARK:
        await Effects.addDark(selectedToken);
        break;
      case CONSTANTS.LIGHT_LEVELS.DIM:
        await Effects.addDim(selectedToken);
        break;
      case CONSTANTS.LIGHT_LEVELS.BRIGHT:
        // Effects already cleared above
        break;
    }
  }

  /**
   * Convert numeric light level to text
   * @param {number} lightLevel - The numeric light level
   * @returns {string} The text representation
   * @private
   */
  static _getLightLevelText(lightLevel) {
    switch (lightLevel) {
      case CONSTANTS.LIGHT_LEVELS.DARK:
        return 'dark';
      case CONSTANTS.LIGHT_LEVELS.DIM:
        return 'dim';
      default:
        return 'bright';
    }
  }

  /**
   * Calculate the angle between token and light source
   * @param {Token} selectedToken - The token
   * @param {Object} placedLights - The light source
   * @returns {number} The calculated angle in degrees
   */
  static getCalculatedLightAngle(selectedToken, placedLights) {
    const lightCenter = placedLights.center;
    const tokenCenter = selectedToken.center;

    if (lightCenter.x === tokenCenter.x && lightCenter.y === tokenCenter.y) return 0;

    return Math.atan2(lightCenter.x - tokenCenter.x, tokenCenter.y - lightCenter.y) * (180 / Math.PI);
  }
}
