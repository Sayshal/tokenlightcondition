import { EFFECT_DATA, MODULE, SETTINGS } from './constants.mjs';

/** Manages lighting effects for tokens across different game systems */
export class EffectsManager {
  /** Initialize effects system based on the current game system */
  static async initializeEffects() {
    ATLAS.log(3, 'Initializing effects system');
    if (!game.settings.get(MODULE.ID, SETTINGS.ADD_EFFECTS)) {
      ATLAS.log(3, 'Effect creation disabled in settings');
      return;
    }
    const gameSystemId = game.system.id;
    ATLAS.log(3, `Initializing effects for system: ${gameSystemId}`);
    try {
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
    } catch (error) {
      ATLAS.log(1, `Error initializing effects for system ${gameSystemId}:`, error);
    }
  }

  /**
   * Read Chris's Premades' effectInterface setting without assuming it is registered
   * @returns {boolean} True when CPR is active and its effect interface is enabled
   */
  static _isCPREffectInterfaceEnabled() {
    if (!game.modules.get('chris-premades')?.active) return false;
    try {
      return game.settings.get('chris-premades', 'effectInterface') === true;
    } catch {
      ATLAS.log(2, "Chris's Premades effectInterface setting not registered, skipping integration");
      return false;
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
    switch (game.system.id) {
      case 'pf2e':
        await this._clearPF2eEffects(token);
        break;
      default:
        await this._clearGenericEffects(token);
        break;
    }
  }

  /**
   * Clear a token's lighting effects and apply the one matching a level.
   * @param {object} token - The token to sync
   * @param {string|null} level - 'dark', 'dim', or null for no effect
   */
  static async syncEffects(token, level) {
    await this.clearEffects(token);
    if (level === 'dark') await this.addDarkEffect(token);
    else if (level === 'dim') await this.addDimEffect(token);
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
   */
  static async _addLightingEffect(token, effectType) {
    if (!token?.actor) {
      ATLAS.log(2, `Cannot add ${effectType} effect - invalid token or actor`);
      return;
    }
    if (!game.settings.get(MODULE.ID, SETTINGS.ADD_EFFECTS)) {
      ATLAS.log(3, `Effect creation disabled, skipping ${effectType} effect`);
      return;
    }
    ATLAS.log(3, `Adding ${effectType} effect to token: ${token.id}`);
    switch (game.system.id) {
      case 'pf2e':
        await this._addPF2eEffect(token, effectType);
        break;
      default:
        await this._addGenericEffect(token, effectType);
        break;
    }
  }

  /** Initialize effects for PF2e system */
  static async _initializePF2eEffects() {
    ATLAS.log(3, 'Initializing PF2e lighting effects');
    const effectTypes = ['dim', 'dark'];
    const itemsToCreate = [];
    for (const effectType of effectTypes) {
      const existingItem = this._findPF2eWorldItem(effectType);
      if (!existingItem) {
        const itemData = this._createPF2eEffectData(effectType);
        itemsToCreate.push(itemData);
        ATLAS.log(3, `Queuing PF2e effect item creation: ${effectType}`);
      } else {
        ATLAS.log(3, `PF2e effect item already exists: ${effectType}`);
      }
    }
    if (itemsToCreate.length > 0) {
      await Item.createDocuments(itemsToCreate);
      ATLAS.log(3, `Created ${itemsToCreate.length} PF2e effect items`);
    }
  }

  /** Initialize effects for D&D 5e system */
  static async _initializeDnd5eEffects() {
    ATLAS.log(3, 'Initializing D&D 5e lighting effects');
    if (this._isCPREffectInterfaceEnabled()) await this._integrateCPREffects();
  }

  /**
   * Find the world Item backing a PF2e lighting effect
   * @param {string} effectType - The type of effect ('dark' or 'dim')
   * @returns {object|undefined} The matching world Item, if any
   */
  static _findPF2eWorldItem(effectType) {
    return game.items.find((item) => item.flags?.[MODULE.ID]?.type === effectType || item.system?.slug === `tokenlightcondition-${effectType}`);
  }

  /**
   * Clear lighting effects for PF2e system
   * @param {object} token - The token to clear effects from
   */
  static async _clearPF2eEffects(token) {
    const legacyNames = ['Dim', 'Dark'];
    const itemsToRemove = token.actor.items.filter((item) => item.flags?.[MODULE.ID]?.type || legacyNames.includes(item.name));
    if (itemsToRemove.length > 0) {
      const itemIds = itemsToRemove.map((item) => item.id);
      await token.actor.deleteEmbeddedDocuments('Item', itemIds);
      ATLAS.log(3, `Cleared ${itemsToRemove.length} PF2e effects from token: ${token.id}`);
    }
  }

  /**
   * Clear lighting effects for generic systems (including D&D 5e)
   * @param {object} token - The token to clear effects from
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
   */
  static async _addPF2eEffect(token, effectType) {
    const effectItem = this._findPF2eWorldItem(effectType);
    if (!effectItem) throw new Error(`PF2e effect item not found: ${effectType}`);
    await token.actor.createEmbeddedDocuments('Item', [effectItem.toObject()]);
    ATLAS.log(3, `Added PF2e ${effectType} effect to token: ${token.id}`);
  }

  /**
   * Add lighting effect for generic systems
   * @param {object} token - The token to add the effect to
   * @param {string} effectType - The type of effect ('dark' or 'dim')
   * @returns {Promise<object|undefined>} The created effect, if any
   */
  static async _addGenericEffect(token, effectType) {
    ATLAS.log(3, `Creating ${effectType} effect for token: ${token.id}`);
    if (this._isCPREffectInterfaceEnabled()) {
      const cprEffect = this._findCPREffect(effectType);
      if (cprEffect) {
        const effectData = cprEffect.toObject();
        delete effectData._id;
        effectData.statuses = [effectType];
        const effect = await ActiveEffect.create(effectData, { parent: token.actor });
        ATLAS.log(3, `Created CPR ${effectType} effect: ${effect?.id}`);
        return effect;
      }
    }
    const effectData = EFFECT_DATA.getEffectData(effectType);
    if (!effectData) throw new Error(`Invalid effect type: ${effectType}`);
    const effect = await ActiveEffect.create(effectData, { parent: token.actor });
    ATLAS.log(3, `Created ${effectType} effect: ${effect?.id}`);
    return effect;
  }

  /**
   * Create effect data for PF2e system
   * @param {string} effectType - The type of effect ('dark' or 'dim')
   * @returns {object} PF2e effect item data
   */
  static _createPF2eEffectData(effectType) {
    const isDark = effectType === 'dark';
    const ruleOption = isDark ? 'lighting:darkness' : 'lighting:dim-light';
    const icon = isDark ? 'systems/pf2e/icons/default-icons/ancestry.svg' : 'systems/pf2e/icons/default-icons/character.svg';
    const effectName = `${effectType.charAt(0).toUpperCase() + effectType.slice(1)}Lighting`;
    return {
      name: _loc(`TOKENLIGHTCONDITION.Effects.${effectName}.Name`),
      type: 'effect',
      effects: [],
      system: {
        description: { gm: '', value: _loc(`TOKENLIGHTCONDITION.Effects.${effectName}.Description`) },
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
      flags: { [MODULE.ID]: { type: effectType } }
    };
  }

  /**
   * Find Chris's Premades effect matching our effect type
   * @param {string} effectType - The type of effect to find
   * @returns {object|null} The matching CPR effect or null
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

  /** Integrate with Chris's Premades Effect Interface */
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
            await ActiveEffect.create(effectData, { parent: cprItem });
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
