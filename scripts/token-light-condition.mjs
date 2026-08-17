import { MODULE, SETTINGS } from './constants.mjs';
import { EffectsManager } from './utils/effects.mjs';
import { TokenHelpers } from './utils/helpers.mjs';
import { LightingCalculator } from './utils/lighting.mjs';

let processingUpdate = false;
let refreshTimeoutId;

/**
 * Effect processing queue system to prevent infinite loops
 */
export const effectQueue = {
  pendingOperations: new Map(),
  processingActive: false,
  MAX_OPERATION_AGE: 5000,

  /**
   * Add a token operation to the processing queue
   * @param {string} tokenId - The token ID
   * @param {string} lightLevel - The light level or 'clear' to remove effects
   */
  add(tokenId, lightLevel) {
    this.pendingOperations.set(tokenId, { lightLevel, timestamp: Date.now() });
    ATLAS.log(3, `Queued operation for token ${tokenId}: ${lightLevel}`);
    this.scheduleProcessing();
  },

  /** Schedule processing of queued operations on the next animation frame */
  scheduleProcessing() {
    if (this.processingActive) return;
    requestAnimationFrame(() => {
      this.processQueue();
    });
  },

  /** Process all queued operations in a controlled, non-recursive manner */
  async processQueue() {
    if (this.processingActive || this.pendingOperations.size === 0) return;
    this.processingActive = true;
    ATLAS.log(3, `Processing ${this.pendingOperations.size} queued operations`);
    try {
      const operations = new Map(this.pendingOperations);
      this.pendingOperations.clear();
      const now = Date.now();
      const validOperations = new Map();
      for (const [tokenId, operation] of operations) {
        if (now - operation.timestamp < this.MAX_OPERATION_AGE) validOperations.set(tokenId, operation);
        else ATLAS.log(2, `Discarding stale operation for token ${tokenId}`);
      }
      const changes = [];
      for (const [tokenId, { lightLevel }] of validOperations) {
        const token = canvas.tokens.get(tokenId);
        if (!token || !TokenHelpers.isValidToken(token)) continue;
        const oldLevel = token.actor?.getFlag(MODULE.ID, 'lightLevel') ?? null;
        const processed = await this.processTokenEffects(token, lightLevel);
        if (processed) changes.push({ token, newLevel: lightLevel === 'clear' ? null : lightLevel, oldLevel });
      }
      for (const { token, newLevel, oldLevel } of changes) Hooks.callAll(`${MODULE.ID}.lightLevelChanged`, token, newLevel, oldLevel);
    } catch (error) {
      ATLAS.log(1, 'Error processing effect queue:', error);
    } finally {
      this.processingActive = false;
      if (this.pendingOperations.size > 0) this.scheduleProcessing();
    }
  },

  /**
   * Process effects for a single token without triggering hooks
   * @param {object} token - The token to process
   * @param {string} lightLevel - The light level ('bright', 'dim', 'dark', or 'clear')
   * @returns {Promise<boolean>} True when the effects and flag were committed
   */
  async processTokenEffects(token, lightLevel) {
    try {
      ATLAS.log(3, `Processing effects for token ${token.id}: ${lightLevel}`);
      await EffectsManager.clearEffects(token);
      if (lightLevel === 'dark') await EffectsManager.addDarkEffect(token);
      else if (lightLevel === 'dim') await EffectsManager.addDimEffect(token);
      if (lightLevel !== 'clear') await token.actor.setFlag(MODULE.ID, 'lightLevel', lightLevel);
      else await token.actor.unsetFlag(MODULE.ID, 'lightLevel');
      ATLAS.log(3, `Completed effects processing for token ${token.id}`);
      return true;
    } catch (error) {
      ATLAS.log(1, `Error processing effects for token ${token.id}:`, error);
      return false;
    }
  }
};

Hooks.once('ready', async () => {
  const moduleData = game.modules.get(MODULE.ID);
  ATLAS.log(3, `Token Light Condition Ready - Version ${moduleData.version}`);
  moduleData.api = {
    determineLightLevel: (token, position) => LightingCalculator.determineLightLevel(token, position),
    getLightLevel,
    refreshAllTokenLighting: calculateAllTokensLighting
  };
  globalThis.TLC = { api: moduleData.api };
  await EffectsManager.initializeEffects();
  setTimeout(async () => {
    await initializeIntegrations();
  }, 100);
  ui.effects?.render(true);
  ATLAS.log(3, 'Token Light Condition initialization complete');
});

