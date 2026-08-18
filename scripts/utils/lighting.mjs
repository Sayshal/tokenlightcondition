import { LIGHTING, MODULE, SETTINGS } from '../constants.mjs';
import { effectQueue } from '../token-light-condition.mjs';
import { TokenHelpers } from './helpers.mjs';

/**
 * A light source contributed by a consumer through the gatherLightSources hook.
 * @typedef {object} ContributedSource
 * @property {number} x - Canvas x coordinate
 * @property {number} y - Canvas y coordinate
 * @property {number} [elevation] - Elevation in scene distance units
 * @property {number} [dim] - Dim radius in scene distance units
 * @property {number} [bright] - Bright radius in scene distance units
 * @property {number} [priority] - Resolution priority against competing sources
 * @property {boolean} [darkness] - Whether the source creates darkness rather than light
 */

/** Core lighting calculation engine for determining token light conditions */
export class LightingCalculator {
  /**
   * Resolve the level a token should currently carry
   * @param {object} token - The Token placeable or TokenDocument to analyze
   * @param {{x: number, y: number, elevation: number}|null} [position] - Resolved center + elevation; falls back to the token's own center when null
   * @param {object[]|null} [sources] - Pre-gathered source list; gathered on demand when null
   * @returns {Promise<string|null>} 'bright', 'dim', 'dark', or null when the token should carry no level at all
   * @throws {Error} When the calculation itself fails; the caller leaves the stored level untouched
   */
  static async resolveLightLevel(token, position = null, sources = null) {
    if (!TokenHelpers.hasValidHitPoints(token)) return null;
    return this.determineLightLevel(token, position, sources);
  }

  /**
   * Calculate lighting condition for a single token and queue it when the level has moved
   * @param {object} token - The Token placeable or TokenDocument to analyze
   * @param {{x: number, y: number, elevation: number}|null} [position] - Resolved center + elevation; falls back to the token's own center when null
   * @param {object[]|null} [sources] - Pre-gathered source list; gathered on demand when null
   */
  static async calculateTokenLighting(token, position = null, sources = null) {
    if (!game.users.activeGM?.isSelf) return;
    if (!TokenHelpers.isValidToken(token)) return;
    const tokenDocument = token.document ?? token;
    ATLAS.log(3, `Calculating lighting for token: ${tokenDocument.id}`);
    try {
      const lightLevel = await this.resolveLightLevel(token, position, sources);
      const currentLightLevel = tokenDocument.getFlag(MODULE.ID, 'lightLevel') ?? null;
      if (currentLightLevel === lightLevel) effectQueue.pendingOperations.delete(tokenDocument.id);
      else {
        ATLAS.log(3, `Light level changed from ${currentLightLevel} to ${lightLevel} for token ${tokenDocument.id}`);
        effectQueue.add(tokenDocument.id);
      }
    } catch (error) {
      ATLAS.log(1, `Error calculating lighting for token ${tokenDocument.id}:`, error);
    }
  }

  /** Refresh lighting calculations for all valid tokens on the scene */
  static async refreshAllTokenLighting() {
    const activeScene = game.scenes.active;
    if (activeScene && canvas.scene !== activeScene) {
      ATLAS.log(2, `Viewing ${canvas.scene?.name}; lighting can only be computed for the drawn scene, so ${activeScene.name} is not refreshed`);
      return;
    }
    ATLAS.log(3, 'Refreshing lighting for all tokens');
    const validTokens = canvas.tokens.placeables.filter((token) => TokenHelpers.isValidToken(token));
    const sources = this.gatherLightSources();
    const promises = validTokens.map((token) => this.calculateTokenLighting(token, null, sources));
    await Promise.all(promises);
    ATLAS.log(3, `Processed ${validTokens.length} tokens against ${sources.length} sources`);
  }

