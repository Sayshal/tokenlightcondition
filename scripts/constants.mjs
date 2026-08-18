/** @type {object} Module identifiers. */
export const MODULE = {
  ID: 'tokenlightcondition',
  TITLE: 'Token Light Condition'
};

/** @enum {string} Setting keys. */
export const SETTINGS = {
  ADD_EFFECTS: 'addEffects',
  DELAY_CALCULATIONS: 'delaycalculations',
  SHOW_TOKEN_HUD: 'showTokenHud'
};

/** @enum {string} Hooks this module fires for consumers. */
export const HOOKS = {
  GATHER_LIGHT_SOURCES: 'tokenlightcondition.gatherLightSources',
  LIGHT_LEVEL_CHANGED: 'tokenlightcondition.lightLevelChanged'
};

/** @type {object} Light level ordinals and their HUD icons. */
export const LIGHTING = {
  LEVELS: { DARK: 0, DIM: 1, BRIGHT: 2 },
  ICONS: { dark: 'far fa-moon', dim: 'fas fa-moon', bright: 'fas fa-sun' }
};

/** @type {string[]} Actor types the module tracks. */
export const VALID_ACTOR_TYPES = ['character', 'npc'];

/** @type {object} ActiveEffect templates for the generic effect path. */
export const EFFECT_DATA = {
  /**
   * Build the ActiveEffect data for a lighting level
   * @param {string} effectType - 'dark' or 'dim'
   * @returns {object|null} ActiveEffect data or null for unknown type
   */
  getEffectData(effectType) {
    const baseEffects = {
      dark: {
        name: _loc('TOKENLIGHTCONDITION.Effects.DarkLighting.Name'),
        id: 'tcldarklight0000',
        img: 'icons/skills/melee/weapons-crossed-swords-black.webp',
        description: _loc('TOKENLIGHTCONDITION.Effects.DarkLighting.Description'),
        statuses: ['dark']
      },
      dim: {
        name: _loc('TOKENLIGHTCONDITION.Effects.DimLighting.Name'),
        id: 'tcldimlight00000',
        img: 'icons/skills/melee/weapons-crossed-swords-black-gray.webp',
        description: _loc('TOKENLIGHTCONDITION.Effects.DimLighting.Description'),
        statuses: ['dim']
      }
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