Hooks.on('getSceneControlButtons', (controls) => {
  TokenLightConditionModule.addSceneControls(controls);
});

Hooks.on('createToken', async (tokenDocument) => {
  if (!game.user.isGM || !TokenHelpers.isModuleEnabled()) return;
  ATLAS.log(3, `Token created: ${tokenDocument.id}`);
  const token = tokenDocument.object;
  if (token && TokenHelpers.isValidToken(token)) setTimeout(() => LightingCalculator.calculateTokenLighting(token), 150);
});

Hooks.on('updateToken', (tokenDocument, changes) => {
  if (!game.user.isGM || !TokenHelpers.isModuleEnabled()) return;
  ATLAS.log(3, `Token updated: ${tokenDocument.id}`, { changes: Object.keys(changes) });
  const hasHiddenChange = 'hidden' in changes;
  const lightKeys = ['light.bright', 'light.dim', 'light.luminosity', 'light.angle', 'light.rotation'];
  const hasLightChange = lightKeys.some((key) => foundry.utils.hasProperty(changes, key));
  if (hasHiddenChange) {
    const token = tokenDocument.object;
    if (token && TokenHelpers.isValidToken(token)) debounceTokenCalculation(token);
  } else if (hasLightChange) {
    ATLAS.log(3, 'Light properties changed, updating all tokens');
    debounceAllTokensCalculation();
  }
});

Hooks.on('moveToken', (tokenDocument, movement) => {
  if (!game.user.isGM || !TokenHelpers.isModuleEnabled()) return;
  const lastWp = movement?.passed?.waypoints?.at(-1);
  if (!lastWp) return;
  const center = tokenDocument.getCenterPoint(lastWp);
  const position = { x: center.x, y: center.y, elevation: lastWp.elevation ?? tokenDocument.elevation };
  const token = tokenDocument.object;
  if (token && TokenHelpers.isValidToken(token)) debounceTokenCalculation(token, position);
});

Hooks.on('updateAmbientLight', () => {
  if (!game.user.isGM || !TokenHelpers.isModuleEnabled()) return;
  ATLAS.log(3, 'Ambient light updated, refreshing all token lighting');
  debounceAllTokensCalculation();
});

Hooks.on('createAmbientLight', () => {
  if (!game.user.isGM || !TokenHelpers.isModuleEnabled()) return;
  ATLAS.log(3, 'Ambient light created, refreshing all token lighting');
  debounceAllTokensCalculation();
});

Hooks.on('deleteAmbientLight', () => {
  if (!game.user.isGM || !TokenHelpers.isModuleEnabled()) return;
  ATLAS.log(3, 'Ambient light deleted, refreshing all token lighting');
  debounceAllTokensCalculation();
});

Hooks.on('updateScene', (sceneDocument, changes) => {
  if (!game.user.isGM || !TokenHelpers.isModuleEnabled()) return;
  if (sceneDocument.id !== canvas.scene?.id) return;
  const lightingKeys = ['environment.darknessLevel', 'environment.globalLight'];
  const hasLightingChange = lightingKeys.some((key) => foundry.utils.hasProperty(changes, key));
  if (hasLightingChange) {
    ATLAS.log(3, 'Scene lighting changed, refreshing all token lighting');
    debounceAllTokensCalculation();
  }
});

Hooks.on('renderTokenHUD', (tokenHUD, html) => {
  const showHUD = game.settings.get(MODULE.ID, SETTINGS.SHOW_TOKEN_HUD);
  if (!showHUD || !TokenHelpers.isModuleEnabled()) return;
  const selectedToken = TokenHelpers.findSelectedToken(tokenHUD);
  if (!TokenHelpers.isValidToken(selectedToken)) return;
  if (game.user.isGM) LightingCalculator.showGMLightingHUD(selectedToken, tokenHUD, html);
  else LightingCalculator.showPlayerLightingHUD(selectedToken, tokenHUD, html);
});

