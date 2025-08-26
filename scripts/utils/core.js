import { CONSTANTS } from '../constants.js';
import { Effects } from './effects.js';
import { LightingManager } from './lighting.js';

/**
 * Core utility functions for Token Light Condition module
 */
export class CoreUtils {
  static processingCircuitBreaker = new Map();

  // Add this method
  static canProcessToken(tokenId) {
    const now = Date.now();
    const lastProcessed = this.processingCircuitBreaker.get(tokenId);

    // Prevent processing the same token more than once every 500ms
    if (lastProcessed && now - lastProcessed < 500) {
      console.log('TokenLightCondition | Circuit breaker preventing rapid processing of token:', tokenId);
      return false;
    }

    this.processingCircuitBreaker.set(tokenId, now);
    return true;
  }

  /**
   * Check if the module is currently enabled
   * @returns {boolean} True if module is enabled
   */
  static checkModuleState() {
    return game.settings.get(CONSTANTS.MODULE_ID, 'enable');
  }

  /**
   * Toggle the Token Light Condition functionality
   * @param {boolean} toggled - Whether to enable or disable the module
   */
  static async toggleTokenLightCondition(toggled) {
    await game.settings.set(CONSTANTS.MODULE_ID, 'enable', toggled);
    if (!game.user.isGM) return;
    const enableSetting = game.settings.get(CONSTANTS.MODULE_ID, 'enable');
    if (enableSetting) {
      await LightingManager.checkAllTokensLightingRefresh();
    } else {
      const promises = canvas.tokens.placeables.filter((token) => this.isValidActor(token)).map((token) => Effects.clearEffects(token));
      await Promise.all(promises);
    }
  }

  /**
   * Initialize a token with the module flag
   * @param {Token} token - The token to initialize
   */
  static async initializeToken(token) {
    if (!game.user.isGM) return;
    await token.actor.setFlag(CONSTANTS.MODULE_ID);
    LightingManager.checkTokenLighting(token);
  }

  /**
   * Check if an actor/token is valid for lighting effects
   * @param {Token} selectedToken - The token to validate
   * @returns {boolean} True if the token is valid
   */
  static isValidActor(selectedToken) {
    if (!selectedToken?.actor) return false;
    const isValidType = CONSTANTS.ACTOR_TYPES.includes(selectedToken.actor.type);
    if (!isValidType) return false;
    const hasFlag = selectedToken.actor.flags[CONSTANTS.MODULE_ID];
    if (!hasFlag) this.initializeToken(selectedToken);
    return true;
  }

  /**
   * Find a token by its token ID
   * @param {string} tokenId - The token ID to search for
   * @returns {Token|undefined} The found token or undefined
   */
  static findTokenByTokenId(tokenId) {
    return canvas.tokens.placeables.find((token) => token.id === tokenId);
  }

  /**
   * Find a token by its actor ID
   * @param {string} actorId - The actor ID to search for
   * @returns {Token|undefined} The found token or undefined
   */
  static findTokenByActorId(actorId) {
    return canvas.tokens.placeables.find((token) => token.actor?.id === actorId);
  }

  /**
   * Find the current user's character token
   * @returns {Token|undefined} The user's character token or undefined
   */
  static findTokenByUserCharId() {
    if (!game.user.character) return undefined;
    return canvas.tokens.placeables.find((token) => token.actor?.id === game.user.character.id);
  }

  /**
   * Find the selected token from TokenHUD
   * @param {TokenHUD} tokenHUD - The token HUD object
   * @returns {Token} The selected token
   */
  static findSelectedToken(tokenHUD) {
    if (canvas.tokens.controlled.length <= 1) return canvas.tokens.controlled[0];
    const tokenWithHudOpen = canvas.tokens.controlled.find((token) => token.id === tokenHUD.object.actor.token.id);
    const index = canvas.tokens.controlled.indexOf(tokenWithHudOpen);
    return canvas.tokens.controlled[index];
  }

