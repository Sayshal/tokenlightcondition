import { CONSTANTS } from '../constants.js';
import { CoreUtils } from './core.js';
import { effectQueue } from '../main.js'; // Import the effect queue

/**
 * Manages lighting calculations for tokens
 */
export class LightingManager {
/**
 * Calculate lighting for a single token WITHOUT creating effects
 * @param {Token} placedToken - The token to check
 */
static async calculateTokenLightingOnly(placedToken) {
  if (!game.user.isGM) return;
  if (!CoreUtils.isValidActor(placedToken)) return;
  if (!CoreUtils.canProcessToken(placedToken.id)) return;

  console.log('TokenLightCondition | calculateTokenLightingOnly for token:', placedToken.id);

  if (this._hasValidHp(placedToken)) {
    const lightLevel = await this.findTokenLightingOnly(placedToken);
    
    // Get current light level
    const currentLightLevel = placedToken.actor.getFlag(CONSTANTS.MODULE_ID, 'lightLevel');
    
    // If light level changed, queue the effect update
    if (currentLightLevel !== lightLevel) {
      console.log(`TokenLightCondition | Light level changed from ${currentLightLevel} to ${lightLevel}, queuing effect update`);
      
      // Safety check - ensure effectQueue is available
      if (typeof effectQueue !== 'undefined') {
        effectQueue.add(placedToken.id, lightLevel);
      } else {
        console.warn('TokenLightCondition | effectQueue not available yet');
      }
    }
  } else {
    console.log('TokenLightCondition | Token has no valid HP, queuing effect clear');
    if (typeof effectQueue !== 'undefined') {
      effectQueue.add(placedToken.id, 'clear');
    }
  }
}

  /**
   * Calculate lighting for all tokens WITHOUT creating effects
   */
  static async calculateAllTokensLightingOnly() {
    const promises = canvas.tokens.placeables.map((token) => this.calculateTokenLightingOnly(token));
    await Promise.all(promises);
  }

  /**
   * Determine the lighting condition for a token WITHOUT creating effects
   * @param {Token} selectedToken - The token to analyze
   * @returns {Promise<string>} The lighting condition ('bright', 'dim', or 'dark')
   */
  static async findTokenLightingOnly(selectedToken) {
    console.log('TokenLightCondition | Starting lighting analysis for token:', selectedToken.id);
    
    try {
      let lightLevel = 0;
      let globalIlluminationActive = false;
      const globalConfig = game.settings.get(CONSTANTS.MODULE_ID, 'globalIllumination');
      
      // Check global illumination first
      if (globalConfig) {
        const globalLight = canvas.scene.environment.globalLight.enabled;
        const darkness = canvas.scene.environment.darknessLevel;
        const globalLightThreshold = canvas.scene.environment.globalLight.darkness.max ?? 1;
        if (globalLight && globalLightThreshold && darkness <= globalLightThreshold) {
          lightLevel = 2;
          globalIlluminationActive = true;
          console.log('TokenLightCondition | Global illumination active, setting to bright light');
          
          if (this._isTokenUnderLightRestrictingTile(selectedToken)) {
            console.log('TokenLightCondition | Token under light-restricting tile, overriding to dark');
            lightLevel = 0;
            globalIlluminationActive = false;
          }
        }
      }

      // Process individual light sources if needed
      const negativeLights = game.settings.get(CONSTANTS.MODULE_ID, 'negativelights');
      if (!globalIlluminationActive || negativeLights) {
        const lightSources = [...canvas.lighting.objects.children, ...canvas.tokens.placeables];
        const sortedLights = lightSources.sort((a, b) => (b.document.light ?? b.document.config).luminosity - (a.document.light ?? a.document.config).luminosity);
        
        for (let i = 0; i < sortedLights.length; i++) {
          const lightSource = sortedLights[i];
          const isToken = Boolean(lightSource.light);
          let source = isToken ? lightSource.light : lightSource.lightSource;
          
          if (source && source.active) {
            let tokenDistance = CoreUtils.getCalculatedDistance(selectedToken, source);
            let lightDimDis = source.data.dim;
            let lightBrtDis = source.data.bright;
            const negativeLight = negativeLights && source.data.luminosity < 0;
            
            console.log(
              'TokenLightCondition | Light analysis - distance:',
              tokenDistance,
              'dim:',
              lightDimDis,
              'bright:',
              lightBrtDis,
              'negative:',
              negativeLight
            );

            if (tokenDistance <= lightDimDis || tokenDistance <= lightBrtDis) {
              let inLight = this._checkLightAngle(selectedToken, lightSource, source);
              
              if (inLight && !CoreUtils.getWallCollision(selectedToken, lightSource)) {
                if (tokenDistance <= lightDimDis && lightDimDis > 0) {
                  if (negativeLight && lightLevel > 1) {
                    lightLevel = 1;
                  } else if (!negativeLight && lightLevel < 1) {
                    lightLevel = 1;
                  }
                }
                if (tokenDistance <= lightBrtDis && lightBrtDis > 0) {
                  if (negativeLight && lightLevel > 0) {
                    lightLevel = 0;
                  } else if (!negativeLight && lightLevel < 2 && !globalIlluminationActive) {
                    lightLevel = 2;
                  }
                }
              }
            }
          }
        }
      }
      
      let lightLevelText = 'bright';
      if (lightLevel === 0) lightLevelText = 'dark';
      else if (lightLevel === 1) lightLevelText = 'dim';
      
      console.log('TokenLightCondition | Final light level for token:', lightLevelText);
      return lightLevelText;
      
    } catch (error) {
      console.error('TokenLightCondition | Error in findTokenLightingOnly:', error);
      return 'bright';
    }
  }

