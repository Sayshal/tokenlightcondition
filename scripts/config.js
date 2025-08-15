import { CONSTANTS } from './constants.js';
import { Effects } from './utils/effects.js';
import { LightingManager } from './utils/lighting.js';

/**
 * Handle module setup and configuration
 */
Hooks.once('setup', () => {
  /**
   * Register the module enable setting
   */
  game.settings.register(CONSTANTS.MODULE_ID, 'enable', {
    name: 'tokenlightcondition.enable',
    scope: 'world',
    config: false,
    type: Boolean,
    default: true,
    onChange: (value) => {
      if (!canvas.ready || !game.user.isGM) return;
      if (ui.controls.control?.name === 'lighting') {
        const tool = ui.controls.control.tools['tokenlightcontrol-enable'];
        if (tool) {
          tool.active = value;
          ui.controls.render();
        }
      }
    }
  });
});

/**
 * Initialize module settings when ready
 */
Hooks.once('ready', () => {
  const module = game.modules.get(CONSTANTS.MODULE_ID);
  console.log(`TokenLightCondition | Initializing ${module.version}`);
  _registerSettings();
});

/**
 * Register all module settings
 * @private
 */
function _registerSettings() {
  /**
   * Show TokenHUD setting
   */
  game.settings.register(CONSTANTS.MODULE_ID, 'showTokenHud', {
    name: game.i18n.localize('tokenlightcond-config-showTokenHud-name'),
    hint: game.i18n.localize('tokenlightcond-config-showTokenHud-hint'),
    scope: 'client',
    config: true,
    default: true,
    type: Boolean
  });

  /**
   * Effect source setting
   */
  game.settings.register(CONSTANTS.MODULE_ID, 'effectSource', {
    name: game.i18n.localize('tokenlightcond-effectSource-name'),
    hint: game.i18n.localize('tokenlightcond-effectSource-hint'),
    scope: 'world',
    config: true,
    type: String,
    choices: _getEffectSourceChoices(),
    default: _getDefaultEffectSource(),
    onChange: (value) => {
      if (canvas.ready && game.user.isGM) Effects.initializeEffects();
    }
  });

  /**
   * Global illumination setting
   */
  game.settings.register(CONSTANTS.MODULE_ID, 'globalIllumination', {
    name: game.i18n.localize('tokenlightcond-config-globalIllumination-name'),
    hint: game.i18n.localize('tokenlightcond-config-globalIllumination-hint'),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    onChange: (value) => {
      if (canvas.ready && game.user.isGM) LightingManager.checkAllTokensLightingRefresh();
    }
  });

  /**
   * Delay calculations setting
   */
  game.settings.register(CONSTANTS.MODULE_ID, 'delaycalculations', {
    name: game.i18n.localize('tokenlightcond-config-delaycalculations-name'),
    hint: game.i18n.localize('tokenlightcond-config-delaycalculations-hint'),
    scope: 'world',
    config: true,
    default: 0,
    type: Number,
    range: {
      min: 0,
      max: 3000,
      step: 50
    }
  });

  /**
   * Negative lights setting
   */
  game.settings.register(CONSTANTS.MODULE_ID, 'negativelights', {
    name: game.i18n.localize('tokenlightcond-config-negativelights-name'),
    hint: game.i18n.localize('tokenlightcond-config-negativelights-hint'),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean
  });
}

/**
 * Get available effect source choices
 * @returns {Object} The choices object
 * @private
 */
function _getEffectSourceChoices() {
  const choices = { none: game.i18n.localize('tokenlightcond-effectSource-none') };
  const hasATL = game.modules.get('ATL')?.active;
  const isPf2e = game.system.id === 'pf2e';
  const hasConvenientEffects = game.dfreds?.effectInterface;
  if (hasATL || isPf2e) choices.ae = game.i18n.localize('tokenlightcond-effectSource-ae');
  if (hasConvenientEffects) choices.ce = game.i18n.localize('tokenlightcond-effectSource-ce');
  return choices;
}

/**
 * Get the default effect source
 * @returns {string} The default source
 * @private
 */
function _getDefaultEffectSource() {
  const hasATL = game.modules.get('ATL')?.active;
  const isPf2e = game.system.id === 'pf2e';
  const hasConvenientEffects = game.dfreds?.effectInterface;
  if (hasConvenientEffects) return 'ce';
  if (hasATL || isPf2e) return 'ae';
  return 'none';
}
