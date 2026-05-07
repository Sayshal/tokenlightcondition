import { MODULE, SETTINGS } from './constants.mjs';
import { initializeLogger, log } from './logger.mjs';
import { EffectsManager } from './utils/effects.mjs';
import { LightingCalculator } from './utils/lighting.mjs';

Hooks.once('setup', () => {
  log(3, 'Setting up Token Light Condition module');
  game.settings.register(MODULE.ID, SETTINGS.ENABLE, {
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

  game.settings.register(MODULE.ID, SETTINGS.LOGGING_LEVEL, {
    name: 'TOKENLIGHTCONDITION.Settings.Logger.Name',
    hint: 'TOKENLIGHTCONDITION.Settings.Logger.Hint',
    scope: 'client',
    config: true,
    type: String,
    choices: {
      0: 'TOKENLIGHTCONDITION.Settings.Logger.Choices.Off',
      1: 'TOKENLIGHTCONDITION.Settings.Logger.Choices.Errors',
      2: 'TOKENLIGHTCONDITION.Settings.Logger.Choices.Warnings',
      3: 'TOKENLIGHTCONDITION.Settings.Logger.Choices.Verbose'
    },
    default: 2,
    onChange: (value) => {
      MODULE.LOG_LEVEL = parseInt(value);
      log(3, `Logging level changed to ${MODULE.LOG_LEVEL}`);
    }
  });
});

Hooks.once('ready', () => {
  const module = game.modules.get(MODULE.ID);
  log(3, `Initializing Token Light Condition ${module.version}`);
  initializeLogger();
  registerAllSettings();
});

/**
 * Register all module settings with proper localization and change handlers
 * @private
 */
function registerAllSettings() {
  log(3, 'Registering module settings');
  game.settings.register(MODULE.ID, SETTINGS.SHOW_TOKEN_HUD, {
    name: game.i18n.localize('TOKENLIGHTCONDITION.Settings.ShowTokenHud.Name'),
    hint: game.i18n.localize('TOKENLIGHTCONDITION.Settings.ShowTokenHud.Hint'),
    scope: 'client',
    config: true,
    default: true,
    type: Boolean
  });

  game.settings.register(MODULE.ID, SETTINGS.ADD_EFFECTS, {
    name: game.i18n.localize('TOKENLIGHTCONDITION.Settings.AddEffects.Name'),
    hint: game.i18n.localize('TOKENLIGHTCONDITION.Settings.AddEffects.Hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    onChange: async (value) => {
      if (canvas.ready && game.user.isGM) {
        if (value) await EffectsManager.initializeEffects();
        else await LightingCalculator.refreshAllTokenLighting();
      }
    }
  });

  game.settings.register(MODULE.ID, SETTINGS.GLOBAL_ILLUMINATION, {
    name: game.i18n.localize('TOKENLIGHTCONDITION.Settings.GlobalIllumination.Name'),
    hint: game.i18n.localize('TOKENLIGHTCONDITION.Settings.GlobalIllumination.Hint'),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    onChange: async () => {
      if (canvas.ready && game.user.isGM) await LightingCalculator.refreshAllTokenLighting();
    }
  });

  game.settings.register(MODULE.ID, SETTINGS.DELAY_CALCULATIONS, {
    name: game.i18n.localize('TOKENLIGHTCONDITION.Settings.DelayCalculations.Name'),
    hint: game.i18n.localize('TOKENLIGHTCONDITION.Settings.DelayCalculations.Hint'),
    scope: 'world',
    config: true,
    default: 0,
    type: Number,
    range: { min: 0, max: 3000, step: 50 }
  });

  game.settings.register(MODULE.ID, SETTINGS.NEGATIVE_LIGHTS, {
    name: game.i18n.localize('TOKENLIGHTCONDITION.Settings.NegativeLights.Name'),
    hint: game.i18n.localize('TOKENLIGHTCONDITION.Settings.NegativeLights.Hint'),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean
  });
  log(3, 'All settings registered successfully');
}
