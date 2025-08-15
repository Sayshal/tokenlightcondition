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
    const isPf2e = game.system.id === 'pf2e';
    const source = game.settings.get(CONSTANTS.MODULE_ID, 'effectSource');
    if (isPf2e) await this.initializeEffectsPf2e();
    else if (source === 'cpr') await this.initializeEffectsCPR();
    else await this.initializeEffectsDnd5e();
  }

  /**
   * Initialize effects for D&D 5e system
   * @private
   */
  static async initializeEffectsDnd5e() {
    const source = game.settings.get(CONSTANTS.MODULE_ID, 'effectSource');
    if (source !== 'ce') return;
    const ce = game.dfreds?.effectInterface;
    if (!ce) return;
    const effects = ['dark', 'dim'];
    const effectsToCreate = [];
    for (const effectType of effects) {
      const localizedName = game.i18n.localize(`tokenlightcond-effect-${effectType}`);
      const existingEffect = ce.findCustomEffectByName(localizedName);
      if (!existingEffect) {
        const effect = this._createConvenientEffect(effectType);
        effectsToCreate.push(effect);
      }
    }
    if (effectsToCreate.length > 0) ce.createNewCustomEffectsWith({ activeEffects: effectsToCreate });
  }

  /**
   * Initialize effects for PF2e system
   * @private
   */
  static async initializeEffectsPf2e() {
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
    if (itemsToCreate.length > 0) await Item.createDocuments(itemsToCreate);
  }

  /**
   * Initialize effects for CPR (Cauldron of Plentiful Resources)
   * @private
   */
  static async initializeEffectsCPR() {
    /** Currently unused */
  }

  /**
   * Add an effect to a token
   * @param {Token} selectedToken - The token to add effect to
   * @param {string} effectType - The type of effect ('dark' or 'dim')
   */
  static async addEffect(selectedToken, effectType) {
    if (!selectedToken?.actor) return;
    const lockKey = `${selectedToken.id}-${effectType}`;
    if (this.creatingEffects.has(lockKey)) return;
    this.creatingEffects.add(lockKey);

    try {
      const effectName = game.i18n.localize(`tokenlightcond-effect-${effectType}`);
      const isPf2e = game.system.id === 'pf2e';
      const existingEffect = isPf2e ? selectedToken.actor.items.find((item) => item.name === effectName) : selectedToken.actor.effects.find((effect) => effect.name === effectName);
      if (existingEffect) return;

      const source = game.settings.get(CONSTANTS.MODULE_ID, 'effectSource');
      if (source === 'ce') await this._addConvenientEffect(selectedToken, effectName);
      else if (source === 'cpr') await this._addCPREffect(selectedToken, effectType);
      else if (source === 'ae') await this._addActiveEffect(selectedToken, effectType, isPf2e);
    } finally {
      this.creatingEffects.delete(lockKey);
    }
  }

  /**
   * Add effect using CPR (Cauldron of Plentiful Resources)
   * @param {Token} selectedToken - The token
   * @param {string} effectType - The effect type
   * @private
   */
  static async _addCPREffect(selectedToken, effectType) {
    const cpr = game.modules.get('chris-premades');
    if (!cpr?.active) return;

    try {
      const effectName = game.i18n.localize(`tokenlightcond-effect-${effectType}`);
      const statusId = effectName.toLowerCase().slugify();

      // Use CPR's effectUtils to apply the status effect
      if (window.chrisPremades?.utils?.effectUtils?.applyConditions) {
        await window.chrisPremades.utils.effectUtils.applyConditions(selectedToken.actor, [statusId]);
      } else {
        // Fallback: Create as standard status effect that CPR can pick up
        const effectData = {
          name: effectName,
          icon: CONSTANTS.ICONS[effectType],
          description: game.i18n.localize(`tokenlightcond-effect-${effectType}-desc`),
          statuses: [statusId],
          changes: [],
          flags: {
            'chris-premades': {
              'tlc-effect': true
            }
          }
        };
        await selectedToken.actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
      }
    } catch (error) {
      console.error(`TokenLightCondition | Error adding CPR effect: ${error}`);
    }
  }

  /**
   * Create a Convenient Effects effect object
   * @param {string} effectType - The type of effect ('dark' or 'dim')
   * @returns {Object} The effect object
   * @private
   */
  static _createConvenientEffect(effectType) {
    return {
      label: game.i18n.localize(`tokenlightcond-effect-${effectType}`),
      icon: CONSTANTS.ICONS[effectType],
      changes: [],
      flags: { convenientDescription: game.i18n.localize(`tokenlightcond-effect-${effectType}-desc`) }
    };
  }

  /**
   * Create PF2e effect data
   * @param {string} effectType - The type of effect ('dark' or 'dim')
   * @returns {Object} The PF2e effect data
   * @private
   */
  static _createPf2eEffectData(effectType) {
    const isoDark = effectType === 'dark';
    const rulOption = isoDark ? 'lighting:darkness' : 'lighting:dim-light';
    const icon = isoDark ? 'systems/pf2e/icons/default-icons/ancestry.svg' : 'systems/pf2e/icons/default-icons/character.svg';
    return {
      name: game.i18n.localize(`tokenlightcond-effect-${effectType}`),
      type: 'effect',
      effects: [],
      system: {
        description: {
          gm: '',
          value: game.i18n.localize(`tokenlightcond-effect-${effectType}-desc`)
        },
        rules: [{ key: 'RollOption', option: rulOption }],
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
    const source = game.settings.get(CONSTANTS.MODULE_ID, 'effectSource');
    const isPf2e = game.system.id === 'pf2e';
    if (source === 'ce') await this._clearConvenientEffects(selectedToken);
    else if (source === 'cpr') await this._clearCPREffects(selectedToken);
    else if (source === 'ae') await this._clearActiveEffects(selectedToken, isPf2e);
  }

  /**
   * Clear CPR effects from a token
   * @param {Token} selectedToken - The token
   * @private
   */
  static async _clearCPREffects(selectedToken) {
    const effects = ['dark', 'dim'];
    const effectsToRemove = [];
    for (const effectType of effects) {
      const effectName = game.i18n.localize(`tokenlightcond-effect-${effectType}`);
      const statusId = effectName.toLowerCase().slugify();
      // Find effects with our status or flag
      const effect = selectedToken.actor.effects.find((e) => e.statuses?.has(statusId) || e.flags?.['chris-premades']?.['tlc-effect']);
      if (effect) effectsToRemove.push(effect.id);
    }
    if (effectsToRemove.length > 0) await selectedToken.actor.deleteEmbeddedDocuments('ActiveEffect', effectsToRemove);
  }

  /**
   * Clear effects for D&D 5e
   * @param {Token} selectedToken - The token to clear effects from
   * @private
   */
  static async _clearEffectsDnd5e(selectedToken) {
    const effectNames = ['dim', 'dark'].map((type) => game.i18n.localize(`tokenlightcond-effect-${type}`));
    let foundEffects = true;
    while (foundEffects) {
      const effectsToRemove = selectedToken.actor.effects.filter((effect) => effectNames.includes(effect.name));
      if (effectsToRemove.length === 0) {
        foundEffects = false;
      } else {
        const effectIds = effectsToRemove.map((effect) => effect.id);
        await selectedToken.actor.deleteEmbeddedDocuments('ActiveEffect', effectIds);
      }
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
    const actorId = selectedToken.actor.id;
    const lockKey = `${actorId}-${effectType}`;
    if (this.creatingEffects.has(lockKey)) return;
    this.creatingEffects.add(lockKey);
    try {
      const isPf2e = game.system.id === 'pf2e';
      const effectName = game.i18n.localize(`tokenlightcond-effect-${effectType}`);

      // Check if effect already exists
      const existingEffect = isPf2e ? selectedToken.actor.items.find((item) => item.name === effectName) : selectedToken.actor.effects.find((effect) => effect.name === effectName);
      if (existingEffect) return;
      const source = game.settings.get(CONSTANTS.MODULE_ID, 'effectSource');
      if (source === 'ce') await this._addConvenientEffect(selectedToken, effectName);
      else if (source === 'ae') await this._addActiveEffect(selectedToken, effectType, isPf2e);
    } finally {
      this.creatingEffects.delete(lockKey);
    }
  }

  /**
   * Add effect using Convenient Effects
   * @param {Token} selectedToken - The token
   * @param {string} effectName - The localized effect name
   * @private
   */
  static async _addConvenientEffect(selectedToken, effectName) {
    const ce = game.dfreds?.effectInterface;
    if (!ce) return;
    try {
      await ce.addEffect({
        effectName,
        uuid: selectedToken.actor.uuid
      });
    } catch (error) {
      console.error(`TokenLightCondition | Error adding convenient effect: ${error}`);
    }
  }

  /**
   * Add active effect directly
   * @param {Token} selectedToken - The token
   * @param {string} effectType - The effect type
   * @param {boolean} isPf2e - Whether this is PF2e system
   * @private
   */
  static async _addActiveEffect(selectedToken, effectType, isPf2e) {
    const effectName = game.i18n.localize(`tokenlightcond-effect-${effectType}`);
    try {
      if (isPf2e) {
        const effectItem = game.items.find((item) => item.name === effectName);
        if (effectItem) await selectedToken.actor.createEmbeddedDocuments('Item', [effectItem]);
      } else {
        const effectData = {
          name: effectName,
          icon: CONSTANTS.ICONS[effectType],
          description: game.i18n.localize(`tokenlightcond-effect-${effectType}-desc`),
          flags: {},
          statuses: [effectName.toLowerCase()],
          changes: []
        };
        await selectedToken.actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
      }
    } catch (error) {
      console.error(`TokenLightCondition | Error creating ${effectType} effect: ${error}`);
    }
  }
}
