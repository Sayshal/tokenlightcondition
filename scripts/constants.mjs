export const MODULE = {
  ID: 'tokenlightcondition',
  LOG_LEVEL: 0,
  TITLE: 'Token Light Condition'
};

export const SETTINGS = {
  ADD_EFFECTS: 'addEffects',
  DELAY_CALCULATIONS: 'delaycalculations',
  ENABLE: 'enable',
  GLOBAL_ILLUMINATION: 'globalIllumination',
  LOGGING_LEVEL: 'loggingLevel',
  NEGATIVE_LIGHTS: 'negativelights',
  SHOW_TOKEN_HUD: 'showTokenHud'
};

export const LIGHTING = {
  LEVELS: { DARK: 0, DIM: 1, BRIGHT: 2 },
  LABELS: { dark: 'DRK', dim: 'DIM', bright: 'BRT' },
  ICONS: { dark: 'far fa-moon', dim: 'fas fa-moon', bright: 'fas fa-sun' }
};

export const VALID_ACTOR_TYPES = ['character', 'npc'];

export const DARKNESS_THRESHOLDS = { BRIGHT_MAX: 0.5, DIM_MAX: 0.75 };

export const EFFECT_DATA = {
  /**
   * @param {string} effectType - 'dark' or 'dim'
   * @returns {object|null} ActiveEffect data or null for unknown type
   */
  getEffectData(effectType) {
    const baseEffects = {
      dark: { name: 'Dark Lighting', id: 'tcldarklight0000', img: 'icons/skills/melee/weapons-crossed-swords-black.webp', description: 'Character is in darkness', statuses: ['dark'] },
      dim: { name: 'Dim Lighting', id: 'tcldimlight00000', img: 'icons/skills/melee/weapons-crossed-swords-black-gray.webp', description: 'Character is in dim light', statuses: ['dim'] }
    };
    const effectDefinition = baseEffects[effectType];
    if (!effectDefinition) return null;
    return {
      name: effectDefinition.name,
      img: effectDefinition.img,
      description: effectDefinition.description,
      statuses: effectDefinition.statuses,
      disabled: false,
      transfer: false,
      flags: { [MODULE.ID]: { type: effectType, lightLevel: effectType, timestamp: Date.now() } }
    };
  }
};
