import { CONSTANTS } from './constants.js';
import { CoreUtils } from './utils/core.js';
import { Effects } from './utils/effects.js';
import { LightingManager } from './utils/lighting.js';

/**
 * Module state tracking
 */
let moduleState = false;
let refreshTimeoutId = 0;
let processingUpdate = false;

/**
 * Module ready hook
 */
Hooks.once('ready', () => {
  const module = game.modules.get(CONSTANTS.MODULE_ID);
  console.log(`TokenLightCondition | Ready ${module.version}`);
  moduleState = true;
  if (game.modules.get('chris-premades')?.active && game.settings.get('chris-premades', 'effectInterface') === true) _integrateCPREffects();
  Effects.initializeEffects();
  ui.effects?.render(true);
});

/**
 * Add scene control buttons
 */
Hooks.on('getSceneControlButtons', (controls) => {
  TokenLightCondition.getSceneControlButtons(controls);
});

/**
 * Handle token creation - check lighting for new token
 */
Hooks.on('createToken', async (tokenDocument, options, userId) => {
  if (!game.user.isGM || !CoreUtils.checkModuleState()) return;

  console.log('TokenLightCondition | createToken hook fired:', tokenDocument.id);

  const token = tokenDocument.object;
  if (token && !token.actor?.getFlag(CONSTANTS.MODULE_ID, 'updating')) {
    console.log('TokenLightCondition | Processing new token lighting');
    // Add a small delay to ensure token is fully initialized
    setTimeout(() => {
      LightingManager.checkTokenLighting(token);
    }, 100);
  } else {
    console.log('TokenLightCondition | Skipping token processing - updating flag present');
  }
});

/**
 * Handle token updates - only check lighting when position actually changes
 */
Hooks.on('updateToken', (tokenDocument, changes, options, userId) => {
  if (!game.user.isGM || !CoreUtils.checkModuleState()) return;
  
  // Skip processing if this update is from our own effect management
  if (options?.tokenlightcondition || tokenDocument.actor?.getFlag(CONSTANTS.MODULE_ID, 'updating')) {
    console.log('TokenLightCondition | Skipping update - internal effect processing');
    return;
  }
  
  console.log('TokenLightCondition | updateToken hook fired', {
    tokenId: tokenDocument.id,
    changes: Object.keys(changes),
    userId
  });

  // Only process for actual movement or light changes, not effect-related changes
  const movementKeys = ['x', 'y', 'elevation', 'hidden'];
  const hasMovementChange = movementKeys.some((key) => key in changes);

  const lightKeys = ['light.bright', 'light.dim', 'light.luminosity', 'light.angle', 'light.rotation'];
  const hasLightChange = lightKeys.some((key) => foundry.utils.hasProperty(changes, key));

  // Ignore changes that are just effects or flags
  const effectKeys = ['effects', 'flags'];
  const isOnlyEffectChange = Object.keys(changes).every(key => effectKeys.includes(key));
  
  if (isOnlyEffectChange) {
    console.log('TokenLightCondition | Skipping update - only effect/flag changes');
    return;
  }

  if (hasMovementChange) {
    console.log('TokenLightCondition | Movement detected, checking single token');
    const token = tokenDocument.object;
    if (token) {
      debounceTokenLightingCheck(token);
    }
  } else if (hasLightChange) {
    console.log('TokenLightCondition | Light change detected, checking all tokens');
    debounceAllTokensLightingCheck();
  }
});

/**
 * Handle ambient light changes - recalculate all tokens when lighting sources change
 */
Hooks.on('updateAmbientLight', (lightDocument, changes, options, userId) => {
  if (!game.user.isGM || !CoreUtils.checkModuleState()) return;
  debounceAllTokensLightingCheck();
});

Hooks.on('createAmbientLight', (lightDocument, options, userId) => {
  if (!game.user.isGM || !CoreUtils.checkModuleState()) return;
  debounceAllTokensLightingCheck();
});

Hooks.on('deleteAmbientLight', (lightDocument, options, userId) => {
  if (!game.user.isGM || !CoreUtils.checkModuleState()) return;
  debounceAllTokensLightingCheck();
});

/**
 * Handle scene updates that affect lighting
 */
Hooks.on('updateScene', (sceneDocument, changes, options, userId) => {
  if (!game.user.isGM || !CoreUtils.checkModuleState()) return;
  if (sceneDocument.id !== canvas.scene?.id) return;

  // Only recalculate if lighting-related properties changed
  const lightingKeys = ['environment.darknessLevel', 'environment.globalLight'];
  const hasLightingChange = lightingKeys.some((key) => foundry.utils.hasProperty(changes, key));

  if (hasLightingChange) {
    debounceAllTokensLightingCheck();
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
 * Debounced function to check lighting for a single token
 */
function debounceTokenLightingCheck(token) {
  // Don't process if token is being updated by us
  if (token.actor?.getFlag(CONSTANTS.MODULE_ID, 'updating')) {
    console.log('TokenLightCondition | Skipping debounced check - token updating');
    return;
  }
  
  const delay = game.settings.get(CONSTANTS.MODULE_ID, 'delaycalculations');
  if (delay !== 0) {
    clearTimeout(token._lightingTimeout);
    token._lightingTimeout = setTimeout(() => {
      // Check again before processing
      if (!token.actor?.getFlag(CONSTANTS.MODULE_ID, 'updating')) {
        LightingManager.checkTokenLighting(token);
      }
    }, delay);
  } else {
    LightingManager.checkTokenLighting(token);
  }
}

/**
 * Debounced function to check lighting for all tokens
 */
function debounceAllTokensLightingCheck() {
  if (processingUpdate) return;

  const delay = game.settings.get(CONSTANTS.MODULE_ID, 'delaycalculations');
  if (delay !== 0) {
    clearTimeout(refreshTimeoutId);
    refreshTimeoutId = setTimeout(processAllTokensLighting, delay);
  } else {
    processAllTokensLighting();
  }
}

/**
 * Process lighting for all tokens with concurrency protection
 */
async function processAllTokensLighting() {
  if (processingUpdate) return;
  processingUpdate = true;
  try {
    await LightingManager.checkAllTokensLightingRefresh();
  } finally {
    processingUpdate = false;
  }
}

/**
 * Main module class
 */
export class TokenLightCondition {
  /**
   * Add the token light condition toggle to the lighting controls
   * @param {Object} controls - The scene controls object
   */
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
