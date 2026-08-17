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
   * Find a token by its document ID
   * @param {string} tokenId - The token document ID to search for
   * @returns {object|undefined} The found token or undefined
   */
  static findTokenById(tokenId) {
    return canvas.tokens.placeables.find((token) => token.id === tokenId);
  }

  /**
   * Find a token by its associated actor ID
   * @param {string} actorId - The actor ID to search for
   * @returns {object|undefined} The found token or undefined
   */
  static findTokenByActorId(actorId) {
    return canvas.tokens.placeables.find((token) => token.actor?.id === actorId);
  }

  /**
   * Find the current user's character token on the scene
   * @returns {object|undefined} The user's character token or undefined
   */
  static findUserCharacterToken() {
    if (!game.user.character) return undefined;
    return canvas.tokens.placeables.find((token) => token.actor?.id === game.user.character.id);
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

  /**
   * Calculate 3D distance from a resolved token position to a light source.
   * @param {object} lightSource - The light source
   * @param {{x: number, y: number, elevation: number}} position - Resolved token center + elevation
   * @returns {number} Pixel distance
   */
  static calculate3DDistance(lightSource, position) {
    const gridSize = canvas.grid.size;
    const gridDistance = canvas.scene.grid.distance;
    const tokenZ = (position.elevation / gridDistance) * gridSize;
    const lightZ = (lightSource.elevation / gridDistance) * gridSize;
    const dx = position.x - lightSource.x;
    const dy = position.y - lightSource.y;
    const dz = tokenZ - lightZ;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Test for wall collision between two points using Foundry's collision detection
   * @param {object} sourceToken - The source token
   * @param {object} targetObject - The target object with center coordinates
   * @returns {boolean} True if there is a wall collision blocking line of sight
   */
  static hasWallCollision(sourceToken, targetObject) {
    try {
      const testResult = CONFIG.Canvas.polygonBackends.sight.testCollision(sourceToken.center, targetObject.center, { type: 'sight', mode: 'all' });
      const hasCollision = testResult.length > 0;
      if (hasCollision) ATLAS.log(3, `Wall collision detected between token ${sourceToken.id} and target`);
      return hasCollision;
    } catch (error) {
      ATLAS.log(1, 'Error testing wall collision:', error);
      return false;
    }
  }

  /**
   * Check if a token is within the bounds of a drawing shape
   * @param {object} drawingShape - The drawing document/object
   * @param {object} token - The token to test
   * @returns {boolean} True if the token center is within the drawing
   */
  static isTokenWithinDrawing(drawingShape, token) {
    let tokenPosition = { ...token.center };
    const {
      x,
      y,
      shape: { width, height, type, points },
      rotation
    } = drawingShape;
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
      case 'r':
        return true;
      case 'e':
        return this._isTokenInEllipse(tokenPosition, x, y, width, height);
      case 'p':
      case 'f':
        return this._isTokenInPolygon(tokenPosition, points, x, y);
      default:
        ATLAS.log(2, `Unknown drawing shape type: ${type}`);
        return true;
    }
  }

  /**
   * Test if a token position is within an elliptical shape
   * @param {object} tokenPosition - Token center coordinates {x, y}
   * @param {number} x - Ellipse left coordinate
   * @param {number} y - Ellipse top coordinate
   * @param {number} width - Ellipse width
   * @param {number} height - Ellipse height
   * @returns {boolean} True if token is within ellipse
   * @private
   */
  static _isTokenInEllipse(tokenPosition, x, y, width, height) {
    const centerX = x + 0.5 * width;
    const centerY = y + 0.5 * height;
    const radiusX = 0.5 * width;
    const radiusY = 0.5 * height;
    const normalizedX = (tokenPosition.x - centerX) / radiusX;
    const normalizedY = (tokenPosition.y - centerY) / radiusY;
    return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
  }

  /**
   * Test if a token position is within a polygon using ray casting algorithm
   * @param {object} tokenPosition - Token center coordinates {x, y}
   * @param {number[]} points - Polygon vertex coordinates [x1, y1, x2, y2, ...]
   * @param {number} offsetX - X offset to apply to polygon points
   * @param {number} offsetY - Y offset to apply to polygon points
   * @returns {boolean} True if token is within polygon
   * @private
   */
  static _isTokenInPolygon(tokenPosition, points, offsetX, offsetY) {
    const vertices = [];
    for (let i = 0; i < points.length; i += 2) vertices.push([points[i] + offsetX, points[i + 1] + offsetY]);
    let isInside = false;
    const testX = tokenPosition.x;
    const testY = tokenPosition.y;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const [xi, yi] = vertices[i];
      const [xj, yj] = vertices[j];
      if (yi > testY !== yj > testY && testX < ((xj - xi) * (testY - yi)) / (yj - yi) + xi) isInside = !isInside;
    }
    return isInside;
  }
}
