import { EFFECT_DATA, MODULE, SETTINGS } from '../constants.mjs';

/** Manages lighting effects for tokens across different game systems */
export class EffectsManager {
  /** Initialize effects system based on the current game system */
  static async initializeEffects() {
    ATLAS.log(3, 'Initializing effects system');
    try {
      const addEffects = game.settings.get(MODULE.ID, SETTINGS.ADD_EFFECTS);
      if (!addEffects) {
        ATLAS.log(3, 'Effect creation disabled in settings');
        return;
      }
    } catch {
      ATLAS.log(2, 'Settings not yet registered, skipping effect initialization');
      return;
    }
    const gameSystemId = game.system.id;
    ATLAS.log(3, `Initializing effects for system: ${gameSystemId}`);
    switch (gameSystemId) {
      case 'pf2e':
        await this._initializePF2eEffects();
        break;
      case 'dnd5e':
        await this._initializeDnd5eEffects();
        break;
      default:
        ATLAS.log(3, `Using generic effects for system: ${gameSystemId}`);
        break;
    }
  }

  /**
   * Clear all lighting effects from a token
   * @param {object} token - The token to clear effects from
   */
  static async clearEffects(token) {
    if (!token?.actor) {
      ATLAS.log(2, 'Cannot clear effects - invalid token or actor');
      return;
    }
    ATLAS.log(3, `Clearing lighting effects for token: ${token.id}`);
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
      ATLAS.log(1, `Error clearing effects for token ${token.id}:`, error);
    }
  }

  /**
   * Add a dark lighting effect to a token
   * @param {object} token - The token to add the effect to
   */
  static async addDarkEffect(token) {
    await this._addLightingEffect(token, 'dark');
  }

  /**
   * Add a dim lighting effect to a token
   * @param {object} token - The token to add the effect to
   */
  static async addDimEffect(token) {
    await this._addLightingEffect(token, 'dim');
  }

  /**
   * Add a lighting effect to a token
   * @param {object} token - The token to add the effect to
   * @param {string} effectType - The type of effect ('dark' or 'dim')
   * @private
   */
  static async _addLightingEffect(token, effectType) {
    if (!token?.actor) {
      ATLAS.log(2, `Cannot add ${effectType} effect - invalid token or actor`);
      return;
    }
    let addEffects = true;
    try {
      addEffects = game.settings.get(MODULE.ID, SETTINGS.ADD_EFFECTS);
    } catch {
      ATLAS.log(2, 'addEffects setting not available, defaulting to true');
    }
    if (!addEffects) {
      ATLAS.log(3, `Effect creation disabled, skipping ${effectType} effect`);
      return;
    }
    ATLAS.log(3, `Adding ${effectType} effect to token: ${token.id}`);
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
      ATLAS.log(1, `Error adding ${effectType} effect to token ${token.id}:`, error);
    }
  }

  /**
   * Initialize effects for PF2e system
   * @private
   */
  static async _initializePF2eEffects() {
    ATLAS.log(3, 'Initializing PF2e lighting effects');
    const effectTypes = ['dim', 'dark'];
    const itemsToCreate = [];
    for (const effectType of effectTypes) {
      const localizedName = game.i18n.localize(`TOKENLIGHTCONDITION.Effects.${effectType.charAt(0).toUpperCase() + effectType.slice(1)}.Name`);
      const existingItem = game.items.find((item) => item.name === localizedName);
      if (!existingItem) {
        const itemData = this._createPF2eEffectData(effectType);
        itemsToCreate.push(itemData);
        ATLAS.log(3, `Queuing PF2e effect item creation: ${localizedName}`);
      } else {
        ATLAS.log(3, `PF2e effect item already exists: ${localizedName}`);
      }
    }
    if (itemsToCreate.length > 0) {
      await Item.createDocuments(itemsToCreate);
      ATLAS.log(3, `Created ${itemsToCreate.length} PF2e effect items`);
    }
  }

  /**
   * Initialize effects for D&D 5e system
   * @private
   */
  static async _initializeDnd5eEffects() {
    ATLAS.log(3, 'Initializing D&D 5e lighting effects');
    if (game.modules.get('chris-premades')?.active) {
      const cprEnabled = game.settings.get('chris-premades', 'effectInterface');
      if (cprEnabled) await this._integrateCPREffects();
    }
  }

  /**
   * Clear lighting effects for PF2e system
   * @param {object} token - The token to clear effects from
   * @private
   */
  static async _clearPF2eEffects(token) {
    const effectNames = ['Dim', 'Dark'].map((type) => game.i18n.localize(`TOKENLIGHTCONDITION.Effects.${type}.Name`));
    const itemsToRemove = token.actor.items.filter((item) => effectNames.includes(item.name));
    if (itemsToRemove.length > 0) {
      const itemIds = itemsToRemove.map((item) => item.id);
      await token.actor.deleteEmbeddedDocuments('Item', itemIds);
      ATLAS.log(3, `Cleared ${itemsToRemove.length} PF2e effects from token: ${token.id}`);
    }
  }

  /**
   * Clear lighting effects for generic systems (including D&D 5e)
   * @param {object} token - The token to clear effects from
   * @private
   */
  static async _clearGenericEffects(token) {
    const effectsToRemove = token.actor.effects.filter((effect) => effect.flags?.[MODULE.ID]?.type);
    if (effectsToRemove.length > 0) {
      const effectIds = effectsToRemove.map((effect) => effect.id);
      await token.actor.deleteEmbeddedDocuments('ActiveEffect', effectIds);
      ATLAS.log(3, `Cleared ${effectsToRemove.length} effects from token: ${token.id}`);
    }
  }

  /**
   * Add lighting effect for PF2e system
   * @param {object} token - The token to add the effect to
   * @param {string} effectType - The type of effect ('dark' or 'dim')
   * @private
   */
  static async _addPF2eEffect(token, effectType) {
    const effectName = game.i18n.localize(`TOKENLIGHTCONDITION.Effects.${effectType.charAt(0).toUpperCase() + effectType.slice(1)}.Name`);
    const effectItem = game.items.find((item) => item.name === effectName);
    if (effectItem) {
      await token.actor.createEmbeddedDocuments('Item', [effectItem.toObject()]);
      ATLAS.log(3, `Added PF2e ${effectType} effect to token: ${token.id}`);
    } else {
      ATLAS.log(2, `PF2e effect item not found: ${effectName}`);
    }
  }

  /**
   * Add lighting effect for generic systems
   * @param {object} token - The token to add the effect to
   * @param {string} effectType - The type of effect ('dark' or 'dim')
   * @returns {Promise<object|undefined>} The created effect, if any
   * @private
   */
  static async _addGenericEffect(token, effectType) {
    ATLAS.log(3, `Creating ${effectType} effect for token: ${token.id}`);
    try {
      if (game.modules.get('chris-premades')?.active) {
        const cprEnabled = game.settings.get('chris-premades', 'effectInterface');
        if (cprEnabled) {
          const cprEffect = this._findCPREffect(effectType);
          if (cprEffect) {
            const effectData = cprEffect.toObject();
            effectData.statuses = [effectType];
            const effect = await ActiveEffect.create(effectData, { keepId: true, parent: token.actor });
            ATLAS.log(3, `Created CPR ${effectType} effect: ${effect?.id}`);
            return effect;
          }
        }
      }
      const effectData = EFFECT_DATA.getEffectData(effectType);
      if (!effectData) {
        ATLAS.log(1, `Invalid effect type: ${effectType}`);
        return;
      }
      const effect = await ActiveEffect.create(effectData, { keepId: true, parent: token.actor });
      ATLAS.log(3, `Created ${effectType} effect: ${effect?.id}`);
      return effect;
    } catch (error) {
      ATLAS.log(1, `Error creating ${effectType} effect:`, error);
      throw error;
    }
  }

  /**
   * Create effect data for PF2e system
   * @param {string} effectType - The type of effect ('dark' or 'dim')
   * @returns {object} PF2e effect item data
   * @private
   */
  static _createPF2eEffectData(effectType) {
    const isDark = effectType === 'dark';
    const ruleOption = isDark ? 'lighting:darkness' : 'lighting:dim-light';
    const icon = isDark ? 'systems/pf2e/icons/default-icons/ancestry.svg' : 'systems/pf2e/icons/default-icons/character.svg';
    const effectName = effectType.charAt(0).toUpperCase() + effectType.slice(1);
    return {
      name: game.i18n.localize(`TOKENLIGHTCONDITION.Effects.${effectName}.Name`),
      type: 'effect',
      effects: [],
      system: {
        description: { gm: '', value: game.i18n.localize(`TOKENLIGHTCONDITION.Effects.${effectName}.Description`) },
        rules: [{ key: 'RollOption', option: ruleOption }],
        slug: `tokenlightcondition-${effectType}`,
        traits: { otherTags: [], value: [] },
        level: { value: 0 },
        duration: { value: 1, unit: 'unlimited', expiry: 'turn-start', sustained: false },
        tokenIcon: { show: true },
        badge: null,
        context: null,
        unidentified: true
      },
      img: icon,
      flags: { [MODULE.ID]: { effectType: effectType, version: '2.0.0' } }
    };
  }

  /**
   * Find Chris's Premades effect matching our effect type
   * @param {string} effectType - The type of effect to find
   * @returns {object|null} The matching CPR effect or null
   * @private
   */
  static _findCPREffect(effectType) {
    const cprItem = game.items.find((item) => item.flags['chris-premades']?.effectInterface);
    if (!cprItem) {
      ATLAS.log(3, 'CPR Effect Interface item not found');
      return null;
    }
    const matchingEffect = cprItem.effects.find((effect) => effect.flags?.[MODULE.ID]?.type === effectType);
    return matchingEffect || null;
  }

  /**
   * Integrate with Chris's Premades Effect Interface
   * @private
   */
  static async _integrateCPREffects() {
    ATLAS.log(3, "Integrating with Chris's Premades");
    try {
      const cprItem = game.items.find((item) => item.flags['chris-premades']?.effectInterface);
      if (!cprItem) {
        ATLAS.log(2, 'CPR Effect Interface not found, skipping integration');
        return;
      }
      for (const effectType of ['dark', 'dim']) {
        const existingEffect = cprItem.effects.find((effect) => effect.flags?.[MODULE.ID]?.type === effectType);
        if (!existingEffect) {
          const effectData = EFFECT_DATA.getEffectData(effectType);
          if (effectData) {
            await ActiveEffect.create(effectData, { keepId: true, parent: cprItem });
            ATLAS.log(3, `Created CPR integration effect: ${effectType}`);
          }
        }
      }
      ATLAS.log(3, 'CPR integration complete');
    } catch (error) {
      ATLAS.log(1, 'CPR integration failed:', error);
    }
  }
}
