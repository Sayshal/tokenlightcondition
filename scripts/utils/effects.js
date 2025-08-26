import { CONSTANTS } from '../constants.js';

/**
 * Manages lighting effects for tokens
 */
export class Effects {
  static creatingEffects = new Set();

  /**
   * Initialize effects based on the current game system
   */
  static async initializeEffects() {
    const addEffects = game.settings.get(CONSTANTS.MODULE_ID, 'addEffects');
    if (!addEffects) return;
    const isPf2e = game.system.id === 'pf2e';
    if (isPf2e) await this._initializeEffectsPf2e();
  }

  /**
   * Initialize effects for PF2e system
   * @private
   */
  static async _initializeEffectsPf2e() {
    const effects = ['dim', 'dark'];
    const itemsToCreate = [];
    for (const effectType of effects) {
      const localizedName = game.i18n.localize(`TOKENLIGHTCONDITION.Effects.${effectType.charAt(0).toUpperCase() + effectType.slice(1)}.Name`);
      const existingItem = game.items.find((item) => item.name === localizedName);
      if (!existingItem) {
        const itemData = this._createPf2eEffectData(effectType);
        itemsToCreate.push(itemData);
      }
    }
    if (itemsToCreate.length > 0) await Item.createDocuments(itemsToCreate);
  }

