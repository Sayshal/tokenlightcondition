/**
 * Main module file for Token Light Condition
 * Handles hook registration, scene controls, and effect processing queue
 */

import { MODULE, SETTINGS } from './constants.mjs';
import { initializeLogger, log } from './logger.mjs';
import { EffectsManager } from './utils/effects.mjs';
import { TokenHelpers } from './utils/helpers.mjs';
import { LightingCalculator } from './utils/lighting.mjs';

/**
 * Module state tracking variables
 */
let moduleInitialized = false;
let processingUpdate = false;
let refreshTimeoutId;

/**
 * Effect processing queue system to prevent infinite loops
 * This is the core system that breaks the hook chain and prevents circular updates
 */
export const effectQueue = {
  /** @type {Map<string, Object>} Pending operations by token ID */
  pendingOperations: new Map(),

  /** @type {boolean} Whether queue processing is currently active */
  processingActive: false,

  /** @type {number} Maximum age for queued operations (milliseconds) */
  MAX_OPERATION_AGE: 5000,

  /**
   * Add a token operation to the processing queue
   * @param {string} tokenId - The token ID
   * @param {string} lightLevel - The light level or 'clear' to remove effects
   */
  add(tokenId, lightLevel) {
    this.pendingOperations.set(tokenId, {
      lightLevel,
      timestamp: Date.now()
    });

    log(3, `Queued operation for token ${tokenId}: ${lightLevel}`);
    this.scheduleProcessing();
  },

  /**
   * Schedule processing of queued operations on the next animation frame
   * This ensures we're outside the hook execution context
   */
  scheduleProcessing() {
    if (this.processingActive) return;

    // Use requestAnimationFrame to process outside hook execution
    requestAnimationFrame(() => {
      this.processQueue();
    });
  },

  /**
   * Process all queued operations in a controlled, non-recursive manner
   */
  async processQueue() {
    if (this.processingActive || this.pendingOperations.size === 0) return;

    this.processingActive = true;
    log(3, `Processing ${this.pendingOperations.size} queued operations`);

    try {
      // Create a snapshot of current operations
      const operations = new Map(this.pendingOperations);
      this.pendingOperations.clear();

      // Clean up old operations
      const now = Date.now();
      const validOperations = new Map();

      for (const [tokenId, operation] of operations) {
        if (now - operation.timestamp < this.MAX_OPERATION_AGE) {
          validOperations.set(tokenId, operation);
        } else {
          log(2, `Discarding stale operation for token ${tokenId}`);
        }
      }

      // Process each valid operation
      for (const [tokenId, { lightLevel }] of validOperations) {
        const token = canvas.tokens.get(tokenId);
        if (token && TokenHelpers.isValidToken(token)) {
          await this.processTokenEffects(token, lightLevel);
        }
      }
    } catch (error) {
      log(1, 'Error processing effect queue:', error);
    } finally {
      this.processingActive = false;

      // Schedule another round if more operations were queued during processing
      if (this.pendingOperations.size > 0) {
        this.scheduleProcessing();
      }
    }
  },

  /**
   * Process effects for a single token without triggering hooks
   * @param {Token} token - The token to process
   * @param {string} lightLevel - The light level ('bright', 'dim', 'dark', or 'clear')
   */
  async processTokenEffects(token, lightLevel) {
    try {
      log(3, `Processing effects for token ${token.id}: ${lightLevel}`);

      // Always clear existing effects first
      await EffectsManager.clearEffects(token);

      // Add new effects based on light level (skip for 'clear' or 'bright')
      if (lightLevel === 'dark') {
        await EffectsManager.addDarkEffect(token);
      } else if (lightLevel === 'dim') {
        await EffectsManager.addDimEffect(token);
      }

      // Update the token's light level flag
      if (lightLevel !== 'clear') {
        await token.actor.setFlag(MODULE.ID, 'lightLevel', lightLevel);
      } else {
        await token.actor.unsetFlag(MODULE.ID, 'lightLevel');
      }

      log(3, `Completed effects processing for token ${token.id}`);
    } catch (error) {
      log(1, `Error processing effects for token ${token.id}:`, error);
    }
  }
};

/**
 * Module initialization when the game is ready
 */
Hooks.once('ready', async () => {
  const moduleData = game.modules.get(MODULE.ID);
  log(3, `Token Light Condition Ready - Version ${moduleData.version}`);

  // Initialize logger first
  initializeLogger();

  // Mark module as initialized
  moduleInitialized = true;

  // Initialize effects system
  await EffectsManager.initializeEffects();

  // Initialize integrations after a short delay
  setTimeout(async () => {
    await initializeIntegrations();
  }, 100);

  // Refresh UI elements
  ui.effects?.render(true);

  log(3, 'Token Light Condition initialization complete');
});

