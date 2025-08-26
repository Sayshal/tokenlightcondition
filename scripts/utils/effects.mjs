/**
 * Effects management system for Token Light Condition module
 * Handles creation, modification, and removal of lighting condition effects
 */

import { EFFECT_DATA, MODULE, SETTINGS } from '../constants.mjs';
import { log } from '../logger.mjs';

/**
 * Manages lighting effects for tokens across different game systems
 * Provides system-specific implementations for D&D 5e, PF2e, and generic systems
 */
export class EffectsManager {
  /**
   * Initialize effects system based on the current game system
   * Sets up any required effect items or templates
   */
  static async initializeEffects() {
    log(3, 'Initializing effects system');

    // Safety check - ensure settings are available
    try {
      const addEffects = game.settings.get(MODULE.ID, SETTINGS.ADD_EFFECTS);
      if (!addEffects) {
        log(3, 'Effect creation disabled in settings');
        return;
      }
    } catch (error) {
      log(2, 'Settings not yet registered, skipping effect initialization');
      return;
    }

    // Initialize system-specific effects
    const gameSystemId = game.system.id;
    log(3, `Initializing effects for system: ${gameSystemId}`);

    switch (gameSystemId) {
      case 'pf2e':
        await this._initializePF2eEffects();
        break;
      case 'dnd5e':
        await this._initializeDnd5eEffects();
        break;
      default:
        log(3, `Using generic effects for system: ${gameSystemId}`);
        break;
    }
  }

  /**
   * Clear all lighting effects from a token (silent operation, no hooks)
   * @param {Token} token - The token to clear effects from
   */
  static async clearEffects(token) {
    if (!token?.actor) {
      log(2, 'Cannot clear effects - invalid token or actor');
      return;
    }

    log(3, `Clearing lighting effects for token: ${token.id}`);

    const gameSystemId = game.system.id;

    try {
      switch (gameSystemId) {
        case 'pf2e':
          await this._clearPF2eEffects(token);
          break;
        default:
          await this._clearGenericEffects(token);
          break;
      }
    } catch (error) {
      log(1, `Error clearing effects for token ${token.id}:`, error);
    }
  }

  /**
   * Add a dark lighting effect to a token (silent operation)
   * @param {Token} token - The token to add the effect to
   */
  static async addDarkEffect(token) {
    await this._addLightingEffect(token, 'dark');
  }

  /**
   * Add a dim lighting effect to a token (silent operation)
   * @param {Token} token - The token to add the effect to
   */
  static async addDimEffect(token) {
    await this._addLightingEffect(token, 'dim');
  }

  /**
   * Add a lighting effect to a token (private implementation)
   * @param {Token} token - The token to add the effect to
   * @param {string} effectType - The type of effect ('dark' or 'dim')
   * @private
   */
  static async _addLightingEffect(token, effectType) {
    if (!token?.actor) {
      log(2, `Cannot add ${effectType} effect - invalid token or actor`);
      return;
    }

    // Check if effects are enabled
    let addEffects = true;
    try {
      addEffects = game.settings.get(MODULE.ID, SETTINGS.ADD_EFFECTS);
    } catch (error) {
      log(2, 'addEffects setting not available, defaulting to true');
    }

    if (!addEffects) {
      log(3, `Effect creation disabled, skipping ${effectType} effect`);
      return;
    }

    log(3, `Adding ${effectType} effect to token: ${token.id}`);

    const gameSystemId = game.system.id;

    try {
      switch (gameSystemId) {
        case 'pf2e':
          await this._addPF2eEffect(token, effectType);
          break;
        default:
          await this._addGenericEffect(token, effectType);
          break;
      }
    } catch (error) {
      log(1, `Error adding ${effectType} effect to token ${token.id}:`, error);
    }
  }