  /**
   * Determine the lighting level for a specific token
   * @param {object} token - The Token placeable or TokenDocument to analyze
   * @param {{x: number, y: number, elevation: number}|null} [position] - Resolved token center + elevation; falls back to the token's own center when omitted
   * @param {object[]|null} [sources] - Pre-gathered source list; gathered on demand when null
   * @returns {Promise<string>} The lighting condition ('bright', 'dim', or 'dark')
   * @throws {Error} When the calculation fails; no level is fabricated for the caller to commit
   */
  static async determineLightLevel(token, position = null, sources = null) {
    const tokenDocument = token.document ?? token;
    ATLAS.log(3, `Analyzing lighting conditions for token: ${tokenDocument.id}`);
    const pos = position ?? this._committedCenter(tokenDocument);
    const resolvedSources = sources ?? this.gatherLightSources();
    const baseLevel = this._globalIlluminationLevel(pos) ?? LIGHTING.LEVELS.DARK;
    const lightLevel = this._processLightSources(resolvedSources, pos, baseLevel);
    const lightLevelText = this._convertLightLevelToText(lightLevel);
    ATLAS.log(3, `Final light level for token ${tokenDocument.id}: ${lightLevelText}`);
    return lightLevelText;
  }

  /**
   * Display the stored lighting level in the token HUD
   * @param {object} token - The Token placeable whose HUD is open
   * @param {HTMLElement} html - The HUD HTML element
   */
  static showLightingHUD(token, html) {
    if (!TokenHelpers.isValidToken(token)) return;
    if (!TokenHelpers.hasValidHitPoints(token)) return;
    const lightCondition = token.document.getFlag(MODULE.ID, 'lightLevel');
    if (!lightCondition) return;
    this._createLightingIndicator(html, LIGHTING.ICONS[lightCondition], lightCondition);
  }

  /**
   * Resolve where a token has actually moved to, ignoring the movement animation
   * @param {object} tokenDocument - The TokenDocument to locate
   * @returns {{x: number, y: number, elevation: number}} The committed center point
   * @private
   */
  static _committedCenter(tokenDocument) {
    const { x, y, elevation } = tokenDocument._source;
    return tokenDocument.getCenterPoint({ x, y, elevation });
  }

  /**
   * Gather every source that can affect a token on this scene, in resolution order.
   * @returns {object[]} Sources ordered by ascending priority, darkness after equal-priority light
   */
  static gatherLightSources() {
    const globalSource = canvas.environment.globalLightSource;
    const sources = [];
    for (const source of canvas.effects.lightSources) {
      if (source.active && source !== globalSource) sources.push(this._describeSource(source, false));
    }
    if (game.settings.get(MODULE.ID, SETTINGS.NEGATIVE_LIGHTS)) {
      for (const source of canvas.effects.darknessSources) {
        if (source.active) sources.push(this._describeSource(source, true));
      }
    }
    const contributed = [];
    Hooks.callAll(`${MODULE.ID}.gatherLightSources`, contributed, canvas.scene);
    for (const contribution of contributed) sources.push(this._describeContribution(contribution));
    return sources.sort((a, b) => a.priority - b.priority || Number(a.darkness) - Number(b.darkness));
  }

  /**
   * Describe a canvas light or darkness source in the shape the fold consumes
   * @param {object} source - A PointLightSource or PointDarknessSource
   * @param {boolean} darkness - Whether the source emits darkness
   * @returns {object} The source description
   * @private
   */
  static _describeSource(source, darkness) {
    return {
      x: source.x,
      y: source.y,
      elevation: source.elevation,
      dim: source.data.dim,
      bright: source.data.bright,
      priority: source.priority,
      darkness,
      contains: (point) => source.testPoint(point)
    };
  }

  /**
   * Describe a consumer-contributed source.
   * @param {ContributedSource} contribution - The contributed source
   * @returns {object} The source description
   * @private
   */
  static _describeContribution(contribution) {
    const distancePixels = canvas.dimensions.distancePixels;
    const elevation = contribution.elevation ?? 0;
    const dim = (contribution.dim ?? 0) * distancePixels;
    const bright = (contribution.bright ?? 0) * distancePixels;
    const radius = Math.max(dim, bright);
    return {
      x: contribution.x,
      y: contribution.y,
      elevation,
      dim,
      bright,
      priority: contribution.priority ?? 0,
      darkness: Boolean(contribution.darkness),
      contains: (point) => Math.abs(point.elevation - elevation) * distancePixels <= radius && Math.hypot(point.x - contribution.x, point.y - contribution.y) <= radius
    };
  }

