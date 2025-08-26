/**
 * Lighting calculation system for Token Light Condition module
 * Handles complex lighting scenarios including walls, elevation, and various light sources
 */

import { LIGHTING, MODULE, SETTINGS } from '../constants.mjs';
import { log } from '../logger.mjs';
import { TokenHelpers } from './helpers.mjs';

/**
 * Core lighting calculation engine for determining token light conditions
 * Processes ambient lights, token lights, global illumination, and environmental factors
 */
export class LightingCalculator {
  /**
   * Calculate lighting condition for a single token
   * This is the main entry point for lighting calculations
   * @param {Token} token - The token to analyze
   */
  static async calculateTokenLighting(token) {
    if (!game.user.isGM) return;
    if (!TokenHelpers.isValidToken(token)) return;
    if (!TokenHelpers.canProcessToken(token.id)) return;

    log(3, `Calculating lighting for token: ${token.id}`);

    try {
      // Check if token is alive
      if (TokenHelpers.hasValidHitPoints(token)) {
        const lightLevel = await this.determineLightLevel(token);

        // Get current light level from token flag
        const currentLightLevel = token.actor.getFlag(MODULE.ID, 'lightLevel');

        // Queue effect update if light level changed
        if (currentLightLevel !== lightLevel) {
          log(3, `Light level changed from ${currentLightLevel} to ${lightLevel} for token ${token.id}`);

          // Import effect queue dynamically to avoid circular dependencies
          const { effectQueue } = await import('../token-light-condition.mjs');
          effectQueue.add(token.id, lightLevel);
        }
      } else {
        log(3, `Token ${token.id} has no valid HP, clearing effects`);

        // Import effect queue dynamically
        const { effectQueue } = await import('../token-light-condition.mjs');
        effectQueue.add(token.id, 'clear');
      }
    } catch (error) {
      log(1, `Error calculating lighting for token ${token.id}:`, error);
    }
  }

  /**
   * Refresh lighting calculations for all valid tokens on the scene
   */
  static async refreshAllTokenLighting() {
    log(3, 'Refreshing lighting for all tokens');

    const validTokens = canvas.tokens.placeables.filter((token) => TokenHelpers.isValidToken(token));

    const promises = validTokens.map((token) => this.calculateTokenLighting(token));
    await Promise.all(promises);

    log(3, `Processed ${validTokens.length} tokens for lighting updates`);
  }

  /**
   * Determine the lighting level for a specific token
   * @param {Token} token - The token to analyze
   * @returns {Promise<string>} The lighting condition ('bright', 'dim', or 'dark')
   */
  static async determineLightLevel(token) {
    log(3, `Analyzing lighting conditions for token: ${token.id}`);

    try {
      let lightLevel = LIGHTING.LEVELS.DARK; // Start with darkest condition
      let globalIlluminationActive = false;

      // Check global illumination first
      const globalConfig = game.settings.get(MODULE.ID, SETTINGS.GLOBAL_ILLUMINATION);

      if (globalConfig) {
        globalIlluminationActive = this._checkGlobalIllumination(token);
        if (globalIlluminationActive) {
          lightLevel = LIGHTING.LEVELS.BRIGHT;
          log(3, 'Global illumination provides bright light');
        }
      }

      // Process individual light sources
      const shouldCheckIndividualLights = !globalIlluminationActive || game.settings.get(MODULE.ID, SETTINGS.NEGATIVE_LIGHTS);

      if (shouldCheckIndividualLights) {
        lightLevel = await this._processLightSources(token, lightLevel, globalIlluminationActive);
      }

      // Convert numeric level to text
      const lightLevelText = this._convertLightLevelToText(lightLevel);

      log(3, `Final light level for token ${token.id}: ${lightLevelText}`);
      return lightLevelText;
    } catch (error) {
      log(1, `Error determining light level for token ${token.id}:`, error);
      return 'bright'; // Default to bright on error
    }
  }

  /**
   * Display lighting information in the token HUD for GMs
   * @param {Token} token - The selected token
   * @param {TokenHUD} tokenHUD - The token HUD instance
   * @param {HTMLElement} html - The HUD HTML element
   */
  static async showGMLightingHUD(token, tokenHUD, html) {
    if (!TokenHelpers.isValidToken(token)) return;
    if (!TokenHelpers.hasValidHitPoints(token)) return;

    const lightCondition = token.actor.getFlag(MODULE.ID, 'lightLevel') || 'bright';
    const iconClass = LIGHTING.ICONS[lightCondition];

    this._createLightingIndicator(html, iconClass, lightCondition);
  }

