import { CONSTANTS } from '../constants.js';

/**
 * Manages lighting effects for tokens
 */
export class Effects {
  /**
   * Initialize effects based on the current game system
   */
  static async initializeEffects() {
    // Safety check - ensure the setting exists before accessing it
    try {
      const addEffects = game.settings.get(CONSTANTS.MODULE_ID, 'addEffects');
      if (!addEffects) return;
    } catch (error) {
      console.warn('TokenLightCondition | Settings not yet registered, skipping effect initialization');
      return;
    }
    
    const isPf2e = game.system.id === 'pf2e';
    if (isPf2e) await this._initializeEffectsPf2e();
  }

  /**
   * Clear all lighting effects from a token - SILENT VERSION
   * @param {Token} selectedToken - The token to clear effects from
   */
  static async clearEffectsSilent(selectedToken) {
    if (!selectedToken?.actor) return;
    const isPf2e = game.system.id === 'pf2e';
    if (isPf2e) await this._clearEffectsPf2eSilent(selectedToken);
    else await this._clearEffectsDnd5eSilent(selectedToken);
  }

  /**
   * Add dark effect to a token - SILENT VERSION
   */
  static async addDarkSilent(selectedToken) {
    await this._addEffectSilent(selectedToken, 'dark');
  }

  /**
   * Add dim effect to a token - SILENT VERSION
   */
  static async addDimSilent(selectedToken) {
    await this._addEffectSilent(selectedToken, 'dim');
  }

  /**
   * Clear effects for PF2e - SILENT VERSION
   * @private
   */
  static async _clearEffectsPf2eSilent(selectedToken) {
    const effectNames = ['Dim', 'Dark'].map((type) => game.i18n.localize(`TOKENLIGHTCONDITION.Effects.${type}.Name`));
    const itemsToRemove = selectedToken.actor.items.filter((item) => effectNames.includes(item.name));
    
    if (itemsToRemove.length > 0) {
      const itemIds = itemsToRemove.map((item) => item.id);
      await selectedToken.actor.deleteEmbeddedDocuments('Item', itemIds);
      console.log('TokenLightCondition | Cleared PF2e effects for token:', selectedToken.id);
    }
  }

  /**
   * Clear effects for D&D 5e - SILENT VERSION
   * @private
   */
  static async _clearEffectsDnd5eSilent(selectedToken) {
    const effectsToRemove = selectedToken.actor.effects.filter((effect) => {
      return effect.flags?.[CONSTANTS.MODULE_ID]?.type;
    });

    if (effectsToRemove.length > 0) {
      const validEffectIds = effectsToRemove.map((effect) => effect.id);
      await selectedToken.actor.deleteEmbeddedDocuments('ActiveEffect', validEffectIds);
      console.log('TokenLightCondition | Cleared effects for token:', selectedToken.id);
    }
  }

  /**
   * Add a lighting effect to a token - SILENT VERSION
   * @private
   */
  static async _addEffectSilent(selectedToken, effectType) {
    if (!selectedToken?.actor) return;
    
    // Safety check for settings
    let addEffects = true;
    try {
      addEffects = game.settings.get(CONSTANTS.MODULE_ID, 'addEffects');
    } catch (error) {
      console.warn('TokenLightCondition | addEffects setting not available, defaulting to true');
    }
    
    if (!addEffects) return;

    const isPf2e = game.system.id === 'pf2e';
    if (isPf2e) await this._addPf2eEffectSilent(selectedToken, effectType);
    else await this._addCoreEffectSilent(selectedToken, effectType);
  }

  /**
   * Add effect for PF2e system - SILENT VERSION
   * @private
   */
  static async _addPf2eEffectSilent(selectedToken, effectType) {
    const effectName = game.i18n.localize(`TOKENLIGHTCONDITION.Effects.${effectType.charAt(0).toUpperCase() + effectType.slice(1)}.Name`);
    const effectItem = game.items.find((item) => item.name === effectName);
    if (effectItem) {
      await selectedToken.actor.createEmbeddedDocuments('Item', [effectItem]);
    }
  }

  /**
   * Add core status effect - SILENT VERSION
   * @private
   */
  static async _addCoreEffectSilent(selectedToken, effectType) {
    console.log(`TokenLightCondition | Creating ${effectType} effect for token:`, selectedToken.id);
    
    try {
      // Check for CPR integration
      if (game.modules.get('chris-premades')?.active && game.settings.get('chris-premades', 'effectInterface') === true) {
        const cprEffect = this._findCPREffect(effectType);
        if (cprEffect) {
          const effectData = cprEffect.toObject();
          effectData.statuses = [effectType];
          
          const effect = await ActiveEffect.create(effectData, { 
            keepId: true, 
            parent: selectedToken.actor
          });
          
          console.log(`TokenLightCondition | Created CPR ${effectType} effect:`, effect?.id);
          return effect;
        }
      }

      // Create standard ActiveEffect
      const effectData = CONSTANTS.getEffectData(effectType);
      if (!effectData) {
        console.error(`TokenLightCondition | Invalid effect type: ${effectType}`);
        return;
      }

      const effect = await ActiveEffect.create(effectData, {
        keepId: true,
        parent: selectedToken.actor
      });

      console.log(`TokenLightCondition | Created ${effectType} effect:`, effect?.id);
      return effect;
      
    } catch (error) {
      console.error(`TokenLightCondition | Error creating ${effectType} effect:`, error);
      throw error;
    }
  }

  /**
   * Find CPR effect by matching our module flags
   * @private
   */
  static _findCPREffect(effectType) {
    const cprItem = game.items.find((item) => item.flags['chris-premades']?.effectInterface);
    if (!cprItem) return null;
    const matchingEffect = cprItem.effects.find((effect) => effect.flags?.[CONSTANTS.MODULE_ID]?.type === effectType);
    return matchingEffect || null;
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
}