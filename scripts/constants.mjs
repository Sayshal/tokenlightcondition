export const MODULE = {
  ID: 'tokenlightcondition',
  TITLE: 'Token Light Condition'
};

export const SETTINGS = {
  ADD_EFFECTS: 'addEffects',
  DELAY_CALCULATIONS: 'delaycalculations',
  NEGATIVE_LIGHTS: 'negativelights',
  SHOW_TOKEN_HUD: 'showTokenHud'
};

export const LIGHTING = {
  LEVELS: { DARK: 0, DIM: 1, BRIGHT: 2 },
  LABELS: { dark: 'DRK', dim: 'DIM', bright: 'BRT' },
  ICONS: { dark: 'far fa-moon', dim: 'fas fa-moon', bright: 'fas fa-sun' }
};

export const VALID_ACTOR_TYPES = ['character', 'npc'];

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
      _id: effectDefinition.id,
      name: effectDefinition.name,
      img: effectDefinition.img,
      description: effectDefinition.description,
      statuses: effectDefinition.statuses,
      disabled: false,
      transfer: false,
      showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS,
      flags: { [MODULE.ID]: { type: effectType } }
    };
  }
};
