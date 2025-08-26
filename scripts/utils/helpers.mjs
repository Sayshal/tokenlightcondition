/**
 * Core utility functions and helpers for Token Light Condition module
 */

import { MODULE, SETTINGS, VALID_ACTOR_TYPES } from '../constants.mjs';
import { log } from '../logger.mjs';
import { EffectsManager } from './effects.mjs';
import { LightingCalculator } from './lighting.mjs';

/**
 * Core utility class providing common functionality for the module
 * Handles token validation, distance calculations, wall collision detection, and more
 */
export class TokenHelpers {
  /** @type {Map<string, number>} Circuit breaker to prevent rapid token processing */
  static processingCircuitBreaker = new Map();

  /** @type {number} Minimum time between processing the same token (milliseconds) */
  static PROCESSING_COOLDOWN = 500;

  /**
   * Check if a token can be processed (circuit breaker pattern)
   * Prevents the same token from being processed too rapidly
   * @param {string} tokenId - The token ID to check
   * @returns {boolean} True if the token can be processed
   */
  static canProcessToken(tokenId) {
    const now = Date.now();
    const lastProcessed = this.processingCircuitBreaker.get(tokenId);

    // Prevent processing the same token more than once every 500ms
    if (lastProcessed && now - lastProcessed < this.PROCESSING_COOLDOWN) {
      log(3, `Circuit breaker preventing rapid processing of token: ${tokenId}`);
      return false;
    }

    // Update the last processed time
    this.processingCircuitBreaker.set(tokenId, now);
    return true;
  }

  /**
   * Check if the Token Light Condition module is currently enabled
   * @returns {boolean} True if the module is actively processing tokens
   */
  static isModuleEnabled() {
    try {
      return game.settings.get(MODULE.ID, SETTINGS.ENABLE);
    } catch (error) {
      log(1, 'Error checking module state:', error);
      return false;
    }
  }

  /**
   * Toggle the Token Light Condition functionality on/off
   * Handles enabling/disabling the module and updating all tokens accordingly
   * @param {boolean} enabled - Whether to enable or disable the module
   */
  static async toggleModule(enabled) {
    log(3, `Toggling module to: ${enabled}`);

    try {
      // Update the setting
      await game.settings.set(MODULE.ID, SETTINGS.ENABLE, enabled);

      // Only GMs can modify token effects
      if (!game.user.isGM) return;

      if (enabled) {
        // When enabling, recalculate all token lighting
        await LightingCalculator.refreshAllTokenLighting();
      } else {
        // When disabling, clear all lighting effects
        const validTokens = canvas.tokens.placeables.filter((token) => this.isValidToken(token));
        const clearPromises = validTokens.map((token) => EffectsManager.clearEffects(token));
        await Promise.all(clearPromises);
      }
    } catch (error) {
      log(1, 'Error toggling module:', error);
    }
  }

  /**
   * Initialize a token with the module flag and perform initial lighting calculation
   * @param {Token} token - The token to initialize
   */
  static async initializeToken(token) {
    if (!game.user.isGM || !token?.actor) return;

    log(3, `Initializing token: ${token.id}`);

    try {
      // Set the module flag on the actor to mark it as initialized
      await token.actor.setFlag(MODULE.ID, 'initialized', true);

      // Perform initial lighting calculation
      LightingCalculator.calculateTokenLighting(token);
    } catch (error) {
      log(1, `Error initializing token ${token.id}:`, error);
    }
  }

  /**
   * Check if a token is valid for lighting effects processing
   * Validates actor type, existence, and initialization status
   * @param {Token} token - The token to validate
   * @returns {boolean} True if the token is valid for processing
   */
  static isValidToken(token) {
    // Basic token validation
    if (!token?.actor) {
      return false;
    }

    // Check if actor type is supported
    const isValidType = VALID_ACTOR_TYPES.includes(token.actor.type);
    if (!isValidType) {
      return false;
    }

    // Check if token has been initialized by the module
    const hasFlag = token.actor.getFlag(MODULE.ID, 'initialized');
    if (!hasFlag) {
      // Initialize the token if it hasn't been processed yet
      this.initializeToken(token);
      return false; // Return false for this call, it will be valid next time
    }

    return true;
  }

