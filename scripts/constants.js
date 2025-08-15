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

  ICONS: {
    dim: 'icons/skills/melee/weapons-crossed-swords-black-gray.webp',
    dark: 'icons/skills/melee/weapons-crossed-swords-black.webp'
  },

  ACTOR_TYPES: ['character', 'npc'],

  DARKNESS_THRESHOLDS: {
    BRIGHT_MAX: 0.5,
    DIM_MAX: 0.75
  },

  EFFECT_DEFINITIONS: {
    dark: {
      name: 'tokenlightcond-effect-dark',
      icon: 'icons/skills/melee/weapons-crossed-swords-black.webp',
      description: 'tokenlightcond-effect-dark-desc',
      id: 'dnd5etlcdark0000',
      statusId: 'dark'
    },

    dim: {
      name: 'tokenlightcond-effect-dim',
      icon: 'icons/skills/melee/weapons-crossed-swords-black-gray.webp',
      description: 'tokenlightcond-effect-dim-desc',
      id: 'dnd5etlcdim00000',
      statusId: 'dim'
    }
  }
};