  /**
   * Create PF2e effect data
   * @param {string} effectType - The type of effect ('dark' or 'dim')
   * @returns {Object} The PF2e effect data
   * @private
   */
  static _createPf2eEffectData(effectType) {
    const isDark = effectType === 'dark';
    const ruleOption = isDark ? 'lighting:darkness' : 'lighting:dim-light';
    const icon = isDark ? 'systems/pf2e/icons/default-icons/ancestry.svg' : 'systems/pf2e/icons/default-icons/character.svg';
    const effectName = effectType.charAt(0).toUpperCase() + effectType.slice(1);
    const data = {
      name: game.i18n.localize(`TOKENLIGHTCONDITION.Effects.${effectName}.Name`),
      type: 'effect',
      effects: [],
      system: {
        description: {
          gm: '',
          value: game.i18n.localize(`TOKENLIGHTCONDITION.Effects.${effectName}.Description`)
        },
        rules: [{ key: 'RollOption', option: ruleOption }],
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
      flags: {}
    };
    return data;
  }

  /**
   * Clear all lighting effects from a token
   * @param {Token} selectedToken - The token to clear effects from
   */
  static async clearEffects(selectedToken) {
    if (!selectedToken?.actor) return;
    const isPf2e = game.system.id === 'pf2e';
    if (isPf2e) await this._clearEffectsPf2e(selectedToken);
    else await this._clearEffectsDnd5e(selectedToken);
  }

  /**
   * Clear effects for PF2e
   * @param {Token} selectedToken - The token to clear effects from
   * @private
   */
static async _clearEffectsPf2e(selectedToken) {
  try {
    // Set updating flag  
    await selectedToken.actor.setFlag(CONSTANTS.MODULE_ID, 'updating', true);
    
    const effectNames = ['Dim', 'Dark'].map((type) => game.i18n.localize(`TOKENLIGHTCONDITION.Effects.${type}.Name`));
    const itemsToRemove = selectedToken.actor.items.filter((item) => effectNames.includes(item.name));
    
    if (itemsToRemove.length > 0) {
      const itemIds = itemsToRemove.map((item) => item.id);
      await selectedToken.actor.deleteEmbeddedDocuments('Item', itemIds, {
        tokenlightcondition: true
      });
      console.log('TokenLightCondition | Cleared PF2e effects for token:', selectedToken.id);
    }
  } finally {
    // Clear updating flag
    await selectedToken.actor.unsetFlag(CONSTANTS.MODULE_ID, 'updating');
  }
}

  /**
   * Clear effects for D&D 5e
   * @param {Token} selectedToken - The token to clear effects from
   * @private
   */
static async _clearEffectsDnd5e(selectedToken) {
  try {
    // Set updating flag
    await selectedToken.actor.setFlag(CONSTANTS.MODULE_ID, 'updating', true);
    
    const effectsToRemove = selectedToken.actor.effects.filter((effect) => {
      const isOurEffect = effect.flags?.[CONSTANTS.MODULE_ID]?.type;
      return isOurEffect;
    });

    if (effectsToRemove.length > 0) {
      const validEffectIds = effectsToRemove.map((effect) => effect.id);
      await selectedToken.actor.deleteEmbeddedDocuments('ActiveEffect', validEffectIds, {
        tokenlightcondition: true
      });
      console.log('TokenLightCondition | Cleared effects for token:', selectedToken.id);
    }
  } finally {
    // Clear updating flag
    await selectedToken.actor.unsetFlag(CONSTANTS.MODULE_ID, 'updating');
  }
}


  /**
   * Add dark effect to a token
   * @param {Token} selectedToken - The token to add the effect to
   */
  static async addDark(selectedToken) {
    await this._addEffect(selectedToken, 'dark');
  }

  /**
   * Add dim effect to a token
   * @param {Token} selectedToken - The token to add the effect to
   */
  static async addDim(selectedToken) {
    await this._addEffect(selectedToken, 'dim');
  }

  /**
   * Add a lighting effect to a token
   * @param {Token} selectedToken - The token to add the effect to
   * @param {string} effectType - The type of effect ('dark' or 'dim')
   * @private
   */
  static async _addEffect(selectedToken, effectType) {
    if (!selectedToken?.actor) return;
    const addEffects = game.settings.get(CONSTANTS.MODULE_ID, 'addEffects');
    if (!addEffects) return;
    const lockKey = `${selectedToken.actor.id}-${effectType}`;
    if (this.creatingEffects.has(lockKey)) return;
    this.creatingEffects.add(lockKey);
    try {
      const isPf2e = game.system.id === 'pf2e';
      let existingEffect;
      if (isPf2e) {
        const effectName = game.i18n.localize(`TOKENLIGHTCONDITION.Effects.${effectType.charAt(0).toUpperCase() + effectType.slice(1)}.Name`);
        existingEffect = selectedToken.actor.items.find((item) => item.name === effectName);
      } else existingEffect = selectedToken.actor.effects.find((effect) => effect.flags?.[CONSTANTS.MODULE_ID]?.type === effectType);
      if (existingEffect) return;
      if (isPf2e) await this._addPf2eEffect(selectedToken, effectType);
      else await this._addCoreEffect(selectedToken, effectType);
    } finally {
      this.creatingEffects.delete(lockKey);
    }
  }

  /**
   * Add effect for PF2e system
   * @param {Token} selectedToken - The token
   * @param {string} effectType - The effect type
   * @private
   */
  static async _addPf2eEffect(selectedToken, effectType) {
    const effectName = game.i18n.localize(`TOKENLIGHTCONDITION.Effects.${effectType.charAt(0).toUpperCase() + effectType.slice(1)}.Name`);
    const effectItem = game.items.find((item) => item.name === effectName);
    if (effectItem) await selectedToken.actor.createEmbeddedDocuments('Item', [effectItem]);
  }

  /**
   * Find CPR effect by matching our module flags
   * @param {string} effectType - The effect type to find
   * @returns {ActiveEffect|null} The matching CPR effect, or null if not found
   * @private
   */
  static _findCPREffect(effectType) {
    const cprItem = game.items.find((item) => item.flags['chris-premades']?.effectInterface);
    if (!cprItem) return null;
    const matchingEffect = cprItem.effects.find((effect) => effect.flags?.[CONSTANTS.MODULE_ID]?.type === effectType);
    return matchingEffect || null;
  }

  /**
   * Add core status effect
   * @param {Token} selectedToken - The token
   * @param {string} effectType - The effect type
   * @private
   */
static async _addCoreEffect(selectedToken, effectType) {
  console.log(`TokenLightCondition | _addCoreEffect starting - Token: ${selectedToken.id}, Effect: ${effectType}`);
  
  try {
    // Set updating flag BEFORE any operations
    await selectedToken.actor.setFlag(CONSTANTS.MODULE_ID, 'updating', true);

    if (game.modules.get('chris-premades')?.active && game.settings.get('chris-premades', 'effectInterface') === true) {
      console.log('TokenLightCondition | Attempting CPR integration');
      const cprEffect = this._findCPREffect(effectType);
      if (cprEffect) {
        const effectData = cprEffect.toObject();
        effectData.statuses = [effectType];
        console.log('TokenLightCondition | Creating CPR effect with data:', effectData);
        
        const effect = await ActiveEffect.create(effectData, { 
          keepId: true, 
          parent: selectedToken.actor,
          tokenlightcondition: true // Add our flag to the creation options
        });
        
        console.log(`TokenLightCondition | Successfully created CPR effect "${cprEffect.name}":`, effect?.id);
        return effect;
      }
    }

    // Create standard ActiveEffect
    console.log('TokenLightCondition | Creating standard ActiveEffect');
    const effectData = CONSTANTS.getEffectData(effectType);
    if (!effectData) {
      console.error(`TokenLightCondition | Invalid effect type: ${effectType}`);
      return;
    }

    console.log('TokenLightCondition | Effect data:', effectData);

    const effect = await ActiveEffect.create(effectData, {
      keepId: true,
      parent: selectedToken.actor,
      tokenlightcondition: true // Add our flag to prevent recursive updates
    });

    console.log(`TokenLightCondition | Successfully created ${effectType} effect:`, effect?.id);
    return effect;
    
  } catch (error) {
    console.error(`TokenLightCondition | Error creating ${effectType} effect:`, error);
    throw error;
  } finally {
    // Always clear the updating flag, even if there was an error
    try {
      await selectedToken.actor.unsetFlag(CONSTANTS.MODULE_ID, 'updating');
      console.log('TokenLightCondition | Cleared updating flag for token:', selectedToken.id);
    } catch (flagError) {
      console.error('TokenLightCondition | Error clearing updating flag:', flagError);
    }
  }
}
}