/**
 * Add scene control buttons for GM users
 */
Hooks.on('getSceneControlButtons', (controls) => {
  TokenLightConditionModule.addSceneControls(controls);
});

/**
 * Handle new token creation
 * Only calculates lighting - does not directly create effects
 */
Hooks.on('createToken', async (tokenDocument, options, userId) => {
  if (!game.user.isGM || !TokenHelpers.isModuleEnabled()) return;

  log(3, `Token created: ${tokenDocument.id}`);

  const token = tokenDocument.object;
  if (token && TokenHelpers.isValidToken(token)) {
    // Delay initial calculation to ensure token is fully initialized
    setTimeout(() => {
      LightingCalculator.calculateTokenLighting(token);
    }, 150);
  }
});

/**
 * Handle token document updates
 * Responds to movement, elevation changes, and light modifications
 */
Hooks.on('updateToken', (tokenDocument, changes, options, userId) => {
  if (!game.user.isGM || !TokenHelpers.isModuleEnabled()) return;

  log(3, `Token updated: ${tokenDocument.id}`, {
    changes: Object.keys(changes),
    userId: userId
  });

  // Check for movement-related changes
  const movementKeys = ['x', 'y', 'elevation', 'hidden'];
  const hasMovement = movementKeys.some((key) => key in changes);

  // Check for lighting-related changes
  const lightKeys = ['light.bright', 'light.dim', 'light.luminosity', 'light.angle', 'light.rotation'];
  const hasLightChange = lightKeys.some((key) => foundry.utils.hasProperty(changes, key));

  if (hasMovement) {
    log(3, 'Movement detected, updating token lighting');
    const token = tokenDocument.object;
    if (token && TokenHelpers.isValidToken(token)) {
      debounceTokenCalculation(token);
    }
  } else if (hasLightChange) {
    log(3, 'Light properties changed, updating all tokens');
    debounceAllTokensCalculation();
  }
});

/**
 * Handle ambient light updates
 */
Hooks.on('updateAmbientLight', (lightDocument, changes, options, userId) => {
  if (!game.user.isGM || !TokenHelpers.isModuleEnabled()) return;
  log(3, 'Ambient light updated, refreshing all token lighting');
  debounceAllTokensCalculation();
});

/**
 * Handle ambient light creation
 */
Hooks.on('createAmbientLight', (lightDocument, options, userId) => {
  if (!game.user.isGM || !TokenHelpers.isModuleEnabled()) return;
  log(3, 'Ambient light created, refreshing all token lighting');
  debounceAllTokensCalculation();
});

/**
 * Handle ambient light deletion
 */
Hooks.on('deleteAmbientLight', (lightDocument, options, userId) => {
  if (!game.user.isGM || !TokenHelpers.isModuleEnabled()) return;
  log(3, 'Ambient light deleted, refreshing all token lighting');
  debounceAllTokensCalculation();
});

/**
 * Handle scene updates that affect lighting
 */
Hooks.on('updateScene', (sceneDocument, changes, options, userId) => {
  if (!game.user.isGM || !TokenHelpers.isModuleEnabled()) return;
  if (sceneDocument.id !== canvas.scene?.id) return;

  // Check for lighting-related scene changes
  const lightingKeys = ['environment.darknessLevel', 'environment.globalLight'];
  const hasLightingChange = lightingKeys.some((key) => foundry.utils.hasProperty(changes, key));

  if (hasLightingChange) {
    log(3, 'Scene lighting changed, refreshing all token lighting');
    debounceAllTokensCalculation();
  }
});

/**
 * Handle token HUD rendering
 * Shows lighting indicators without recalculating
 */
Hooks.on('renderTokenHUD', (tokenHUD, html, data) => {
  // Check if HUD display is enabled
  const showHUD = game.settings.get(MODULE.ID, SETTINGS.SHOW_TOKEN_HUD);
  if (!showHUD || !TokenHelpers.isModuleEnabled()) return;

  const selectedToken = TokenHelpers.findSelectedToken(tokenHUD);
  if (!TokenHelpers.isValidToken(selectedToken)) return;

  // Show appropriate HUD based on user permissions
  if (game.user.isGM) {
    LightingCalculator.showGMLightingHUD(selectedToken, tokenHUD, html);
  } else {
    LightingCalculator.showPlayerLightingHUD(selectedToken, tokenHUD, html);
  }
});

