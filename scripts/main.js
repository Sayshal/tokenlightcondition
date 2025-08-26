import { CONSTANTS } from './constants.js';
import { CoreUtils } from './utils/core.js';
import { Effects } from './utils/effects.js';
import { LightingManager } from './utils/lighting.js';

/**
 * Module state tracking
 */
let moduleState = false;
let processingUpdate = false;

/**
 * Effect processing queue - this is the key to breaking the infinite loop
 */
const effectQueue = {
  pendingOperations: new Map(), // tokenId -> { lightLevel, timestamp }
  processingActive: false,
  
  /**
   * Add a token to the processing queue
   */
  add(tokenId, lightLevel) {
    this.pendingOperations.set(tokenId, { 
      lightLevel, 
      timestamp: Date.now() 
    });
    this.scheduleProcess();
  },
  
  /**
   * Schedule processing of queued operations
   */
  scheduleProcess() {
    if (this.processingActive) return;
    
    // Use requestAnimationFrame to process on next frame, outside hook execution
    requestAnimationFrame(() => {
      this.processQueue();
    });
  },
  
  /**
   * Process all queued operations in a controlled manner
   */
  async processQueue() {
    if (this.processingActive || this.pendingOperations.size === 0) return;
    
    this.processingActive = true;
    console.log(`TokenLightCondition | Processing ${this.pendingOperations.size} queued operations`);
    
    try {
      // Create a snapshot of operations to process
      const operations = new Map(this.pendingOperations);
      this.pendingOperations.clear();
      
      // Process each token's effects
      for (const [tokenId, { lightLevel }] of operations) {
        const token = canvas.tokens.get(tokenId);
        if (token && CoreUtils.isValidActor(token)) {
          await this.processTokenEffects(token, lightLevel);
        }
      }
    } catch (error) {
      console.error('TokenLightCondition | Error processing effect queue:', error);
    } finally {
      this.processingActive = false;
      
      // If more operations were queued while processing, schedule another round
      if (this.pendingOperations.size > 0) {
        this.scheduleProcess();
      }
    }
  },
  
  /**
   * Process effects for a single token without triggering hooks
   */
  async processTokenEffects(token, lightLevel) {
    try {
      console.log(`TokenLightCondition | Processing effects for token ${token.id}: ${lightLevel}`);
      
      // Clear existing effects first
      await Effects.clearEffectsSilent(token);
      
      // Add new effects based on light level
      if (lightLevel === 'dark') {
        await Effects.addDarkSilent(token);
      } else if (lightLevel === 'dim') {
        await Effects.addDimSilent(token);
      }
      
      // Update the flag to reflect the current state
      await token.actor.setFlag(CONSTANTS.MODULE_ID, 'lightLevel', lightLevel);
      
      console.log(`TokenLightCondition | Completed effects for token ${token.id}`);
    } catch (error) {
      console.error(`TokenLightCondition | Error processing effects for token ${token.id}:`, error);
    }
  }
};

/**
 * Module ready hook
 */
Hooks.once('ready', async () => {
  const module = game.modules.get(CONSTANTS.MODULE_ID);
  console.log(`TokenLightCondition | Ready ${module.version}`);
  moduleState = true;
  
  // Wait a tick to ensure all settings are registered
  await new Promise(resolve => setTimeout(resolve, 0));
  
  // Initialize integrations
  if (game.modules.get('chris-premades')?.active && game.settings.get('chris-premades', 'effectInterface') === true) {
    await _integrateCPREffects();
  }
  
  // Initialize effects after ensuring settings are available
  await Effects.initializeEffects();
  
  ui.effects?.render(true);
});

/**
 * Add scene control buttons
 */
Hooks.on('getSceneControlButtons', (controls) => {
  TokenLightCondition.getSceneControlButtons(controls);
});

/**
 * Handle token creation - ONLY calculate lighting, don't create effects
 */
Hooks.on('createToken', async (tokenDocument, options, userId) => {
  if (!game.user.isGM || !CoreUtils.checkModuleState()) return;
  
  console.log('TokenLightCondition | createToken hook fired:', tokenDocument.id);
  
  const token = tokenDocument.object;
  if (token && CoreUtils.isValidActor(token)) {
    // Schedule lighting check after a brief delay to ensure token is fully initialized
    setTimeout(() => {
      LightingManager.calculateTokenLightingOnly(token);
    }, 100);
  }
});

/**
 * Handle token updates - ONLY for movement and light changes
 */
Hooks.on('updateToken', (tokenDocument, changes, options, userId) => {
  if (!game.user.isGM || !CoreUtils.checkModuleState()) return;
  
  console.log('TokenLightCondition | updateToken hook fired', {
    tokenId: tokenDocument.id,
    changes: Object.keys(changes),
    userId
  });

  // Only process for actual movement or light changes
  const movementKeys = ['x', 'y', 'elevation', 'hidden'];
  const hasMovementChange = movementKeys.some((key) => key in changes);

  const lightKeys = ['light.bright', 'light.dim', 'light.luminosity', 'light.angle', 'light.rotation'];
  const hasLightChange = lightKeys.some((key) => foundry.utils.hasProperty(changes, key));

  if (hasMovementChange) {
    console.log('TokenLightCondition | Movement detected, calculating lighting');
    const token = tokenDocument.object;
    if (token && CoreUtils.isValidActor(token)) {
      debounceTokenLightingCalculation(token);
    }
  } else if (hasLightChange) {
    console.log('TokenLightCondition | Light change detected, calculating all tokens');
    debounceAllTokensLightingCalculation();
  }
});

