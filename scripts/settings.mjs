import { MODULE, SETTINGS } from './constants.mjs';
import { EffectsManager } from './effects.mjs';
import { isValidToken } from './utils.mjs';

/**
 * Register all module settings with proper localization and change handlers
 * @returns {void}
 */
export function registerSettings() {
  game.settings.register(MODULE.ID, SETTINGS.SHOW_TOKEN_HUD, {
    name: 'TOKENLIGHTCONDITION.Settings.ShowTokenHud.Name',
    hint: 'TOKENLIGHTCONDITION.Settings.ShowTokenHud.Hint',
    scope: 'client',
    config: true,
    default: true,
    type: Boolean
  });

  game.settings.register(MODULE.ID, SETTINGS.ADD_EFFECTS, {
    name: 'TOKENLIGHTCONDITION.Settings.AddEffects.Name',
    hint: 'TOKENLIGHTCONDITION.Settings.AddEffects.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    onChange: async (value) => {
      if (!canvas.ready || !game.users.activeGM?.isSelf) return;
      if (value) await EffectsManager.initializeEffects();
      const tokens = canvas.tokens.placeables.filter((token) => isValidToken(token));
      await Promise.all(tokens.map((token) => EffectsManager.syncEffects(token, token.document.getFlag(MODULE.ID, 'lightLevel') ?? null)));
    }
  });

  game.settings.register(MODULE.ID, SETTINGS.DELAY_CALCULATIONS, {
    name: 'TOKENLIGHTCONDITION.Settings.DelayCalculations.Name',
    hint: 'TOKENLIGHTCONDITION.Settings.DelayCalculations.Hint',
    scope: 'world',
    config: true,
    default: 0,
    type: Number,
    range: { min: 0, max: 3000, step: 50 }
  });
}
