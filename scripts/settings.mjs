/**
 * Settings configuration and registration for Token Light Condition module
 */

import { MODULE, SETTINGS } from './constants.mjs';
import { initializeLogger, log } from './logger.mjs';
import { EffectsManager } from './utils/effects.mjs';
import { LightingCalculator } from './utils/lighting.mjs';

/**
 * Handle module setup and initial configuration
 * Registers core settings that need to be available immediately
 */
Hooks.once('setup', () => {
  log(3, 'Setting up Token Light Condition module');

  /**
   * Register the primary module enable/disable setting
   * This setting controls whether the module is actively processing tokens
   */
  game.settings.register(MODULE.ID, SETTINGS.ENABLE, {
    name: 'tokenlightcondition.enable',
    scope: 'world',
    config: false, // Hidden setting controlled by scene controls
    type: Boolean,
    default: true,
    onChange: (value) => {
      // Update scene controls when setting changes
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

  /**
   * Register logging level setting early so it's available during initialization
   */
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

/**
 * Initialize all module settings when the game is ready
 * This happens after all other modules are loaded
 */
Hooks.once('ready', () => {
  const module = game.modules.get(MODULE.ID);
  log(3, `Initializing Token Light Condition ${module.version}`);

  // Initialize logger with current settings
  initializeLogger();

  // Register all remaining settings
  registerAllSettings();
});

/**
 * Register all module settings with proper localization and change handlers
 * @private
 */
function registerAllSettings() {
  log(3, 'Registering module settings');

  /**
   * Setting to control display of TokenHUD lighting indicator
   * Client-side setting so each user can choose their preference
   */
  game.settings.register(MODULE.ID, SETTINGS.SHOW_TOKEN_HUD, {
    name: game.i18n.localize('TOKENLIGHTCONDITION.Settings.ShowTokenHud.Name'),
    hint: game.i18n.localize('TOKENLIGHTCONDITION.Settings.ShowTokenHud.Hint'),
    scope: 'client',
    config: true,
    default: true,
    type: Boolean
  });

  /**
   * Setting to control whether lighting effects are automatically added to tokens
   * World setting so GM can control behavior for all players
   */
  game.settings.register(MODULE.ID, SETTINGS.ADD_EFFECTS, {
    name: game.i18n.localize('TOKENLIGHTCONDITION.Settings.AddEffects.Name'),
    hint: game.i18n.localize('TOKENLIGHTCONDITION.Settings.AddEffects.Hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    onChange: async (value) => {
      // Initialize or clear effects when setting changes
      if (canvas.ready && game.user.isGM) {
        if (value) {
          await EffectsManager.initializeEffects();
        } else {
          // Clear all existing effects when disabled
          await LightingCalculator.refreshAllTokenLighting();
        }
      }
    }
  });

  /**
   * Setting to enable global illumination consideration in lighting calculations
   * This affects how scene-wide lighting interacts with token conditions
   */
  game.settings.register(MODULE.ID, SETTINGS.GLOBAL_ILLUMINATION, {
    name: game.i18n.localize('TOKENLIGHTCONDITION.Settings.GlobalIllumination.Name'),
    hint: game.i18n.localize('TOKENLIGHTCONDITION.Settings.GlobalIllumination.Hint'),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    onChange: async (value) => {
      // Recalculate all token lighting when global illumination changes
      if (canvas.ready && game.user.isGM) {
        await LightingCalculator.refreshAllTokenLighting();
      }
    }
  });

  /**
   * Setting to add processing delay for performance optimization
   * Useful for large scenes with many tokens or light sources
   */
  game.settings.register(MODULE.ID, SETTINGS.DELAY_CALCULATIONS, {
    name: game.i18n.localize('TOKENLIGHTCONDITION.Settings.DelayCalculations.Name'),
    hint: game.i18n.localize('TOKENLIGHTCONDITION.Settings.DelayCalculations.Hint'),
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
   * Experimental setting for negative light source support
   * Allows light sources with negative luminosity to create darkness
   */
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
