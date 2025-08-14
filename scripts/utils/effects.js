export class Effects {
  static dimIcon = 'icons/skills/melee/weapons-crossed-swords-black-gray.webp';
  static darkIcon = 'icons/skills/melee/weapons-crossed-swords-black.webp';
  static creatingEffects = new Set();

  static async initializeEffects() {
    const system_pf2e = game.system.id == 'pf2e';
    if (system_pf2e) await this.initializeEffects_pf2e();
    else await this.initializeEffects_dnd5e();
  }

  static async initializeEffects_dnd5e() {
    const source = game.settings.get('tokenlightcondition', 'effectSource');
    if (source === 'ce') {
      const ce = game.dfreds?.effectInterface;

      if (ce) {
        let ceDark = ce.findCustomEffectByName(game.i18n.localize('tokenlightcond-effect-dark'));
        if (!ceDark) {
          const dark = this.makeDarkEffectCE();
          ce.createNewCustomEffectsWith({ activeEffects: [dark] });
        }
        let ceDim = ce.findCustomEffectByName(game.i18n.localize('tokenlightcond-effect-dim'));
        if (!ceDim) {
          const dim = this.makeDimEffectCE();
          ce.createNewCustomEffectsWith({ activeEffects: [dim] });
        }
      }
    }
  }

  static async initializeEffects_pf2e() {
    const source = game.settings.get('tokenlightcondition', 'effectSource');
    console.log('TokenLightCondition | game.items (pf2e init):', game.items);
    const dim = game.items.find((e) => e.name === game.i18n.localize('tokenlightcond-effect-dim'));
    const dark = game.items.find((e) => e.name === game.i18n.localize('tokenlightcond-effect-dark'));
    if (!dim) {
      const dimData = this.pf2eCreateDimData_v13();
      let dimItem = await Item.create(dimData);
    }
    if (!dark) {
      const darkData = this.pf2eCreateDarkData_v13();
      let darkItem = await Item.create(darkData);
    }
  }

  static makeDarkEffectCE() {
    const dark = {
      label: game.i18n.localize('tokenlightcond-effect-dark'),
      icon: this.darkIcon,
      changes: [],
      flags: { convenientDescription: game.i18n.localize('tokenlightcond-effect-dark-desc') }
    };
    return dark;
  }

  static makeDimEffectCE() {
    const dim = {
      label: game.i18n.localize('tokenlightcond-effect-dim'),
      icon: this.dimIcon,
      changes: [],
      flags: { convenientDescription: game.i18n.localize('tokenlightcond-effect-dim-desc') }
    };
    return dim;
  }

  static pf2eCreateDimData_v13() {
    const dim = {
      name: game.i18n.localize('tokenlightcond-effect-dim'),
      type: 'effect',
      effects: [],
      system: {
        description: {
          gm: '',
          value: game.i18n.localize('tokenlightcond-effect-dim-desc')
        },
        rules: [
          {
            key: 'RollOption',
            option: 'lighting:dim-light'
          }
        ],
        slug: `tokenlightcondition-dim`,
        traits: {
          otherTags: [],
          value: []
        },
        level: {
          value: 0
        },
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
      img: 'systems/pf2e/icons/default-icons/character.svg',
      flags: {}
    };

    return dim;
  }

  static pf2eCreateDarkData_v13() {
    const dark = {
      name: game.i18n.localize('tokenlightcond-effect-dark'),
      type: 'effect',
      effects: [],
      system: {
        description: {
          gm: '',
          value: game.i18n.localize('tokenlightcond-effect-dark-desc')
        },
        rules: [
          {
            key: 'RollOption',
            option: 'lighting:darkness'
          }
        ],
        slug: `tokenlightcondition-dark`,
        traits: {
          otherTags: [],
          value: []
        },
        level: {
          value: 0
        },
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
      img: 'systems/pf2e/icons/default-icons/ancestry.svg',
      flags: {}
    };

    return dark;
  }

  static async clearEffects(selected_token) {
    const system_pf2e = game.system.id == 'pf2e';
    if (system_pf2e) await this.clearEffects_pf2e(selected_token);
    else await this.clearEffects_dnd5e(selected_token);
  }

  static async clearEffects_dnd5e(selected_token) {
    let foundEffects = true;
    while (foundEffects) {
      const dim = selected_token.actor.effects.find((e) => e.name === game.i18n.localize('tokenlightcond-effect-dim'));
      const dark = selected_token.actor.effects.find((e) => e.name === game.i18n.localize('tokenlightcond-effect-dark'));
      if (!dim && !dark) foundEffects = false;
      if (dim) await selected_token.actor.deleteEmbeddedDocuments('ActiveEffect', [dim.id]);
      if (dark) await selected_token.actor.deleteEmbeddedDocuments('ActiveEffect', [dark.id]);
    }
  }

  static async clearEffects_pf2e(selected_token) {
    let foundEffects = true;
    while (foundEffects) {
      const dim = selected_token.actor.items.find((e) => e.name === game.i18n.localize('tokenlightcond-effect-dim'));
      const dark = selected_token.actor.items.find((e) => e.name === game.i18n.localize('tokenlightcond-effect-dark'));
      if (!dim && !dark) foundEffects = false;
      if (dim) await selected_token.actor.deleteEmbeddedDocuments('Item', [dim.id]);
      if (dark) await selected_token.actor.deleteEmbeddedDocuments('Item', [dark.id]);
    }
  }

  static async addDark(selected_token) {
    const actorId = selected_token.actor.id;
    if (this.creatingEffects.has(actorId + '-dark')) return;

    this.creatingEffects.add(actorId + '-dark');
    try {
      const system_pf2e = game.system.id == 'pf2e';
      let dark = '';
      if (system_pf2e) dark = selected_token.actor.items.find((e) => e.name === game.i18n.localize('tokenlightcond-effect-dark'));
      else dark = selected_token.actor.effects.find((e) => e.name === game.i18n.localize('tokenlightcond-effect-dark'));
      const ce = game.dfreds?.effectInterface;
      const source = game.settings.get('tokenlightcondition', 'effectSource');
      if (!dark) {
        let added = false;
        if (source === 'ce') {
          if (ce) {
            await game.dfreds.effectInterface.addEffect({ effectName: game.i18n.localize('tokenlightcond-effect-dark'), uuid: selected_token.actor.uuid });
            added = true;
          }
        }
        if (source === 'ae') {
          await this.addDarkAE(selected_token);
          added = true;
        }
      }
    } finally {
      this.creatingEffects.delete(actorId + '-dark');
    }
  }

  static async addDim(selected_token) {
    const actorId = selected_token.actor.id;
    if (this.creatingEffects.has(actorId + '-dim')) return;
    this.creatingEffects.add(actorId + '-dim');
    try {
      const system_pf2e = game.system.id == 'pf2e';
      let dim = '';
      if (system_pf2e) dim = selected_token.actor.items.find((e) => e.name === game.i18n.localize('tokenlightcond-effect-dim'));
      else dim = selected_token.actor.effects.find((e) => e.name === game.i18n.localize('tokenlightcond-effect-dim'));
      const ce = game.dfreds?.effectInterface;
      const source = game.settings.get('tokenlightcondition', 'effectSource');
      if (!dim) {
        let added = false;
        if (source === 'ce') {
          if (ce) {
            await game.dfreds.effectInterface.addEffect({ effectName: game.i18n.localize('tokenlightcond-effect-dim'), uuid: selected_token.actor.uuid });
            added = true;
          }
        }
        if (source === 'ae') {
          await this.addDimAE(selected_token);
          added = true;
        }
      }
    } finally {
      this.creatingEffects.delete(actorId + '-dim');
    }
  }

  static async addDarkAE(selected_token) {
    const system_pf2e = game.system.id == 'pf2e';
    if (system_pf2e) await this.addDarkAE_pf2e(selected_token);
    else await this.addDarkAE_dnd5e(selected_token);
  }

  static async addDarkAE_dnd5e(selected_token) {
    const label = game.i18n.localize('tokenlightcond-effect-dark');
    let dark = selected_token.actor.effects.find((e) => e.name === label);
    if (!dark) {
      dark = {
        name: label,
        icon: this.darkIcon,
        description: game.i18n.localize('tokenlightcond-effect-dark-desc'),
        flags: {},
        statuses: [label.toLowerCase()],
        changes: []
      };
      try {
        await selected_token.actor.createEmbeddedDocuments('ActiveEffect', [dark]);
      } catch (error) {
        console.error('TokenLightCondition | Error creating dark effect:', error);
      }
    }
  }

  static async addDarkAE_pf2e(selected_token) {
    const label = game.i18n.localize('tokenlightcond-effect-dark');
    let dark = selected_token.actor.items.find((e) => e.name === label);
    if (!dark) {
      dark = game.items.find((e) => e.name === label);
      if (dark) {
        try {
          await selected_token.actor.createEmbeddedDocuments('Item', [dark]);
        } catch (error) {
          console.error('TokenLightCondition | Error creating dark effect:', error);
        }
      }
    }
  }

  static async addDimAE(selected_token) {
    const system_pf2e = game.system.id == 'pf2e';
    if (system_pf2e) await this.addDimAE_pf2e(selected_token);
    else await this.addDimAE_dnd5e(selected_token);
  }

  static async addDimAE_dnd5e(selected_token) {
    const label = game.i18n.localize('tokenlightcond-effect-dim');
    let dim = selected_token.actor.effects.find((e) => e.name === label);
    if (!dim) {
      dim = {
        name: label,
        icon: this.dimIcon,
        description: game.i18n.localize('tokenlightcond-effect-dim-desc'),
        flags: {},
        statuses: [label.toLowerCase()],
        changes: []
      };
      try {
        await selected_token.actor.createEmbeddedDocuments('ActiveEffect', [dim]);
      } catch (error) {
        console.error('TokenLightCondition | Error creating dim effect:', error);
      }
    }
  }

  static async addDimAE_pf2e(selected_token) {
    const label = game.i18n.localize('tokenlightcond-effect-dim');
    let dim = selected_token.actor.items.find((e) => e.name === label);
    if (!dim) {
      dim = game.items.find((e) => e.name === label);
      if (dim) {
        try {
          await selected_token.actor.createEmbeddedDocuments('Item', [dim]);
        } catch (error) {
          console.error('TokenLightCondition | Error creating dim effect:', error);
        }
      }
    }
  }
}
