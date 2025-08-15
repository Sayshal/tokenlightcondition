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
    if (isPf2e) {
      await this._initializeEffectsPf2e();
    }
    // For D&D 5e, we use core status effects which are set up in main.js
  }

  /**
   * Initialize effects for PF2e system
   * @private
   */
  static async _initializeEffectsPf2e() {
    const effects = ['dim', 'dark'];
    const itemsToCreate = [];

    for (const effectType of effects) {
      const localizedName = game.i18n.localize(`tokenlightcond-effect-${effectType}`);
      const existingItem = game.items.find((item) => item.name === localizedName);
      if (!existingItem) {
        const itemData = this._createPf2eEffectData(effectType);
        itemsToCreate.push(itemData);
      }
    }

    if (itemsToCreate.length > 0) {
      await Item.createDocuments(itemsToCreate);
    }
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

    return {
      name: game.i18n.localize(`tokenlightcond-effect-${effectType}`),
      type: 'effect',
      effects: [],
      system: {
        description: {
          gm: '',
          value: game.i18n.localize(`tokenlightcond-effect-${effectType}-desc`)
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
  }

  /**
   * Clear all lighting effects from a token
   * @param {Token} selectedToken - The token to clear effects from
   */
  static async clearEffects(selectedToken) {
    if (!selectedToken?.actor) return;

    const isPf2e = game.system.id === 'pf2e';

    if (isPf2e) {
      await this._clearEffectsPf2e(selectedToken);
    } else {
      await this._clearCoreEffects(selectedToken);
    }
  }

  /**
   * Clear effects for PF2e
   * @param {Token} selectedToken - The token to clear effects from
   * @private
   */
  static async _clearEffectsPf2e(selectedToken) {
    const effectNames = ['dim', 'dark'].map((type) => game.i18n.localize(`tokenlightcond-effect-${type}`));

    let foundEffects = true;
    while (foundEffects) {
      const itemsToRemove = selectedToken.actor.items.filter((item) => effectNames.includes(item.name));
      if (itemsToRemove.length === 0) {
        foundEffects = false;
      } else {
        const itemIds = itemsToRemove.map((item) => item.id);
        await selectedToken.actor.deleteEmbeddedDocuments('Item', itemIds);
      }
    }
  }

  /**
   * Clear core status effects from a token
   * @param {Token} selectedToken - The token to clear effects from
   * @private
   */
  static async _clearCoreEffects(selectedToken) {
    const effectNames = ['dim', 'dark'].map((type) => game.i18n.localize(`tokenlightcond-effect-${type}`));
    const statusIds = ['dark', 'dim'];

    let foundEffects = true;
    while (foundEffects) {
      const effectsToRemove = selectedToken.actor.effects.filter(
        (effect) => effectNames.includes(effect.name) || statusIds.some((status) => effect.statuses?.has(status)) || effect.flags?.[CONSTANTS.MODULE_ID]?.type
      );

      if (effectsToRemove.length === 0) {
        foundEffects = false;
      } else {
        const effectIds = effectsToRemove.map((effect) => effect.id);
        await selectedToken.actor.deleteEmbeddedDocuments('ActiveEffect', effectIds);
      }
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

    // Check if effects are enabled
    const addEffects = game.settings.get(CONSTANTS.MODULE_ID, 'addEffects');
    if (!addEffects) return;

    const lockKey = `${selectedToken.actor.id}-${effectType}`;
    if (this.creatingEffects.has(lockKey)) return;

    this.creatingEffects.add(lockKey);

    try {
      const isPf2e = game.system.id === 'pf2e';
      const effectName = game.i18n.localize(`tokenlightcond-effect-${effectType}`);

      // Check if effect already exists
      const existingEffect =
        isPf2e ?
          selectedToken.actor.items.find((item) => item.name === effectName)
        : selectedToken.actor.effects.find((effect) => effect.name === effectName || effect.statuses?.has(effectType) || effect.flags?.[CONSTANTS.MODULE_ID]?.type === effectType);

      if (existingEffect) return;

      if (isPf2e) {
        await this._addPf2eEffect(selectedToken, effectName);
      } else {
        await this._addCoreEffect(selectedToken, effectType);
      }
    } finally {
      this.creatingEffects.delete(lockKey);
    }
  }

  /**
   * Add effect for PF2e system
   * @param {Token} selectedToken - The token
   * @param {string} effectName - The localized effect name
   * @private
   */
  static async _addPf2eEffect(selectedToken, effectName) {
    const effectItem = game.items.find((item) => item.name === effectName);
    if (effectItem) {
      try {
        await selectedToken.actor.createEmbeddedDocuments('Item', [effectItem]);
      } catch (error) {
        console.error(`TokenLightCondition | Error creating PF2e effect: ${error}`);
      }
    }
  }

  /**
   * Add core status effect
   * @param {Token} selectedToken - The token
   * @param {string} effectType - The effect type
   * @private
   */
  static async _addCoreEffect(selectedToken, effectType) {
    try {
      const effectName = game.i18n.localize(`tokenlightcond-effect-${effectType}`);
      const effectData = {
        name: effectName,
        icon: CONSTANTS.ICONS[effectType],
        description: game.i18n.localize(`tokenlightcond-effect-${effectType}-desc`),
        statuses: [effectType],
        changes: [],
        flags: {
          [CONSTANTS.MODULE_ID]: {
            type: effectType
          }
        }
      };

      await selectedToken.actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
    } catch (error) {
      console.error(`TokenLightCondition | Error creating core effect: ${error}`);
    }
  }
}