  /**
   * Calculate 3D distance between token and light source accounting for elevation
   * @param {Token} selectedToken - The token
   * @param {LightSource|Token} lightSource - The light source
   * @returns {number} The calculated distance
   */
  static getCalculatedDistance(selectedToken, lightSource) {
    const gridSize = canvas.grid.size;
    const gridDistance = canvas.scene.grid.distance;
    const token = {
      x: selectedToken.center.x,
      y: selectedToken.center.y,
      z: (selectedToken.document.elevation / gridDistance) * gridSize
    };
    const light = {
      x: lightSource.x,
      y: lightSource.y,
      z: (lightSource.elevation / gridDistance) * gridSize
    };
    const deltaX = Math.abs(token.x - light.x);
    const deltaY = Math.abs(token.y - light.y);
    const deltaZ = Math.abs(token.z - light.z);
    return Math.sqrt(deltaX ** 2 + deltaY ** 2 + deltaZ ** 2);
  }

  /**
   * Test for wall collision between token and target
   * @param {Token} selectedToken - The source token
   * @param {Object} targetObject - The target object
   * @returns {boolean} True if there's a wall collision
   */
  static getWallCollision(selectedToken, targetObject) {
    const testResult = CONFIG.Canvas.polygonBackends.sight.testCollision(selectedToken.center, targetObject.center, { type: 'sight', mode: 'all' });
    return testResult.length > 0;
  }

  /**
   * Check if a token is within a drawing shape
   * @param {Drawing} drawingShape - The drawing shape
   * @param {Token} token - The token to check
   * @returns {boolean} True if token is within the drawing
   */
  static isWithinDrawing(drawingShape, token) {
    let tokenPosition = { ...token.center };
    const {
      x,
      y,
      shape: { width, height, type, points },
      rotation
    } = drawingShape;

    // Handle rotation
    if (rotation !== 0) {
      const drawingCenter = [x + 0.5 * width, y + 0.5 * height];
      const cos = Math.cos((-rotation * Math.PI) / 180);
      const sin = Math.sin((-rotation * Math.PI) / 180);
      tokenPosition = {
        x: cos * (tokenPosition.x - drawingCenter[0]) - sin * (tokenPosition.y - drawingCenter[1]) + drawingCenter[0],
        y: sin * (tokenPosition.x - drawingCenter[0]) + cos * (tokenPosition.y - drawingCenter[1]) + drawingCenter[1]
      };
    }
    const isInBounds = Number.between(tokenPosition.x, x, x + width) && Number.between(tokenPosition.y, y, y + height);
    if (!isInBounds) return false;
    switch (type) {
      case 'r': // Rectangle
        return true;
      case 'e': // Ellipse
        const centerX = x + 0.5 * width;
        const centerY = y + 0.5 * height;
        const radiusX = 0.5 * width;
        const radiusY = 0.5 * height;
        return (tokenPosition.x - centerX) ** 2 / radiusX ** 2 + (tokenPosition.y - centerY) ** 2 / radiusY ** 2 <= 1;
      case 'p':
      case 'f': // Polygon/Freehand
        return this._isPointInPolygon(tokenPosition, points, x, y);
      default:
        return true;
    }
  }

  /**
   * Check if a point is inside a polygon using ray casting algorithm
   * @param {Object} point - The point to check
   * @param {number[]} points - The polygon points
   * @param {number} offsetX - X offset
   * @param {number} offsetY - Y offset
   * @returns {boolean} True if point is inside polygon
   * @private
   */
  static _isPointInPolygon(point, points, offsetX, offsetY) {
    const vertices = [];
    for (let i = 0; i < points.length; i += 2) {
      vertices.push([points[i] + offsetX, points[i + 1] + offsetY]);
    }
    let isInside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i][0],
        yi = vertices[i][1];
      const xj = vertices[j][0],
        yj = vertices[j][1];

      if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) isInside = !isInside;
    }
    return isInside;
  }
}