  /**
   * Resolve the level the scene environment provides at a position
   * @param {{x: number, y: number, elevation: number}} position - Resolved token center + elevation
   * @returns {number|null} The light level, or null when global light does not reach the position
   * @private
   */
  static _globalIlluminationLevel(position) {
    const globalLight = canvas.scene.environment.globalLight;
    if (!globalLight.enabled) return null;
    const darkness = canvas.effects.getDarknessLevel(position);
    if (!darkness.between(globalLight.darkness.min, globalLight.darkness.max)) return null;
    if (this._lightRestrictingTileElevation(position) !== null) {
      ATLAS.log(3, 'Position is under a light-restricting tile, global illumination blocked');
      return null;
    }
    return globalLight.bright ? LIGHTING.LEVELS.BRIGHT : LIGHTING.LEVELS.DIM;
  }

  /**
   * Fold every source into a final light level
   * @param {object[]} sources - Ordered source descriptions from gatherLightSources
   * @param {{x: number, y: number, elevation: number}} position - Resolved token center + elevation
   * @param {number} baseLevel - The level the environment already provides
   * @returns {number} The final light level
   * @private
   */
  static _processLightSources(sources, position, baseLevel) {
    const tileElevation = this._lightRestrictingTileElevation(position);
    const hasDarkness = sources.some((source) => source.darkness);
    let lightLevel = baseLevel;
    for (const source of sources) {
      if (!hasDarkness && lightLevel === LIGHTING.LEVELS.BRIGHT) break;
      if (tileElevation !== null && source.elevation >= tileElevation) continue;
      if (!source.contains(position)) continue;
      const inBright = Math.hypot(position.x - source.x, position.y - source.y) <= source.bright;
      if (source.darkness) lightLevel = Math.min(lightLevel, inBright ? LIGHTING.LEVELS.DARK : LIGHTING.LEVELS.DIM);
      else lightLevel = Math.max(lightLevel, inBright ? LIGHTING.LEVELS.BRIGHT : LIGHTING.LEVELS.DIM);
    }
    return lightLevel;
  }

  /**
   * Find the lowest light-restricting tile covering a position from above
   * @param {{x: number, y: number, elevation: number}} position - Resolved token center + elevation
   * @returns {number|null} The tile's elevation, or null when no such tile covers the position
   * @private
   */
  static _lightRestrictingTileElevation(position) {
    let lowest = null;
    for (const tile of canvas.tiles?.placeables ?? []) {
      if (tile.document.restrictions?.light !== true) continue;
      const elevation = tile.document.elevation || 0;
      if (elevation <= position.elevation) continue;
      if (lowest !== null && elevation >= lowest) continue;
      const covers = tile.mesh?.containsCanvasPoint(position) ?? tile.bounds.contains(position.x, position.y);
      if (covers) lowest = elevation;
    }
    return lowest;
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
        ATLAS.log(2, `Unknown light level: ${lightLevel}, defaulting to bright`);
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
    html.querySelector('#light-level-indicator-icon')?.remove();
    const lightButton = document.createElement('button');
    lightButton.type = 'button';
    lightButton.id = 'light-level-indicator-icon';
    lightButton.className = `control-icon token-light-condition ${condition}`;
    lightButton.setAttribute('aria-label', `Light Level: ${condition.charAt(0).toUpperCase() + condition.slice(1)}`);
    lightButton.setAttribute('data-tooltip', '');
    const icon = document.createElement('i');
    icon.className = iconClass;
    lightButton.appendChild(icon);
    const rightPanel = html.querySelector('.right');
    if (rightPanel) rightPanel.appendChild(lightButton);
    else ATLAS.log(2, 'Could not find right panel in token HUD for lighting indicator');
  }
}