  /**
   * Check if a token has valid HP (is alive)
   * Dead tokens should not have lighting effects applied
   * @param {Token} token - The token to check
   * @returns {boolean} True if the token has valid HP
   */
  static hasValidHitPoints(token) {
    if (!token?.actor?.system?.attributes?.hp) {
      return false;
    }

    const currentHP = token.actor.system.attributes.hp.value;
    return currentHP > 0;
  }

  /**
   * Find a token by its document ID
   * @param {string} tokenId - The token document ID to search for
   * @returns {Token|undefined} The found token or undefined
   */
  static findTokenById(tokenId) {
    return canvas.tokens.placeables.find((token) => token.id === tokenId);
  }

  /**
   * Find a token by its associated actor ID
   * @param {string} actorId - The actor ID to search for
   * @returns {Token|undefined} The found token or undefined
   */
  static findTokenByActorId(actorId) {
    return canvas.tokens.placeables.find((token) => token.actor?.id === actorId);
  }

  /**
   * Find the current user's character token on the scene
   * @returns {Token|undefined} The user's character token or undefined
   */
  static findUserCharacterToken() {
    if (!game.user.character) {
      return undefined;
    }

    return canvas.tokens.placeables.find((token) => token.actor?.id === game.user.character.id);
  }

  /**
   * Find the selected token from a TokenHUD instance
   * Handles cases where multiple tokens are controlled
   * @param {TokenHUD} tokenHUD - The token HUD object
   * @returns {Token|undefined} The selected token
   */
  static findSelectedToken(tokenHUD) {
    // If only one token is controlled, return it
    if (canvas.tokens.controlled.length <= 1) {
      return canvas.tokens.controlled[0];
    }

    // Find the token that matches the HUD's token
    const tokenWithHudOpen = canvas.tokens.controlled.find((token) => token.id === tokenHUD.object.actor.token.id);

    return tokenWithHudOpen;
  }

  /**
   * Calculate 3D distance between a token and light source accounting for elevation
   * Uses grid size and distance settings to provide accurate measurements
   * @param {Token} token - The token
   * @param {LightSource|Token} lightSource - The light source object
   * @returns {number} The calculated 3D distance
   */
  static calculate3DDistance(token, lightSource) {
    // Get grid configuration for distance calculations
    const gridSize = canvas.grid.size;
    const gridDistance = canvas.scene.grid.distance;

    // Calculate token position in 3D space
    const tokenPosition = {
      x: token.center.x,
      y: token.center.y,
      z: (token.document.elevation / gridDistance) * gridSize
    };

    // Calculate light source position in 3D space
    const lightPosition = {
      x: lightSource.x,
      y: lightSource.y,
      z: (lightSource.elevation / gridDistance) * gridSize
    };

    // Calculate 3D distance using Pythagorean theorem
    const deltaX = Math.abs(tokenPosition.x - lightPosition.x);
    const deltaY = Math.abs(tokenPosition.y - lightPosition.y);
    const deltaZ = Math.abs(tokenPosition.z - lightPosition.z);

    const distance3D = Math.sqrt(deltaX ** 2 + deltaY ** 2 + deltaZ ** 2);

    log(3, `3D distance calculated: ${distance3D} (dx: ${deltaX}, dy: ${deltaY}, dz: ${deltaZ})`);

    return distance3D;
  }

  /**
   * Test for wall collision between two points using Foundry's collision detection
   * @param {Token} sourceToken - The source token
   * @param {Object} targetObject - The target object with center coordinates
   * @returns {boolean} True if there is a wall collision blocking line of sight
   */
  static hasWallCollision(sourceToken, targetObject) {
    try {
      // Use Foundry's built-in collision detection system
      const testResult = CONFIG.Canvas.polygonBackends.sight.testCollision(sourceToken.center, targetObject.center, { type: 'sight', mode: 'all' });

      // If any collisions are detected, line of sight is blocked
      const hasCollision = testResult.length > 0;

      if (hasCollision) {
        log(3, `Wall collision detected between token ${sourceToken.id} and target`);
      }

      return hasCollision;
    } catch (error) {
      log(1, 'Error testing wall collision:', error);
      return false; // Assume no collision if test fails
    }
  }

