import { LIGHTING, MODULE, SETTINGS } from '../constants.mjs';
import { log } from '../logger.mjs';
import { TokenHelpers } from './helpers.mjs';

/** Core lighting calculation engine for determining token light conditions */
export class LightingCalculator {
  /**
   * Calculate lighting condition for a single token
   * @param {object} token - The token to analyze
   * @param {{x: number, y: number, elevation: number}|null} [position] - Resolved center + elevation; falls back to token.center when null (movement callers must pass this because tokenDocument.x/y are stale at moveToken fire time)
   */
  static async calculateTokenLighting(token, position = null) {
    if (!game.user.isGM) return;
    if (!TokenHelpers.isValidToken(token)) return;
    log(3, `Calculating lighting for token: ${token.id}`);
    const pos = position ?? { x: token.center.x, y: token.center.y, elevation: token.document.elevation };
    try {
      if (TokenHelpers.hasValidHitPoints(token)) {
        const lightLevel = await this.determineLightLevel(token, pos);
        const currentLightLevel = token.actor.getFlag(MODULE.ID, 'lightLevel');
        if (currentLightLevel !== lightLevel) {
          log(3, `Light level changed from ${currentLightLevel} to ${lightLevel} for token ${token.id}`);
          const { effectQueue } = await import('../token-light-condition.mjs');
          effectQueue.add(token.id, lightLevel);
        }
      } else {
        log(3, `Token ${token.id} has no valid HP, clearing effects`);
        const { effectQueue } = await import('../token-light-condition.mjs');
        effectQueue.add(token.id, 'clear');
      }
    } catch (error) {
      log(1, `Error calculating lighting for token ${token.id}:`, error);
    }
  }

  /** Refresh lighting calculations for all valid tokens on the scene */
  static async refreshAllTokenLighting() {
    log(3, 'Refreshing lighting for all tokens');
    const validTokens = canvas.tokens.placeables.filter((token) => TokenHelpers.isValidToken(token));
    const promises = validTokens.map((token) => this.calculateTokenLighting(token));
    await Promise.all(promises);
    log(3, `Processed ${validTokens.length} tokens for lighting updates`);
  }

  /**
   * Determine the lighting level for a specific token
   * @param {object} token - The token to analyze
   * @param {{x: number, y: number, elevation: number}} position - Resolved token center + elevation
   * @returns {Promise<string>} The lighting condition ('bright', 'dim', or 'dark')
   */
  static async determineLightLevel(token, position) {
    log(3, `Analyzing lighting conditions for token: ${token.id}`);
    try {
      let lightLevel = LIGHTING.LEVELS.DARK;
      let globalIlluminationActive = false;
      const globalConfig = game.settings.get(MODULE.ID, SETTINGS.GLOBAL_ILLUMINATION);
      if (globalConfig) {
        globalIlluminationActive = this._checkGlobalIllumination(token);
        if (globalIlluminationActive) {
          lightLevel = LIGHTING.LEVELS.BRIGHT;
          log(3, 'Global illumination provides bright light');
        }
      }
      const shouldCheckIndividualLights = !globalIlluminationActive || game.settings.get(MODULE.ID, SETTINGS.NEGATIVE_LIGHTS);
      if (shouldCheckIndividualLights) lightLevel = await this._processLightSources(token, lightLevel, globalIlluminationActive, position);
      const lightLevelText = this._convertLightLevelToText(lightLevel);
      log(3, `Final light level for token ${token.id}: ${lightLevelText}`);
      return lightLevelText;
    } catch (error) {
      log(1, `Error determining light level for token ${token.id}:`, error);
      return 'bright';
    }
  }

  /**
   * Display lighting information in the token HUD for GMs
   * @param {object} token - The selected token
   * @param {object} _tokenHUD - The token HUD instance (unused)
   * @param {HTMLElement} html - The HUD HTML element
   */
  static async showGMLightingHUD(token, _tokenHUD, html) {
    if (!TokenHelpers.isValidToken(token)) return;
    if (!TokenHelpers.hasValidHitPoints(token)) return;
    const lightCondition = token.actor.getFlag(MODULE.ID, 'lightLevel') || 'bright';
    const iconClass = LIGHTING.ICONS[lightCondition];
    this._createLightingIndicator(html, iconClass, lightCondition);
  }