/**
 * Handle ambient light changes
 */
Hooks.on('updateAmbientLight', (lightDocument, changes, options, userId) => {
  if (!game.user.isGM || !CoreUtils.checkModuleState()) return;
  debounceAllTokensLightingCalculation();
});

Hooks.on('createAmbientLight', (lightDocument, options, userId) => {
  if (!game.user.isGM || !CoreUtils.checkModuleState()) return;
  debounceAllTokensLightingCalculation();
});

Hooks.on('deleteAmbientLight', (lightDocument, options, userId) => {
  if (!game.user.isGM || !CoreUtils.checkModuleState()) return;
  debounceAllTokensLightingCalculation();
});

/**
 * Handle scene updates that affect lighting
 */
Hooks.on('updateScene', (sceneDocument, changes, options, userId) => {
  if (!game.user.isGM || !CoreUtils.checkModuleState()) return;
  if (sceneDocument.id !== canvas.scene?.id) return;

  const lightingKeys = ['environment.darknessLevel', 'environment.globalLight'];
  const hasLightingChange = lightingKeys.some((key) => foundry.utils.hasProperty(changes, key));

  if (hasLightingChange) {
    debounceAllTokensLightingCalculation();
  }
});

/**
 * Handle token HUD rendering - only show HUD, don't recalculate lighting
 */
Hooks.on('renderTokenHUD', (tokenHUD, html, app) => {
  const showHud = game.settings.get(CONSTANTS.MODULE_ID, 'showTokenHud');
  if (!showHud || !CoreUtils.checkModuleState()) return;
  const selectedToken = CoreUtils.findSelectedToken(tokenHUD);
  if (!CoreUtils.isValidActor(selectedToken)) return;
  if (game.user.isGM) LightingManager.showLightLevelBox(selectedToken, tokenHUD, html);
  else LightingManager.showLightLevelPlayerBox(selectedToken, tokenHUD, html);
});

/**
 * Debounced function to calculate lighting for a single token
 */
function debounceTokenLightingCalculation(token) {
  const delay = game.settings.get(CONSTANTS.MODULE_ID, 'delaycalculations');
  if (delay !== 0) {
    clearTimeout(token._lightingTimeout);
    token._lightingTimeout = setTimeout(() => {
      LightingManager.calculateTokenLightingOnly(token);
    }, delay);
  } else {
    LightingManager.calculateTokenLightingOnly(token);
  }
}

/**
 * Debounced function to calculate lighting for all tokens
 */
function debounceAllTokensLightingCalculation() {
  if (processingUpdate) return;

  const delay = game.settings.get(CONSTANTS.MODULE_ID, 'delaycalculations');
  if (delay !== 0) {
    clearTimeout(refreshTimeoutId);
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
    await LightingManager.calculateAllTokensLightingOnly();
  } finally {
    processingUpdate = false;
  }
}

/**
 * Main module class
 */
export class TokenLightCondition {
  static getSceneControlButtons(controls) {
    if (!game.user.isGM) return;
    try {
      const lightingControl = controls.lighting;
      if (!lightingControl?.tools) return;
      lightingControl.tools['tokenlightcontrol-enable'] = {
        name: 'tokenlightcontrol-enable',
        order: 999,
        title: 'Toggle Token Light Condition',
        icon: 'fa-solid fa-eye-low-vision',
        toggle: true,
        active: game.settings.get(CONSTANTS.MODULE_ID, 'enable'),
        onChange: (event, active) => {
          CoreUtils.toggleTokenLightCondition(active);
        }
      };
    } catch (error) {
      console.error('TokenLightCondition | Error adding scene control button:', error);
    }
  }
}

// Export the effect queue for access by other modules
export { effectQueue };

/**
 * Integrate lighting effects with Chris's Premades
 * @private
 */
async function _integrateCPREffects() {
  try {
    const cprItem = game.items.find((item) => item.flags['chris-premades']?.effectInterface);
    if (!cprItem) {
      console.log('TokenLightCondition | CPR Effect Interface not found');
      return;
    }

    for (const effectType of ['dark', 'dim']) {
      const existingEffect = cprItem.effects.find((effect) => effect.flags?.[CONSTANTS.MODULE_ID]?.type === effectType);
      if (!existingEffect) {
        const effectData = CONSTANTS.getEffectData(effectType);
        await ActiveEffect.create(effectData, { keepId: true, parent: cprItem });
      }
    }
    console.log('TokenLightCondition | CPR integration complete');
  } catch (error) {
    console.error('TokenLightCondition | CPR integration failed:', error);
  }
}