/**
 * Debounced function for single token lighting calculation
 * @param {object} token - The token to calculate
 * @param {{x: number, y: number, elevation: number}|null} [position] - Optional resolved position; pass when called from a movement context
 */
function debounceTokenCalculation(token, position = null) {
  const delay = game.settings.get(MODULE.ID, SETTINGS.DELAY_CALCULATIONS);
  if (token._lightingTimeout) clearTimeout(token._lightingTimeout);
  if (delay > 0) token._lightingTimeout = setTimeout(() => LightingCalculator.calculateTokenLighting(token, position), delay);
  else LightingCalculator.calculateTokenLighting(token, position);
}

/**
 * Read the light level currently stored on a token's actor
 * @param {object} token - The token to read
 * @returns {string|null} 'bright', 'dim', 'dark', or null when unset (never calculated, or cleared)
 */
function getLightLevel(token) {
  return token.actor?.getFlag(MODULE.ID, 'lightLevel') ?? null;
}

/** Debounced function for all tokens lighting calculation */
function debounceAllTokensCalculation() {
  if (processingUpdate) return;
  const delay = game.settings.get(MODULE.ID, SETTINGS.DELAY_CALCULATIONS);
  if (refreshTimeoutId) clearTimeout(refreshTimeoutId);
  if (delay > 0) refreshTimeoutId = setTimeout(calculateAllTokensLighting, delay);
  else calculateAllTokensLighting();
}

/** Calculate lighting for all tokens with concurrency protection */
async function calculateAllTokensLighting() {
  if (processingUpdate) return;
  processingUpdate = true;
  try {
    await LightingCalculator.refreshAllTokenLighting();
  } finally {
    processingUpdate = false;
  }
}

/** Initialize third-party integrations */
async function initializeIntegrations() {
  ATLAS.log(3, 'Initializing third-party integrations');
  if (game.modules.get('chris-premades')?.active) {
    try {
      const effectInterface = game.settings.get('chris-premades', 'effectInterface');
      if (effectInterface === true) await integrateCPREffects();
    } catch {
      ATLAS.log(2, "Chris's Premades integration not available");
    }
  }
}

/** Integrate with Chris's Premades Effect Interface */
async function integrateCPREffects() {
  try {
    ATLAS.log(3, "Setting up Chris's Premades integration");
    const cprItem = game.items.find((item) => item.flags['chris-premades']?.effectInterface);
    if (!cprItem) {
      ATLAS.log(2, 'CPR Effect Interface item not found');
      return;
    }
    for (const effectType of ['dark', 'dim']) {
      const existingEffect = cprItem.effects.find((effect) => effect.flags?.[MODULE.ID]?.type === effectType);
      if (!existingEffect) {
        const { EFFECT_DATA } = await import('./constants.mjs');
        const effectData = EFFECT_DATA.getEffectData(effectType);
        if (effectData) {
          await ActiveEffect.create(effectData, { keepId: true, parent: cprItem });
          ATLAS.log(3, `Created CPR effect: ${effectType}`);
        }
      }
    }
    ATLAS.log(3, 'CPR integration completed successfully');
  } catch (error) {
    ATLAS.log(1, 'CPR integration failed:', error);
  }
}

/** Main module class for scene controls and external API */
export class TokenLightConditionModule {
  /**
   * Add scene control buttons for the lighting tools
   * @param {Array} controls - The controls array from Foundry
   */
  static addSceneControls(controls) {
    if (!game.user.isGM) return;
    try {
      const lightingControl = controls.lighting;
      if (!lightingControl?.tools) {
        ATLAS.log(2, 'Lighting controls not found, cannot add module button');
        return;
      }
      lightingControl.tools['tokenlightcontrol-enable'] = {
        name: 'tokenlightcontrol-enable',
        order: 999,
        title: 'Toggle Token Light Condition',
        icon: 'fa-solid fa-eye-low-vision',
        toggle: true,
        active: game.settings.get(MODULE.ID, SETTINGS.ENABLE),
        onChange: (_event, active) => TokenHelpers.toggleModule(active)
      };
      ATLAS.log(3, 'Scene control button added successfully');
    } catch (error) {
      ATLAS.log(1, 'Error adding scene control button:', error);
    }
  }
}

export default TokenLightConditionModule;
