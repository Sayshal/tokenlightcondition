import { Core } from './utils/core.js';
import { Effects } from './utils/effects.js';
import { Lighting } from './utils/lighting.js';

let inProgressLight = false;
let moduleState = false;
let refreshId = 0;

Hooks.once('init', () => {
  game.socket.on(`module.tokenlightcondition`, (data) => {});
});

Hooks.once('ready', () => {
  const module = game.modules.get('tokenlightcondition');
  const moduleVersion = module.version;
  console.log(`tokenlightcondition | Ready ${moduleVersion}`);
  moduleState = true;
  Effects.initializeEffects();
});

Hooks.on('getSceneControlButtons', (controls) => TokenLightCondition.getSceneControlButtons(controls));

Hooks.on('lightingRefresh', (data) => {
  if (game.user.isGM) {
    if (Core.checkModuleState()) {
      const delay = game.settings.get('tokenlightcondition', 'delaycalculations');
      if (delay !== 0) {
        clearTimeout(refreshId);
        refreshId = setTimeout(processLightingRefresh, delay);
      } else processLightingRefresh();
    }
  }
});

Hooks.on('refreshToken', (token) => {
  if (moduleState && game.user.isGM && Core.checkModuleState()) Core.isValidActor(token);
});

Hooks.on('renderTokenHUD', (tokenHUD, html, app) => {
  const showHud = game.settings.get('tokenlightcondition', 'showTokenHud');
  if (showHud) {
    if (Core.checkModuleState()) {
      let selected_token = Core.find_selected_token(tokenHUD);
      if (Core.isValidActor(selected_token)) {
        if (game.user.isGM) Lighting.show_lightLevel_box(selected_token, tokenHUD, html);
        else Lighting.show_lightLevel_player_box(selected_token, tokenHUD, html);
      }
    }
  }
});

export class TokenLightCondition {
  /**
   * Add the token light condition toggle to the lighting controls
   * @param {Object} controls - The scene controls object
   * @static
   */
  static getSceneControlButtons(controls) {
    try {
      if (!game.user.isGM) return;
      const lightingControl = controls.lighting;
      if (!lightingControl || !lightingControl.tools) return;

      // Add our toggle tool to the lighting controls
      lightingControl.tools['tokenlightcontrol-enable'] = {
        name: 'tokenlightcontrol-enable',
        order: 999,
        title: 'Toggle Token Light Condition',
        icon: 'fa-solid fa-eye-low-vision',
        toggle: true,
        active: !!game.settings.get('tokenlightcondition', 'enable'),
        onChange: (event, active) => {
          Core.toggleTokenLightCond(active);
        }
      };
    } catch (error) {
      console.error('TokenLightCondition | Error adding scene control button:', error);
    }
  }
}

async function processLightingRefresh() {
  if (!inProgressLight) {
    inProgressLight = true;
    await Lighting.check_all_tokens_lightingRefresh();
    inProgressLight = false;
  }
}