  /**
   * Check if a token is within the bounds of a drawing shape
   * Supports rectangles, ellipses, and polygon shapes with rotation
   * @param {Drawing} drawingShape - The drawing document/object
   * @param {Token} token - The token to test
   * @returns {boolean} True if the token center is within the drawing
   */
  static isTokenWithinDrawing(drawingShape, token) {
    let tokenPosition = { ...token.center };

    // Extract drawing properties
    const {
      x,
      y,
      shape: { width, height, type, points },
      rotation
    } = drawingShape;

    // Handle rotation by transforming token position
    if (rotation !== 0) {
      const drawingCenter = [x + 0.5 * width, y + 0.5 * height];
      const cos = Math.cos((-rotation * Math.PI) / 180);
      const sin = Math.sin((-rotation * Math.PI) / 180);

      // Apply inverse rotation to token position
      tokenPosition = {
        x: cos * (tokenPosition.x - drawingCenter[0]) - sin * (tokenPosition.y - drawingCenter[1]) + drawingCenter[0],
        y: sin * (tokenPosition.x - drawingCenter[0]) + cos * (tokenPosition.y - drawingCenter[1]) + drawingCenter[1]
      };
    }

    // First check if token is within bounding rectangle
    const isInBounds = Number.between(tokenPosition.x, x, x + width) && Number.between(tokenPosition.y, y, y + height);

    if (!isInBounds) return false;

    // Handle different drawing shape types
    switch (type) {
      case 'r': // Rectangle
        return true; // Already passed bounds check

      case 'e': // Ellipse
        return this._isTokenInEllipse(tokenPosition, x, y, width, height);

      case 'p': // Polygon
      case 'f': // Freehand
        return this._isTokenInPolygon(tokenPosition, points, x, y);

      default:
        log(2, `Unknown drawing shape type: ${type}`);
        return true; // Default to true for unknown types
    }
  }

  /**
   * Test if a token position is within an elliptical shape
   * @param {Object} tokenPosition - Token center coordinates {x, y}
   * @param {number} x - Ellipse left coordinate
   * @param {number} y - Ellipse top coordinate
   * @param {number} width - Ellipse width
   * @param {number} height - Ellipse height
   * @returns {boolean} True if token is within ellipse
   * @private
   */
  static _isTokenInEllipse(tokenPosition, x, y, width, height) {
    // Calculate ellipse center and radii
    const centerX = x + 0.5 * width;
    const centerY = y + 0.5 * height;
    const radiusX = 0.5 * width;
    const radiusY = 0.5 * height;

    // Use standard ellipse equation: (x-cx)²/rx² + (y-cy)²/ry² <= 1
    const normalizedX = (tokenPosition.x - centerX) / radiusX;
    const normalizedY = (tokenPosition.y - centerY) / radiusY;

    return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
  }

  /**
   * Test if a token position is within a polygon using ray casting algorithm
   * @param {Object} tokenPosition - Token center coordinates {x, y}
   * @param {number[]} points - Polygon vertex coordinates [x1, y1, x2, y2, ...]
   * @param {number} offsetX - X offset to apply to polygon points
   * @param {number} offsetY - Y offset to apply to polygon points
   * @returns {boolean} True if token is within polygon
   * @private
   */
  static _isTokenInPolygon(tokenPosition, points, offsetX, offsetY) {
    // Convert flat points array to vertex coordinate pairs
    const vertices = [];
    for (let i = 0; i < points.length; i += 2) {
      vertices.push([points[i] + offsetX, points[i + 1] + offsetY]);
    }

    // Ray casting algorithm - count intersections with polygon edges
    let isInside = false;
    const testX = tokenPosition.x;
    const testY = tokenPosition.y;

    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const [xi, yi] = vertices[i];
      const [xj, yj] = vertices[j];

      // Check if ray from test point crosses this edge
      if (yi > testY !== yj > testY && testX < ((xj - xi) * (testY - yi)) / (yj - yi) + xi) {
        isInside = !isInside;
      }
    }

    return isInside;
  }
}