  /**
   * Display lighting information in the token HUD for players
   * @param {object} token - The selected token
   * @param {object} _tokenHUD - The token HUD instance (unused)
   * @param {HTMLElement} html - The HUD HTML element
   */
  static async showPlayerLightingHUD(token, _tokenHUD, html) {
    if (!TokenHelpers.isValidToken(token)) return;
    if (!TokenHelpers.hasValidHitPoints(token)) return;
    const storedLightLevel = token.actor.getFlag(MODULE.ID, 'lightLevel');
    const lightCondition = storedLightLevel || 'bright';
    const iconClass = LIGHTING.ICONS[lightCondition];
    this._createLightingIndicator(html, iconClass, lightCondition);
  }

  /**
   * Calculate the angle between a token and a light source
   * @param {object} token - The token
   * @param {object} lightSource - The light source
   * @returns {number} The angle in degrees
   */
  static calculateLightAngle(token, lightSource) {
    const deltaX = lightSource.center.x - token.center.x;
    const deltaY = token.center.y - lightSource.center.y;
    if (deltaX === 0 && deltaY === 0) return 0;
    let angle = Math.atan2(deltaX, deltaY) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    return angle;
  }

  /**
   * Check if global illumination should provide bright light for a token
   * @param {object} token - The token to check
   * @returns {boolean} True if global illumination provides bright light
   * @private
   */
  static _checkGlobalIllumination(token) {
    const globalLight = canvas.scene.environment.globalLight.enabled;
    const darkness = canvas.scene.environment.darknessLevel;
    const globalLightThreshold = canvas.scene.environment.globalLight.darkness.max ?? 1;
    if (globalLight && globalLightThreshold && darkness <= globalLightThreshold) {
      if (this._isTokenUnderLightRestrictingTile(token)) {
        log(3, `Token ${token.id} under light-restricting tile, global illumination blocked`);
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Process all light sources to determine their effect on a token
   * @param {object} token - The token to analyze
   * @param {number} currentLightLevel - The current light level
   * @param {boolean} globalIlluminationActive - Whether global illumination is active
   * @param {{x: number, y: number, elevation: number}} position - Resolved token center + elevation
   * @returns {Promise<number>} The final light level
   * @private
   */
  static async _processLightSources(token, currentLightLevel, globalIlluminationActive, position) {
    let lightLevel = currentLightLevel;
    const lightSources = [...canvas.lighting.objects.children, ...canvas.tokens.placeables];
    const sortedLights = lightSources.sort((a, b) => {
      const aLuminosity = (a.document.light ?? a.document.config)?.luminosity ?? 0;
      const bLuminosity = (b.document.light ?? b.document.config)?.luminosity ?? 0;
      return bLuminosity - aLuminosity;
    });
    const supportNegativeLights = game.settings.get(MODULE.ID, SETTINGS.NEGATIVE_LIGHTS);
    for (const lightSource of sortedLights) lightLevel = await this._processIndividualLight(token, lightSource, lightLevel, globalIlluminationActive, supportNegativeLights, position);
    return lightLevel;
  }

  /**
   * Process an individual light source's effect on a token
   * @param {object} token - The target token
   * @param {object} lightSource - The light source
   * @param {number} currentLightLevel - Current light level
   * @param {boolean} globalIlluminationActive - Whether global illumination is active
   * @param {boolean} supportNegativeLights - Whether negative lights are supported
   * @param {{x: number, y: number, elevation: number}} position - Resolved token center + elevation
   * @returns {Promise<number>} Updated light level
   * @private
   */
  static async _processIndividualLight(token, lightSource, currentLightLevel, globalIlluminationActive, supportNegativeLights, position) {
    const isTokenLight = Boolean(lightSource.light);
    const source = isTokenLight ? lightSource.light : lightSource.lightSource;
    if (!source?.active) return currentLightLevel;
    const tokenDistance = TokenHelpers.calculate3DDistance(source, position);
    const dimRadius = source.data.dim;
    const brightRadius = source.data.bright;
    const isNegativeLight = supportNegativeLights && source.data.luminosity < 0;
    log(3, `Light analysis - distance: ${tokenDistance}, dim: ${dimRadius}, bright: ${brightRadius}, negative: ${isNegativeLight}`);
    if (tokenDistance > Math.max(dimRadius, brightRadius)) return currentLightLevel;
    if (!this._isTokenInLightAngle(token, lightSource, source)) return currentLightLevel;
    if (TokenHelpers.hasWallCollision(token, lightSource)) return currentLightLevel;
    let newLightLevel = currentLightLevel;
    if (tokenDistance <= dimRadius && dimRadius > 0) {
      if (isNegativeLight && currentLightLevel > LIGHTING.LEVELS.DIM) newLightLevel = LIGHTING.LEVELS.DIM;
      else if (!isNegativeLight && currentLightLevel < LIGHTING.LEVELS.DIM) newLightLevel = LIGHTING.LEVELS.DIM;
    }
    if (tokenDistance <= brightRadius && brightRadius > 0) {
      if (isNegativeLight && currentLightLevel > LIGHTING.LEVELS.DARK) newLightLevel = LIGHTING.LEVELS.DARK;
      else if (!isNegativeLight && currentLightLevel < LIGHTING.LEVELS.BRIGHT && !globalIlluminationActive) newLightLevel = LIGHTING.LEVELS.BRIGHT;
    }
    return newLightLevel;
  }

  /**
   * Check if a token is within the angle of a directional light source
   * @param {object} token - The token to check
   * @param {object} lightSource - The light source
   * @param {object} source - The actual light source data
   * @returns {boolean} True if token is within light angle
   * @private
   */
  static _isTokenInLightAngle(token, lightSource, source) {
    const lightAngle = source.data.angle;
    if (lightAngle >= 360) return true;
    const lightRotation = source.data.rotation;
    const tokenAngle = this.calculateLightAngle(token, lightSource);
    let angleDifference = Math.abs(tokenAngle - lightRotation);
    if (angleDifference > 180) angleDifference = 360 - angleDifference;
    const isWithinCone = angleDifference <= lightAngle / 2;
    if (!isWithinCone) log(3, `Token outside light cone - angle difference: ${angleDifference}, cone half-angle: ${lightAngle / 2}`);
    return isWithinCone;
  }

  /**
   * Check if a token is underneath a tile with light restrictions
   * @param {object} token - The token to check
   * @returns {boolean} True if token is under a light-restricting tile
   * @private
   */
  static _isTokenUnderLightRestrictingTile(token) {
    if (!canvas.tiles?.placeables) return false;
    const tokenElevation = token.document.elevation || 0;
    const lightRestrictingTiles = canvas.tiles.placeables.filter((tile) => tile.document?.restrictions?.light === true);
    if (lightRestrictingTiles.length === 0) return false;
    for (const tile of lightRestrictingTiles) {
      const isTokenInTile = token.bounds.intersects(tile.bounds);
      if (isTokenInTile) {
        const tileElevation = tile.document.elevation || 0;
        if (tokenElevation < tileElevation) {
          log(3, `Token ${token.id} blocked by light-restricting tile at elevation ${tileElevation}`);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Convert numeric light level to text representation
   * @param {number} lightLevel - The numeric light level
   * @returns {string} The text representation ('bright', 'dim', or 'dark')
   * @private
   */
  static _convertLightLevelToText(lightLevel) {
    switch (lightLevel) {
      case LIGHTING.LEVELS.DARK:
        return 'dark';
      case LIGHTING.LEVELS.DIM:
        return 'dim';
      case LIGHTING.LEVELS.BRIGHT:
        return 'bright';
      default:
        log(2, `Unknown light level: ${lightLevel}, defaulting to bright`);
        return 'bright';
    }
  }

  /**
   * Create a lighting indicator element in the token HUD
   * @param {HTMLElement} html - The HUD HTML element
   * @param {string} iconClass - The CSS class for the icon
   * @param {string} condition - The lighting condition text
   * @private
   */
  static _createLightingIndicator(html, iconClass, condition) {
    const existingIcon = html.querySelector('#light-level-indicator-icon');
    if (existingIcon) existingIcon.remove();
    const lightButton = document.createElement('button');
    lightButton.type = 'button';
    lightButton.id = 'light-level-indicator-icon';
    lightButton.className = `control-icon token-light-condition ${condition}`;
    lightButton.setAttribute('data-tooltip', `Light Level: ${condition.charAt(0).toUpperCase() + condition.slice(1)}`);
    lightButton.disabled = true;
    const icon = document.createElement('i');
    icon.className = iconClass;
    lightButton.appendChild(icon);
    const rightPanel = html.querySelector('.right');
    if (rightPanel) rightPanel.appendChild(lightButton);
    else log(2, 'Could not find right panel in token HUD for lighting indicator');
  }
}
