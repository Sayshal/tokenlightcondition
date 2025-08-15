import { CONSTANTS } from './constants.js';
import { CoreUtils } from './utils/core.js';
import { Effects } from './utils/effects.js';
import { LightingManager } from './utils/lighting.js';

/**
 * Module state tracking
 */
let inProgressLight = false;
let moduleState = false;
let refreshTimeoutId = 0;

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
 * Handle lighting refresh events
 */
Hooks.on('lightingRefresh', (data) => {
  if (!game.user.isGM || !CoreUtils.checkModuleState()) return;
  const delay = game.settings.get(CONSTANTS.MODULE_ID, 'delaycalculations');
  if (delay !== 0) {
    clearTimeout(refreshTimeoutId);
    refreshTimeoutId = setTimeout(processLightingRefresh, delay);
  } else {
    processLightingRefresh();
  }
});

/**
 * Handle token refresh events
 */
Hooks.on('refreshToken', (token) => {
  if (moduleState && game.user.isGM && CoreUtils.checkModuleState()) {
    CoreUtils.isValidActor(token);
  }
});

/**
 * Handle token HUD rendering
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
 * Process lighting refresh with concurrency protection
 */
async function processLightingRefresh() {
  if (inProgressLight) return;
  inProgressLight = true;
  try {
    await LightingManager.checkAllTokensLightingRefresh();
  } finally {
    inProgressLight = false;
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