  /**
   * Display lighting information in the token HUD for players
   * @param {Token} token - The selected token
   * @param {TokenHUD} tokenHUD - The token HUD instance
   * @param {HTMLElement} html - The HUD HTML element
   */
  static async showPlayerLightingHUD(token, tokenHUD, html) {
    if (!TokenHelpers.isValidToken(token)) return;
    if (!TokenHelpers.hasValidHitPoints(token)) return;

    const storedLightLevel = token.actor.getFlag(MODULE.ID, 'lightLevel');
    const lightCondition = storedLightLevel || 'bright';
    const iconClass = LIGHTING.ICONS[lightCondition];

    this._createLightingIndicator(html, iconClass, lightCondition);
  }

  /**
   * Calculate the angle between a token and a light source
   * Used for directional light calculations
   * @param {Token} token - The token
   * @param {Token|AmbientLight} lightSource - The light source
   * @returns {number} The angle in degrees
   */
  static calculateLightAngle(token, lightSource) {
    const deltaX = lightSource.center.x - token.center.x;
    const deltaY = token.center.y - lightSource.center.y;

    // Handle case where token and light are at the same position
    if (deltaX === 0 && deltaY === 0) return 0;

    let angle = Math.atan2(deltaX, deltaY) * (180 / Math.PI);

    // Normalize angle to 0-360 degrees
    if (angle < 0) angle += 360;

    return angle;
  }