  /**
   * Initialize effects for PF2e system
   * Creates world-level effect items that can be applied to tokens
   * @private
   */
  static async _initializePF2eEffects() {
    log(3, 'Initializing PF2e lighting effects');

    const effectTypes = ['dim', 'dark'];
    const itemsToCreate = [];

    // Check each effect type and create world items if they don't exist
    for (const effectType of effectTypes) {
      const localizedName = game.i18n.localize(`TOKENLIGHTCONDITION.Effects.${effectType.charAt(0).toUpperCase() + effectType.slice(1)}.Name`);

      const existingItem = game.items.find((item) => item.name === localizedName);

      if (!existingItem) {
        const itemData = this._createPF2eEffectData(effectType);
        itemsToCreate.push(itemData);
        log(3, `Queuing PF2e effect item creation: ${localizedName}`);
      } else {
        log(3, `PF2e effect item already exists: ${localizedName}`);
      }
    }

    // Create any missing effect items
    if (itemsToCreate.length > 0) {
      await Item.createDocuments(itemsToCreate);
      log(3, `Created ${itemsToCreate.length} PF2e effect items`);
    }
  }

  /**
   * Initialize effects for D&D 5e system
   * Sets up any system-specific effect configurations
   * @private
   */
  static async _initializeDnd5eEffects() {
    log(3, 'Initializing D&D 5e lighting effects');

    // Check for Chris's Premades integration
    if (game.modules.get('chris-premades')?.active) {
      const cprEnabled = game.settings.get('chris-premades', 'effectInterface');
      if (cprEnabled) {
        await this._integrateCPREffects();
      }
    }
  }

  /**
   * Clear lighting effects for PF2e system
   * @param {Token} token - The token to clear effects from
   * @private
   */
  static async _clearPF2eEffects(token) {
    // Get localized effect names to search for
    const effectNames = ['Dim', 'Dark'].map((type) => game.i18n.localize(`TOKENLIGHTCONDITION.Effects.${type}.Name`));

    // Find matching items on the actor
    const itemsToRemove = token.actor.items.filter((item) => effectNames.includes(item.name));

    if (itemsToRemove.length > 0) {
      const itemIds = itemsToRemove.map((item) => item.id);
      await token.actor.deleteEmbeddedDocuments('Item', itemIds);
      log(3, `Cleared ${itemsToRemove.length} PF2e effects from token: ${token.id}`);
    }
  }

  /**
   * Clear lighting effects for generic systems (including D&D 5e)
   * @param {Token} token - The token to clear effects from
   * @private
   */
  static async _clearGenericEffects(token) {
    // Find effects created by this module
    const effectsToRemove = token.actor.effects.filter((effect) => effect.flags?.[MODULE.ID]?.type);

    if (effectsToRemove.length > 0) {
      const effectIds = effectsToRemove.map((effect) => effect.id);
      await token.actor.deleteEmbeddedDocuments('ActiveEffect', effectIds);
      log(3, `Cleared ${effectsToRemove.length} effects from token: ${token.id}`);
    }
  }

  /**
   * Add lighting effect for PF2e system
   * @param {Token} token - The token to add the effect to
   * @param {string} effectType - The type of effect ('dark' or 'dim')
   * @private
   */
  static async _addPF2eEffect(token, effectType) {
    const effectName = game.i18n.localize(`TOKENLIGHTCONDITION.Effects.${effectType.charAt(0).toUpperCase() + effectType.slice(1)}.Name`);

    // Find the world-level effect item
    const effectItem = game.items.find((item) => item.name === effectName);

    if (effectItem) {
      // Add the effect item to the actor
      await token.actor.createEmbeddedDocuments('Item', [effectItem.toObject()]);
      log(3, `Added PF2e ${effectType} effect to token: ${token.id}`);
    } else {
      log(2, `PF2e effect item not found: ${effectName}`);
    }
  }

