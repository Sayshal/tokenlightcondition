import { CONSTANTS } from '../constants.js';
import { CoreUtils } from './core.js';
import { Effects } from './effects.js';

/**
 * Manages lighting calculations and effects for tokens
 */
export class LightingManager {
  static processingTokens = new Set();

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
    const iconClass = CONSTANTS.LIGHT_ICONS[lightCondition];
    this._createLightLevelIcon(html, iconClass, lightCondition);
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
    const lightCondition = storedResult || 'bright';
    const iconClass = CONSTANTS.LIGHT_ICONS[lightCondition];
    this._createLightLevelIcon(html, iconClass, lightCondition);
  }

  /**
   * Create light level icon element for HUD
   * @param {HTMLElement} html - The HUD HTML element
   * @param {string} iconClass - The FontAwesome icon class
   * @param {string} condition - The light condition for tooltip
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
   * @param {Token} token - The token to check
   * @returns {boolean} True if token has valid HP
   * @private
   */
  static _hasValidHp(token) {
    const hp = token.actor.system.attributes.hp?.value;
    return hp > 0;
  }

  /**
   * Check lighting for a single token
   * @param {Token} placedToken - The token to check
   */
  static async checkTokenLighting(placedToken) {
    if (!game.user.isGM) return;
    if (!CoreUtils.isValidActor(placedToken)) return;
    if (this._hasValidHp(placedToken)) await this.findTokenLighting(placedToken);
    else await Effects.clearEffects(placedToken);
  }

  /**
   * Check lighting for all tokens on the scene
   * @returns {Promise<void[]>} Array of promises for all token checks
   */
  static async checkAllTokensLightingRefresh() {
    const promises = canvas.tokens.placeables.map((token) => this.checkTokenLighting(token));
    const results = await Promise.all(promises);
    return results;
  }

  /**
   * Determine the lighting condition for a token
   * @param {Token} selectedToken - The token to analyze
   * @returns {Promise<string>} The lighting condition ('bright', 'dim', or 'dark')
   */
  static async findTokenLighting(selectedToken) {
    if (this.processingTokens.has(selectedToken.id)) {
      const cached = selectedToken.actor.getFlag(CONSTANTS.MODULE_ID, 'lightLevel') || 'bright';
      return cached;
    }
    this.processingTokens.add(selectedToken.id);
    try {
      let lightLevel = 0;
      const globalConfig = game.settings.get(CONSTANTS.MODULE_ID, 'globalIllumination');
      if (globalConfig) {
        const globalLight = canvas.scene.environment.globalLight.enabled;
        const darkness = canvas.scene.environment.darknessLevel;
        const globalLightThreshold = canvas.scene.environment.globalLight.darkness.max ?? 1;
        if (globalLight && globalLightThreshold && darkness <= globalLightThreshold) lightLevel = 2;
      }
      const negativeLights = game.settings.get(CONSTANTS.MODULE_ID, 'negativelights');
      if (lightLevel < 2 || negativeLights) {
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
              'TokenLightCondition | findTokenLighting light analysis - distance:',
              tokenDistance,
              'dim:',
              lightDimDis,
              'bright:',
              lightBrtDis,
              'negative:',
              negativeLight,
              'luminosity:',
              source.data.luminosity
            );

            if (tokenDistance <= lightDimDis || tokenDistance <= lightBrtDis) {
              let inLight = true;
              const lightAngle = source.data.angle;
              if (lightAngle < 360) {
                let lightRotation = source.data.rotation;
                let angle = this.getCalculatedLightAngle(selectedToken, lightSource);
                if (angle < 0) angle += 360;
                let adjustedAngle = Math.abs(angle - lightRotation);
                if (adjustedAngle > 180) adjustedAngle = 360 - adjustedAngle;
                if (adjustedAngle > lightAngle / 2) inLight = false;
              }

              if (inLight) {
                let foundWall = CoreUtils.getWallCollision(selectedToken, lightSource);
                if (!foundWall) {
                  if (tokenDistance <= lightDimDis && lightDimDis > 0) {
                    if (negativeLight && lightLevel > 1) lightLevel = 1;
                    else if (lightLevel < 1 && !negativeLight) lightLevel = 1;
                  }
                  if (tokenDistance <= lightBrtDis && lightBrtDis > 0) {
                    if (negativeLight && lightLevel > 0) lightLevel = 0;
                    else if (lightLevel < 2 && !negativeLight) lightLevel = 2;
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
      else lightLevelText = 'bright';
      const isPf2e = game.system.id === 'pf2e';
      const currentLightLevel = selectedToken.actor.getFlag(CONSTANTS.MODULE_ID, 'lightLevel');
      if (currentLightLevel !== lightLevelText) {
        await Effects.clearEffects(selectedToken);
        if (lightLevel === 0) await Effects.addDark(selectedToken);
        else if (lightLevel === 1) await Effects.addDim(selectedToken);
      }
      await selectedToken.actor.setFlag(CONSTANTS.MODULE_ID, 'lightLevel', lightLevelText);
      return lightLevelText;
    } finally {
      this.processingTokens.delete(selectedToken.id);
    }
  }

  /**
   * Calculate the angle between token and light source
   * @param {Token} selectedToken - The token
   * @param {Object} placedLights - The light source
   * @returns {number} The calculated angle in degrees
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
}