  /**
   * Check if global illumination should provide bright light for a token
   * @param {Token} token - The token to check
   * @returns {boolean} True if global illumination provides bright light
   * @private
   */
  static _checkGlobalIllumination(token) {
    const globalLight = canvas.scene.environment.globalLight.enabled;
    const darkness = canvas.scene.environment.darknessLevel;
    const globalLightThreshold = canvas.scene.environment.globalLight.darkness.max ?? 1;

    // Global light is active if enabled and darkness is below threshold
    if (globalLight && globalLightThreshold && darkness <= globalLightThreshold) {
      // Check if token is under a light-restricting tile
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
   * @param {Token} token - The token to analyze
   * @param {number} currentLightLevel - The current light level
   * @param {boolean} globalIlluminationActive - Whether global illumination is active
   * @returns {Promise<number>} The final light level
   * @private
   */
  static async _processLightSources(token, currentLightLevel, globalIlluminationActive) {
    let lightLevel = currentLightLevel;

    // Get all potential light sources (ambient lights and token lights)
    const lightSources = [...canvas.lighting.objects.children, ...canvas.tokens.placeables];

    // Sort by luminosity (brightest first) for processing priority
    const sortedLights = lightSources.sort((a, b) => {
      const aLuminosity = (a.document.light ?? a.document.config)?.luminosity ?? 0;
      const bLuminosity = (b.document.light ?? b.document.config)?.luminosity ?? 0;
      return bLuminosity - aLuminosity;
    });

    const supportNegativeLights = game.settings.get(MODULE.ID, SETTINGS.NEGATIVE_LIGHTS);

    // Process each light source
    for (const lightSource of sortedLights) {
      lightLevel = await this._processIndividualLight(token, lightSource, lightLevel, globalIlluminationActive, supportNegativeLights);
    }

    return lightLevel;
  }

  /**
   * Process an individual light source's effect on a token
   * @param {Token} token - The target token
   * @param {Token|AmbientLight} lightSource - The light source
   * @param {number} currentLightLevel - Current light level
   * @param {boolean} globalIlluminationActive - Whether global illumination is active
   * @param {boolean} supportNegativeLights - Whether negative lights are supported
   * @returns {Promise<number>} Updated light level
   * @private
   */
  static async _processIndividualLight(token, lightSource, currentLightLevel, globalIlluminationActive, supportNegativeLights) {
    // Determine if this is a token light or ambient light
    const isTokenLight = Boolean(lightSource.light);
    const source = isTokenLight ? lightSource.light : lightSource.lightSource;

    // Skip inactive light sources
    if (!source?.active) return currentLightLevel;

    // Calculate distance to light source
    const tokenDistance = TokenHelpers.calculate3DDistance(token, source);
    const dimRadius = source.data.dim;
    const brightRadius = source.data.bright;
    const isNegativeLight = supportNegativeLights && source.data.luminosity < 0;

    log(3, `Light analysis - distance: ${tokenDistance}, dim: ${dimRadius}, bright: ${brightRadius}, negative: ${isNegativeLight}`);

    // Check if token is within light range
    if (tokenDistance > Math.max(dimRadius, brightRadius)) {
      return currentLightLevel; // Too far from light source
    }

    // Check if token is within light angle (for directional lights)
    if (!this._isTokenInLightAngle(token, lightSource, source)) {
      return currentLightLevel; // Outside light cone
    }

    // Check for wall collisions blocking the light
    if (TokenHelpers.hasWallCollision(token, lightSource)) {
      return currentLightLevel; // Light blocked by walls
    }

    // Apply light effects based on distance and type
    let newLightLevel = currentLightLevel;

    // Apply dim light effect
    if (tokenDistance <= dimRadius && dimRadius > 0) {
      if (isNegativeLight && currentLightLevel > LIGHTING.LEVELS.DIM) {
        newLightLevel = LIGHTING.LEVELS.DIM; // Negative light reduces to dim
      } else if (!isNegativeLight && currentLightLevel < LIGHTING.LEVELS.DIM) {
        newLightLevel = LIGHTING.LEVELS.DIM; // Positive light increases to dim
      }
    }

    // Apply bright light effect
    if (tokenDistance <= brightRadius && brightRadius > 0) {
      if (isNegativeLight && currentLightLevel > LIGHTING.LEVELS.DARK) {
        newLightLevel = LIGHTING.LEVELS.DARK; // Negative light reduces to dark
      } else if (!isNegativeLight && currentLightLevel < LIGHTING.LEVELS.BRIGHT && !globalIlluminationActive) {
        newLightLevel = LIGHTING.LEVELS.BRIGHT; // Positive light increases to bright
      }
    }

    return newLightLevel;
  }

  /**
   * Check if a token is within the angle of a directional light source
   * @param {Token} token - The token to check
   * @param {Token|AmbientLight} lightSource - The light source
   * @param {LightSource} source - The actual light source data
   * @returns {boolean} True if token is within light angle
   * @private
   */
  static _isTokenInLightAngle(token, lightSource, source) {
    const lightAngle = source.data.angle;

    // 360-degree lights affect everything
    if (lightAngle >= 360) return true;

    const lightRotation = source.data.rotation;
    const tokenAngle = this.calculateLightAngle(token, lightSource);

    // Calculate the difference between token angle and light rotation
    let angleDifference = Math.abs(tokenAngle - lightRotation);

    // Handle angle wrapping (e.g., 350° vs 10°)
    if (angleDifference > 180) {
      angleDifference = 360 - angleDifference;
    }

    // Token is within light cone if angle difference is less than half the light angle
    const isWithinCone = angleDifference <= lightAngle / 2;

    if (!isWithinCone) {
      log(3, `Token outside light cone - angle difference: ${angleDifference}, cone half-angle: ${lightAngle / 2}`);
    }

    return isWithinCone;
  }

  /**
   * Check if a token is underneath a tile with light restrictions
   * @param {Token} token - The token to check
   * @returns {boolean} True if token is under a light-restricting tile
   * @private
   */
  static _isTokenUnderLightRestrictingTile(token) {
    // Early exit if no tiles are present
    if (!canvas.tiles?.placeables) return false;

    const tokenElevation = token.document.elevation || 0;

    // Find tiles with light restrictions
    const lightRestrictingTiles = canvas.tiles.placeables.filter((tile) => tile.document?.restrictions?.light === true);

    if (lightRestrictingTiles.length === 0) return false;

    // Check each light-restricting tile
    for (const tile of lightRestrictingTiles) {
      const isTokenInTile = token.bounds.intersects(tile.bounds);

      if (isTokenInTile) {
        const tileElevation = tile.document.elevation || 0;

        // Token is blocked if it's below the tile elevation
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
    // Remove any existing indicator
    const existingIcon = html.querySelector('#light-level-indicator-icon');
    if (existingIcon) {
      existingIcon.remove();
    }

    // Create new lighting indicator button
    const lightButton = document.createElement('button');
    lightButton.type = 'button';
    lightButton.id = 'light-level-indicator-icon';
    lightButton.className = `control-icon token-light-condition ${condition}`;
    lightButton.setAttribute('data-tooltip', `Light Level: ${condition.charAt(0).toUpperCase() + condition.slice(1)}`);
    lightButton.disabled = true;

    // Create and add icon
    const icon = document.createElement('i');
    icon.className = iconClass;
    lightButton.appendChild(icon);

    // Add to right panel of token HUD
    const rightPanel = html.querySelector('.right');
    if (rightPanel) {
      rightPanel.appendChild(lightButton);
    } else {
      log(2, 'Could not find right panel in token HUD for lighting indicator');
    }
  }
}