  /**
   * Add lighting effect for generic systems
   * @param {Token} token - The token to add the effect to
   * @param {string} effectType - The type of effect ('dark' or 'dim')
   * @private
   */
  static async _addGenericEffect(token, effectType) {
    log(3, `Creating ${effectType} effect for token: ${token.id}`);

    try {
      // Check for Chris's Premades integration first
      if (game.modules.get('chris-premades')?.active) {
        const cprEnabled = game.settings.get('chris-premades', 'effectInterface');
        if (cprEnabled) {
          const cprEffect = this._findCPREffect(effectType);
          if (cprEffect) {
            const effectData = cprEffect.toObject();
            effectData.statuses = [effectType];

            const effect = await ActiveEffect.create(effectData, {
              keepId: true,
              parent: token.actor
            });

            log(3, `Created CPR ${effectType} effect: ${effect?.id}`);
            return effect;
          }
        }
      }

      // Create standard ActiveEffect
      const effectData = EFFECT_DATA.getEffectData(effectType);
      if (!effectData) {
        log(1, `Invalid effect type: ${effectType}`);
        return;
      }

      const effect = await ActiveEffect.create(effectData, {
        keepId: true,
        parent: token.actor
      });

      log(3, `Created ${effectType} effect: ${effect?.id}`);
      return effect;
    } catch (error) {
      log(1, `Error creating ${effectType} effect:`, error);
      throw error;
    }
  }

  /**
   * Create effect data for PF2e system
   * @param {string} effectType - The type of effect ('dark' or 'dim')
   * @returns {Object} PF2e effect item data
   * @private
   */
  static _createPF2eEffectData(effectType) {
    const isDark = effectType === 'dark';

    // PF2e-specific configurations
    const ruleOption = isDark ? 'lighting:darkness' : 'lighting:dim-light';
    const icon = isDark ? 'systems/pf2e/icons/default-icons/ancestry.svg' : 'systems/pf2e/icons/default-icons/character.svg';

    const effectName = effectType.charAt(0).toUpperCase() + effectType.slice(1);

    return {
      name: game.i18n.localize(`TOKENLIGHTCONDITION.Effects.${effectName}.Name`),
      type: 'effect',
      effects: [],
      system: {
        description: {
          gm: '',
          value: game.i18n.localize(`TOKENLIGHTCONDITION.Effects.${effectName}.Description`)
        },
        rules: [
          {
            key: 'RollOption',
            option: ruleOption
          }
        ],
        slug: `tokenlightcondition-${effectType}`,
        traits: {
          otherTags: [],
          value: []
        },
        level: { value: 0 },
        duration: {
          value: 1,
          unit: 'unlimited',
          expiry: 'turn-start',
          sustained: false
        },
        tokenIcon: { show: true },
        badge: null,
        context: null,
        unidentified: true
      },
      img: icon,
      flags: {
        [MODULE.ID]: {
          effectType: effectType,
          version: '2.0.0'
        }
      }
    };
  }

  /**
   * Find Chris's Premades effect matching our effect type
   * @param {string} effectType - The type of effect to find
   * @returns {ActiveEffect|null} The matching CPR effect or null
   * @private
   */
  static _findCPREffect(effectType) {
    const cprItem = game.items.find((item) => item.flags['chris-premades']?.effectInterface);

    if (!cprItem) {
      log(3, 'CPR Effect Interface item not found');
      return null;
    }

    const matchingEffect = cprItem.effects.find((effect) => effect.flags?.[MODULE.ID]?.type === effectType);

    return matchingEffect || null;
  }

  /**
   * Integrate with Chris's Premades Effect Interface
   * Creates our lighting effects in the CPR system
   * @private
   */
  static async _integrateCPREffects() {
    log(3, "Integrating with Chris's Premades");

    try {
      const cprItem = game.items.find((item) => item.flags['chris-premades']?.effectInterface);

      if (!cprItem) {
        log(2, 'CPR Effect Interface not found, skipping integration');
        return;
      }

      // Create effects for both dark and dim lighting
      for (const effectType of ['dark', 'dim']) {
        const existingEffect = cprItem.effects.find((effect) => effect.flags?.[MODULE.ID]?.type === effectType);

        if (!existingEffect) {
          const effectData = EFFECT_DATA.getEffectData(effectType);
          if (effectData) {
            await ActiveEffect.create(effectData, {
              keepId: true,
              parent: cprItem
            });
            log(3, `Created CPR integration effect: ${effectType}`);
          }
        }
      }

      log(3, 'CPR integration complete');
    } catch (error) {
      log(1, 'CPR integration failed:', error);
    }
  }
}
