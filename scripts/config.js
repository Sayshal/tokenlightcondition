import { Effects } from './utils/effects.js';
import { Lighting } from './utils/lighting.js';

Hooks.once('setup', () => {
  game.settings.register('tokenlightcondition', 'enable', {
    name: 'tokenlightcondition.enable',
    scope: 'world',
    config: false,
    type: Boolean,
    default: true,
    onChange: (value) => {
      if (!canvas.ready || !game.user.isGM) return;
      if (ui.controls.control.name === 'lighting') {
        console.log('TokenLightCondition | ui.controls.control.tools:', ui.controls.control.tools);
        if (ui.controls.control.tools['tokenlightcontrol-enable']) ui.controls.control.tools['tokenlightcontrol-enable'].active = value;
        ui.controls.render();
      }
    }
  });
});

Hooks.once('ready', () => {
  const module = game.modules.get('tokenlightcondition');
  const moduleVersion = module.version;
  console.log(`tokenlightcondition | Initializing ${moduleVersion}`);

  game.settings.register('tokenlightcondition', 'showTokenHud', {
    name: game.i18n.localize('tokenlightcond-config-showTokenHud-name'),
    hint: game.i18n.localize('tokenlightcond-config-showTokenHud-hint'),
    scope: 'client',
    config: true,
    default: true,
    type: Boolean
  });

  let choices = { none: game.i18n.localize('tokenlightcond-effectSource-none') };
  let defaultSource = 'none';
  let findATL = game.modules.get('ATL')?.active;
  let findCubDark = game.cub?.getCondition(game.i18n.localize('tokenlightcond-effect-dark'));
  let findCubDim = game.cub?.getCondition(game.i18n.localize('tokenlightcond-effect-dim'));
  let findCE = game.dfreds?.effectInterface;

  if (findATL) {
    choices['ae'] = game.i18n.localize('tokenlightcond-effectSource-ae');
    defaultSource = 'ae';
  }

  const system_pf2e = game.system.id == 'pf2e';
  if (system_pf2e) {
    choices['ae'] = game.i18n.localize('tokenlightcond-effectSource-ae');
    defaultSource = 'ae';
  }

  if (findCE) {
    choices['ce'] = game.i18n.localize('tokenlightcond-effectSource-ce');
    defaultSource = 'ce';
  }

  game.settings.register('tokenlightcondition', 'effectSource', {
    name: game.i18n.localize('tokenlightcond-effectSource-name'),
    hint: game.i18n.localize('tokenlightcond-effectSource-hint'),
    scope: 'world',
    config: true,
    type: String,
    choices,
    default: defaultSource,
    onChange: (value) => {
      if (!canvas.ready || !game.user.isGM) {
        return;
      }

      Effects.initializeEffects();
    }
  });

  game.settings.register('tokenlightcondition', 'globalIllumination', {
    name: game.i18n.localize('tokenlightcond-config-globalIllumination-name'),
    hint: game.i18n.localize('tokenlightcond-config-globalIllumination-hint'),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    onChange: (value) => {
      if (!canvas.ready || !game.user.isGM) return;
      Lighting.check_all_tokens_lightingRefresh();
    }
  });

  game.settings.register('tokenlightcondition', 'delaycalculations', {
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
    },
    onChange: (value) => {}
  });

  game.settings.register('tokenlightcondition', 'negativelights', {
    name: game.i18n.localize('tokenlightcond-config-negativelights-name'),
    hint: game.i18n.localize('tokenlightcond-config-negativelights-hint'),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    onChange: (value) => {}
  });
});
