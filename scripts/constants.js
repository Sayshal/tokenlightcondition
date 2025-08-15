/**
 * Constants used throughout the Token Light Condition module
 */
export const CONSTANTS = {
  MODULE_ID: 'tokenlightcondition',

  LIGHT_LEVELS: {
    DARK: 0,
    DIM: 1,
    BRIGHT: 2
  },

  LIGHT_LABELS: {
    dark: 'DRK',
    dim: 'DIM',
    bright: 'BRT'
  },

  LIGHT_ICONS: {
    dark: 'far fa-moon',
    dim: 'fas fa-moon',
    bright: 'fas fa-sun'
  },

  ACTOR_TYPES: ['character', 'npc'],

  DARKNESS_THRESHOLDS: {
    BRIGHT_MAX: 0.5,
    DIM_MAX: 0.75
  },

  /**
   * Get effect data for creating ActiveEffects
   * @param {string} effectType - 'dark' or 'dim'
   * @returns {Object} Effect data ready for ActiveEffect.create()
   */
  getEffectData(effectType) {
    const baseData = {
      dark: {
        name: 'Dark Lighting',
        id: 'tcldarklight0000',
        img: 'icons/skills/melee/weapons-crossed-swords-black.webp',
        description: 'Character is in darkness',
        statuses: ['dark']
      },
      dim: {
        name: 'Dim Lighting',
        id: 'tcldimlight00000',
        img: 'icons/skills/melee/weapons-crossed-swords-black-gray.webp',
        description: 'Character is in dim light',
        statuses: ['dim']
      }
    };

    const effectDef = baseData[effectType];
    if (!effectDef) return null;

    return {
      name: effectDef.name,
      img: effectDef.img,
      description: effectDef.description,
      statuses: effectDef.statuses,
      disabled: false,
      transfer: false,
      flags: {
        [this.MODULE_ID]: {
          type: effectType,
          lightLevel: effectType,
          timestamp: Date.now()
        }
      }
    };
  }
};
