/**
 * Core constants and configuration for the Token Light Condition module
 */

/**
 * Module information and configuration constants
 * @namespace MODULE
 */
export const MODULE = {
  /** @type {string} Module identifier */
  ID: 'tokenlightcondition',

  /** @type {string} Module display name */
  NAME: 'Token Light Condition',

  /** @type {string} Module display acronym */
  SHORT: 'TLC',

  /** @type {number} Current logging level (set at runtime) */
  LOG_LEVEL: 2
};

/**
 * Settings keys for the module
 * @namespace SETTINGS
 */
export const SETTINGS = {
  /** @type {string} Module enable/disable setting */
  ENABLE: 'enable',

  /** @type {string} Show TokenHUD setting */
  SHOW_TOKEN_HUD: 'showTokenHud',

  /** @type {string} Add effects setting */
  ADD_EFFECTS: 'addEffects',

  /** @type {string} Global illumination setting */
  GLOBAL_ILLUMINATION: 'globalIllumination',

  /** @type {string} Delay calculations setting */
  DELAY_CALCULATIONS: 'delaycalculations',

  /** @type {string} Negative lights setting */
  NEGATIVE_LIGHTS: 'negativelights',

  /** @type {string} Logging level setting */
  LOGGING_LEVEL: 'loggingLevel'
};

/**
 * Light level constants and mappings
 * @namespace LIGHTING
 */
export const LIGHTING = {
  /** Light level numeric values */
  LEVELS: {
    /** @type {number} Dark lighting condition */
    DARK: 0,
    /** @type {number} Dim lighting condition */
    DIM: 1,
    /** @type {number} Bright lighting condition */
    BRIGHT: 2
  },

  /** Light level text labels for UI */
  LABELS: {
    /** @type {string} Dark lighting label */
    dark: 'DRK',
    /** @type {string} Dim lighting label */
    dim: 'DIM',
    /** @type {string} Bright lighting label */
    bright: 'BRT'
  },

  /** Light level icons for UI */
  ICONS: {
    /** @type {string} Dark lighting icon */
    dark: 'far fa-moon',
    /** @type {string} Dim lighting icon */
    dim: 'fas fa-moon',
    /** @type {string} Bright lighting icon */
    bright: 'fas fa-sun'
  }
};

/**
 * Actor types that are valid for lighting effects
 * @type {string[]}
 */
export const VALID_ACTOR_TYPES = ['character', 'npc'];

/**
 * Darkness threshold values for lighting calculations
 * @namespace DARKNESS_THRESHOLDS
 */
export const DARKNESS_THRESHOLDS = {
  /** @type {number} Maximum darkness level for bright light */
  BRIGHT_MAX: 0.5,
  /** @type {number} Maximum darkness level for dim light */
  DIM_MAX: 0.75
};

/**
 * Effect data templates for creating ActiveEffects
 * @namespace EFFECT_DATA
 */
export const EFFECT_DATA = {
  /**
   * Get effect data for creating lighting condition effects
   * @param {string} effectType - The type of effect ('dark' or 'dim')
   * @returns {Object|null} Effect data ready for ActiveEffect.create() or null if invalid type
   */
  getEffectData(effectType) {
    /** Base effect configurations */
    const baseEffects = {
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

    const effectDefinition = baseEffects[effectType];
    if (!effectDefinition) {
      console.warn(`TokenLightCondition | Invalid effect type: ${effectType}`);
      return null;
    }

    return {
      name: effectDefinition.name,
      img: effectDefinition.img,
      description: effectDefinition.description,
      statuses: effectDefinition.statuses,
      disabled: false,
      transfer: false,
      flags: {
        [MODULE.ID]: {
          type: effectType,
          lightLevel: effectType,
          timestamp: Date.now()
        }
      }
    };
  }
};
