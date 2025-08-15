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

  ICONS: {
    dim: 'icons/skills/melee/weapons-crossed-swords-black-gray.webp',
    dark: 'icons/skills/melee/weapons-crossed-swords-black.webp'
  },

  ACTOR_TYPES: ['character', 'npc'],

  DARKNESS_THRESHOLDS: {
    BRIGHT_MAX: 0.5,
    DIM_MAX: 0.75
  }
};