/**
 * Debounced function for single token lighting calculation
 * @param {Token} token - The token to calculate
 */
function debounceTokenCalculation(token) {
  const delay = game.settings.get(MODULE.ID, SETTINGS.DELAY_CALCULATIONS);

  // Clear any existing timeout for this token
  if (token._lightingTimeout) {
    clearTimeout(token._lightingTimeout);
  }

  if (delay > 0) {
    token._lightingTimeout = setTimeout(() => {
      LightingCalculator.calculateTokenLighting(token);
    }, delay);
  } else {
    LightingCalculator.calculateTokenLighting(token);
  }
}

/**
 * Debounced function for all tokens lighting calculation
 */
function debounceAllTokensCalculation() {
  if (processingUpdate) return;

  const delay = game.settings.get(MODULE.ID, SETTINGS.DELAY_CALCULATIONS);

  // Clear any existing timeout
  if (refreshTimeoutId) {
    clearTimeout(refreshTimeoutId);
  }

  if (delay > 0) {
    refreshTimeoutId = setTimeout(calculateAllTokensLighting, delay);
  } else {
    calculateAllTokensLighting();
  }
}

/**
 * Calculate lighting for all tokens with concurrency protection
 */
async function calculateAllTokensLighting() {
  if (processingUpdate) return;

  processingUpdate = true;
  try {
    await LightingCalculator.refreshAllTokenLighting();
  } finally {
    processingUpdate = false;
  }
}

/**
 * Initialize third-party integrations
 */
async function initializeIntegrations() {
  log(3, 'Initializing third-party integrations');

  // Chris's Premades integration
  if (game.modules.get('chris-premades')?.active) {
    try {
      const effectInterface = game.settings.get('chris-premades', 'effectInterface');
      if (effectInterface === true) {
        await integrateCPREffects();
      }
    } catch (error) {
      log(2, "Chris's Premades integration not available");
    }
  }
}

/**
 * Integrate with Chris's Premades Effect Interface
 */
async function integrateCPREffects() {
  try {
    log(3, "Setting up Chris's Premades integration");

    const cprItem = game.items.find((item) => item.flags['chris-premades']?.effectInterface);

    if (!cprItem) {
      log(2, 'CPR Effect Interface item not found');
      return;
    }

    // Create lighting effects in CPR system
    for (const effectType of ['dark', 'dim']) {
      const existingEffect = cprItem.effects.find((effect) => effect.flags?.[MODULE.ID]?.type === effectType);

      if (!existingEffect) {
        const { EFFECT_DATA } = await import('./constants.mjs');
        const effectData = EFFECT_DATA.getEffectData(effectType);

        if (effectData) {
          await ActiveEffect.create(effectData, {
            keepId: true,
            parent: cprItem
          });
          log(3, `Created CPR effect: ${effectType}`);
        }
      }
    }

    log(3, 'CPR integration completed successfully');
  } catch (error) {
    log(1, 'CPR integration failed:', error);
  }
}

/**
 * Main module class for scene controls and external API
 */
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
        log(2, 'Lighting controls not found, cannot add module button');
        return;
      }

      // Add toggle button to lighting controls
      lightingControl.tools['tokenlightcontrol-enable'] = {
        name: 'tokenlightcontrol-enable',
        order: 999,
        title: 'Toggle Token Light Condition',
        icon: 'fa-solid fa-eye-low-vision',
        toggle: true,
        active: game.settings.get(MODULE.ID, SETTINGS.ENABLE),
        onChange: (event, active) => {
          TokenHelpers.toggleModule(active);
        }
      };

      log(3, 'Scene control button added successfully');
    } catch (error) {
      log(1, 'Error adding scene control button:', error);
    }
  }

  /**
   * Get the current version of the module
   * @returns {string} The module version
   */
  static getVersion() {
    return game.modules.get(MODULE.ID)?.version || 'Unknown';
  }

  /**
   * Get module statistics for debugging
   * @returns {Object} Module statistics
   */
  static getStats() {
    return {
      version: this.getVersion(),
      initialized: moduleInitialized,
      enabled: TokenHelpers.isModuleEnabled(),
      queueSize: effectQueue.pendingOperations.size,
      processingActive: effectQueue.processingActive,
      logLevel: MODULE.LOG_LEVEL
    };
  }
}

// Export the module class for external access
export default TokenLightConditionModule;