  /**
   * Check if token is within light angle
   * @private
   */
  static _checkLightAngle(selectedToken, lightSource, source) {
    const lightAngle = source.data.angle;
    if (lightAngle >= 360) return true;
    
    let lightRotation = source.data.rotation;
    let angle = this.getCalculatedLightAngle(selectedToken, lightSource);
    if (angle < 0) angle += 360;
    let adjustedAngle = Math.abs(angle - lightRotation);
    if (adjustedAngle > 180) adjustedAngle = 360 - adjustedAngle;
    return adjustedAngle <= lightAngle / 2;
  }

  /**
   * Show light level box in token HUD for GM
   */
  static async showLightLevelBox(selectedToken, tokenHUD, html) {
    if (!CoreUtils.isValidActor(selectedToken)) return;
    if (!this._hasValidHp(selectedToken)) return;
    const lightCondition = selectedToken.actor.getFlag(CONSTANTS.MODULE_ID, 'lightLevel') || 'bright';
    const iconClass = CONSTANTS.LIGHT_ICONS[lightCondition];
    this._createLightLevelIcon(html, iconClass, lightCondition);
  }

  /**
   * Show light level box in token HUD for players
   */
  static async showLightLevelPlayerBox(selectedToken, tokenHUD, html) {
    if (!CoreUtils.isValidActor(selectedToken)) return;
    if (!this._hasValidHp(selectedToken)) return;
    const storedResult = selectedToken.actor.getFlag(CONSTANTS.MODULE_ID, 'lightLevel');
    const lightCondition = storedResult || 'bright';
    const iconClass = CONSTANTS.LIGHT_ICONS[lightCondition];
    this._createLightLevelIcon(html, iconClass, lightCondition);
  }

  /**
   * Create light level icon element for HUD
   * @private
   */
  static _createLightLevelIcon(html, iconClass, condition) {
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
    rightPanel.appendChild(lightButton);
  }

  /**
   * Check if token has valid HP
   * @private
   */
  static _hasValidHp(token) {
    const hp = token.actor.system.attributes.hp?.value;
    return hp > 0;
  }

  /**
   * Calculate the angle between token and light source
   */
  static getCalculatedLightAngle(selectedToken, placedLights) {
    const a1 = placedLights.center.x;
    const a2 = placedLights.center.y;
    const b1 = selectedToken.center.x;
    const b2 = selectedToken.center.y;
    if (selectedToken.center == placedLights.center) return 0;
    let angle = Math.atan2(a1 - b1, b2 - a2) * (180 / Math.PI);
    return angle;
  }

  /**
   * Check if a token is underneath a tile with light restrictions
   * @private
   */
  static _isTokenUnderLightRestrictingTile(selectedToken) {
    if (!canvas.tiles?.placeables) return false;
    const tokenElevation = selectedToken.document.elevation || 0;
    const lightRestrictingTiles = canvas.tiles.placeables.filter((tile) => tile.document?.restrictions?.light === true);
    if (lightRestrictingTiles.length === 0) return false;
    
    for (const tile of lightRestrictingTiles) {
      const isTokenInTile = selectedToken.bounds.intersects(tile.bounds);
      if (isTokenInTile) {
        const tileElevation = tile.document.elevation || 0;
        if (tokenElevation < tileElevation) {
          console.log('TokenLightCondition | Token under light-restricting tile');
          return true;
        }
      }
    }
    return false;
  }
}