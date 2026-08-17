import { MODULE, SETTINGS } from './constants.mjs';
import { calculateAllTokensLighting, effectQueue } from './token-light-condition.mjs';
import { EffectsManager } from './utils/effects.mjs';
import { TokenHelpers } from './utils/helpers.mjs';

/**
 * Troubleshooter lines covering live lighting state.
 * @returns {string[]} Markdown lines appended to the module's troubleshooter section
 */
function troubleshooterDebug() {
  const counts = { bright: 0, dim: 0, dark: 0, unset: 0 };
  for (const token of canvas?.tokens?.placeables ?? []) {
    const level = token.document.getFlag(MODULE.ID, 'lightLevel') ?? 'unset';
    if (level in counts) counts[level] += 1;
  }
  return [
    `- Scene: ${canvas?.scene?.name ?? 'none'}`,
    `- Pending queue operations: ${effectQueue.pendingOperations.size}`,
    `- Queue processing active: ${effectQueue.processingActive}`,
    `- Token light levels: ${counts.bright} bright, ${counts.dim} dim, ${counts.dark} dark, ${counts.unset} unset`
  ];
}

Hooks.once('init', () => {
  ATLAS.register('tokenlightcondition', { title: MODULE.TITLE, github: 'Sayshal/tokenlightcondition', debug: troubleshooterDebug });
  ATLAS.log(3, `Initializing Token Light Condition ${game.modules.get(MODULE.ID).version}`);
  registerAllSettings();
});

/**
 * Register all module settings with proper localization and change handlers
 * @private
 */
function registerAllSettings() {
  ATLAS.log(3, 'Registering module settings');
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
      const tokens = canvas.tokens.placeables.filter((token) => TokenHelpers.isValidToken(token));
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

  game.settings.register(MODULE.ID, SETTINGS.NEGATIVE_LIGHTS, {
    name: 'TOKENLIGHTCONDITION.Settings.NegativeLights.Name',
    hint: 'TOKENLIGHTCONDITION.Settings.NegativeLights.Hint',
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    onChange: async () => {
      if (canvas.ready && game.users.activeGM?.isSelf) await calculateAllTokensLighting();
    }
  });
  ATLAS.log(3, 'All settings registered successfully');
}
