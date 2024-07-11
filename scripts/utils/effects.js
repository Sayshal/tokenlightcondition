import { Core } from './core.js';

export class Effects {

  static dimIcon = 'icons/skills/melee/weapons-crossed-swords-black-gray.webp';
  static darkIcon = 'icons/skills/melee/weapons-crossed-swords-black.webp';

  static async initializeEffects() {
    const system_pf2e = (game.system.id == 'pf2e');

    if (system_pf2e) {
      await this.initializeEffects_pf2e();
    } else {
      await this.initializeEffects_dnd5e();
    }
  }

  static async initializeEffects_dnd5e() {
    const source = game.settings.get('tokenlightcondition', 'effectSource');

    if (source === 'ce') {
      const ce = game.dfreds?.effectInterface;
      // create CE effects

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

    const dim = game.items.find(e => e.name === game.i18n.localize('tokenlightcond-effect-dim'));
    const dark = game.items.find(e => e.name === game.i18n.localize('tokenlightcond-effect-dark'));

    if (!dim) {
      Core.log("Create pf2e Dim Effect Item");
      let dimData = '';
      if (game.version < 12) {
        dimData = this.pf2eCreateDimData();
      } else {
        dimData = this.pf2eCreateDimData_v12();
      }
      let dimItem = await Item.create(dimData);
    }

    if (!dark) {
      Core.log("Create pf2e Dark Effect Item");
      let darkData = '';
      if (game.version < 12) {
        darkData = this.pf2eCreateDarkData();
      } else {
        darkData = this.pf2eCreateDarkData_v12();
      }
      let darkItem = await Item.create(darkData);
    }
  }

  static makeDarkEffectCE() {
    const dark = {
      label: game.i18n.localize('tokenlightcond-effect-dark'),
      icon: this.darkIcon,
      changes: [],
      flags: { convenientDescription: game.i18n.localize('tokenlightcond-effect-dark-desc') },
    };

    return dark;
  }

  static makeDimEffectCE() {
    const dim = {
      label: game.i18n.localize('tokenlightcond-effect-dim'),
      icon: this.dimIcon,
      changes: [],
      flags: { convenientDescription: game.i18n.localize('tokenlightcond-effect-dim-desc') },
    };

    return dim;
  }

  static pf2eCreateDimData() {
    const dim = {
      type: 'effect',
      name: game.i18n.localize('tokenlightcond-effect-dim'),
      img: 'systems/pf2e/icons/default-icons/character.svg',
      data: {
        tokenIcon: { show: true },
        duration: {
          value: 1,
          unit: 'unlimited',
          sustained: false,
          expiry: 'turn-start',
        },
        description: {
          value: game.i18n.localize('tokenlightcond-effect-dim-desc'),
        },
        "rules": [
          {
            "key": "RollOption",
            "option": "lighting:dim-light"
          }
        ],
        unidentified: true,
        traits: {
          custom: '',
          rarity: 'common',
          value: [],
        },
        level: {
          value: 0,
        },
        source: {
          value: '',
        },
        slug: `tokenlightcondition-dim`,
      },
      flags: {}
    }

    return dim
  }

  static pf2eCreateDarkData() {
    const dark = {
      type: 'effect',
      name: game.i18n.localize('tokenlightcond-effect-dark'),
      img: 'systems/pf2e/icons/default-icons/ancestry.svg',
      data: {
        tokenIcon: { show: true },
        duration: {
          value: 1,
          unit: 'unlimited',
          sustained: false,
          expiry: 'turn-start',
        },
        description: {
          value: game.i18n.localize('tokenlightcond-effect-dark-desc'),
        },
        "rules": [
          {
            "key": "RollOption",
            "option": "lighting:darkness"
          }
        ],
        unidentified: true,
        traits: {
          custom: '',
          rarity: 'common',
          value: [],
        },
        level: {
          value: 0,
        },
        source: {
          value: '',
        },
        slug: `tokenlightcondition-dark`,
      },
      flags: {}
    }

    return dark;
  }

  static pf2eCreateDimData_v12() {
    const dim = {
      "name": game.i18n.localize('tokenlightcond-effect-dim'),
      "type": 'effect',
      "effects": [],
      "system": {
        "description": {
          "gm": "",
          "value": game.i18n.localize('tokenlightcond-effect-dim-desc')
        },
        "rules": [
          {
            "key": "RollOption",
            "option": "lighting:dim-light"
          }
        ],
        "slug": `tokenlightcondition-dim`,
        "traits": {
          "otherTags": [],
          "value": []
        },
        "level": {
          "value": 0
        },
        "duration": {
          "value": 1,
          "unit": 'unlimited',
          "expiry": 'turn-start',
          "sustained": false
        },
        "tokenIcon": { "show": true },
        "badge": null,
        "context": null,
        "unidentified": true,
      },
      "img": 'systems/pf2e/icons/default-icons/character.svg',
      "flags": {}
    }

    return dim
  }

  static pf2eCreateDarkData_v12() {
    const dark = {
      "name": game.i18n.localize('tokenlightcond-effect-dark'),
      "type": 'effect',
      "effects": [],
      "system": {
        "description": {
          "gm": "",
          "value": game.i18n.localize('tokenlightcond-effect-dark-desc')
        },
        "rules": [
          {
            "key": "RollOption",
            "option": "lighting:darkness"
          }
        ],
        "slug": `tokenlightcondition-dark`,
        "traits": {
          "otherTags": [],
          "value": []
        },
        "level": {
          "value": 0
        },
        "duration": {
          "value": 1,
          "unit": 'unlimited',
          "expiry": 'turn-start',
          "sustained": false
        },
        "tokenIcon": { "show": true },
        "badge": null,
        "context": null,
        "unidentified": true,
      },
      "img": 'systems/pf2e/icons/default-icons/ancestry.svg',
      "flags": {}
    }

    return dark;
  }

  static async clearEffects(selected_token) {
    const system_pf2e = (game.system.id == 'pf2e');

    if (system_pf2e) {
      await this.clearEffects_pf2e(selected_token);
    } else {
      await this.clearEffects_dnd5e(selected_token);
    }
  }

  static async clearEffects_dnd5e(selected_token){
    let foundEffects = true;

    // edge case, if there are multiple effects on the token
    while (foundEffects) {
      let dim = "";
      let dark = "";
      if (game.version < 12) {
        dim = selected_token.actor.effects.find(e => e.label === game.i18n.localize('tokenlightcond-effect-dim'));
        dark = selected_token.actor.effects.find(e => e.label === game.i18n.localize('tokenlightcond-effect-dark'));
      } else {
        dim = selected_token.actor.effects.find(e => e.name === game.i18n.localize('tokenlightcond-effect-dim'));
        dark = selected_token.actor.effects.find(e => e.name === game.i18n.localize('tokenlightcond-effect-dark'));
      }

      if (!dim && !dark) {
        foundEffects = false;
      }

      if (dim) {
        await selected_token.actor.deleteEmbeddedDocuments('ActiveEffect', [dim.id])
      }

      if (dark) {
        await selected_token.actor.deleteEmbeddedDocuments('ActiveEffect', [dark.id])
      }
    }
  }

  static async clearEffects_pf2e(selected_token) {
    let foundEffects = true;

    // edge case, if there are multiple effects on the token
    while (foundEffects) {
      const dim = selected_token.actor.items.find(e => e.name === game.i18n.localize('tokenlightcond-effect-dim'));
      const dark = selected_token.actor.items.find(e => e.name === game.i18n.localize('tokenlightcond-effect-dark'));

      if (!dim && !dark) {
        foundEffects = false;
      }

      if (dim) {
        await selected_token.actor.deleteEmbeddedDocuments('Item', [dim.id]);
      }

      if (dark) {
        await selected_token.actor.deleteEmbeddedDocuments('Item', [dark.id])
      }
    }
  }

  static async addDark(selected_token) {
    const system_pf2e = (game.system.id == 'pf2e');
    let dark = '';
    if (system_pf2e) {
      dark = await selected_token.actor.items.find(e => e.name === game.i18n.localize('tokenlightcond-effect-dark'));
    } else {
      if (game.version < 12) {
        dark = await selected_token.actor.effects.find(e => e.label === game.i18n.localize('tokenlightcond-effect-dark'));
      } else {
        dark = await selected_token.actor.effects.find(e => e.name === game.i18n.localize('tokenlightcond-effect-dark'));
      }
    }

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

      if (added) {
        Core.log(`Dark added: ${selected_token.actor.name} via ${source}`);
      }
    }
  }

  static async addDim(selected_token) {
    const system_pf2e = (game.system.id == 'pf2e');
    let dim = '';
    if (system_pf2e) {
      dim = await selected_token.actor.items.find(e => e.name === game.i18n.localize('tokenlightcond-effect-dim'));
    } else {
      if (game.version < 12) {
        dim = await selected_token.actor.effects.find(e => e.label === game.i18n.localize('tokenlightcond-effect-dim'));
      } else {
        dim = await selected_token.actor.effects.find(e => e.name === game.i18n.localize('tokenlightcond-effect-dim'));
      }
    }

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

      if (added) {
        Core.log(`Dim added: ${selected_token.actor.name} via ${source}`);
      }
    }
  }

  static async addDarkAE(selected_token) {
    // If we haven't found an ouside source, create the default one
    const system_pf2e = (game.system.id == 'pf2e');
    if (system_pf2e) {
      await this.addDarkAE_pf2e(selected_token);
    } else {
      await this.addDarkAE_dnd5e(selected_token);
    }
  }

  static async addDarkAE_dnd5e(selected_token) {
    const label = game.i18n.localize('tokenlightcond-effect-dark');
    let dark = "";
    if (game.version < 12) {
      dark = selected_token.actor.effects.find(e => e.label === label);
    } else {
      dark = selected_token.actor.effects.find(e => e.name === label);
    }

    if (!dark) {
      if (game.version < 12) {
        dark = {
          label: label,
          icon: this.darkIcon,
          changes: [],
          flags: { convenientDescription: game.i18n.localize('tokenlightcond-effect-dark-desc') },
        };
      } else {
        dark = {
          name: label,
          icon: this.darkIcon,
          description: game.i18n.localize('tokenlightcond-effect-dark-desc'),
          flags: {},
          statuses: [label.toLowerCase()],
          changes: [],
        };
      }
    }

    if (game.version < 12) {
      dark.flags['core.statusId'] = '1';
    }
    await selected_token.actor.createEmbeddedDocuments('ActiveEffect', [dark]);
  }

  static async addDarkAE_pf2e(selected_token) {
    const label = game.i18n.localize('tokenlightcond-effect-dark');
    let dark = selected_token.actor.items.find(e => e.name === label);

    if (!dark) {
      dark = game.items.find(e => e.name === label);
    }

    if (game.version < 12) {
      dark.flags['core.statusId'] = '1';
    }
    await selected_token.actor.createEmbeddedDocuments('Item', [dark]);
  }

  static async addDimAE(selected_token) {
    // If we haven't found an ouside source, create the default one
    const system_pf2e = (game.system.id == 'pf2e');
    if (system_pf2e) {
      await this.addDimAE_pf2e(selected_token);
    } else {
      await this.addDimAE_dnd5e(selected_token);
    }
  }

  static async addDimAE_dnd5e(selected_token) {
    // If we haven't found an ouside source, create the default one
    const label = game.i18n.localize('tokenlightcond-effect-dim');
    let dim = "";
    if (game.version < 12) {
      dim = selected_token.actor.effects.find(e => e.label === label);
    } else {
      dim = selected_token.actor.effects.find(e => e.name === label);
    }

    if (!dim) {
      if (game.version < 12) {
        dim = {
          label: label,
          icon: this.dimIcon,
          changes: [],
          flags: { convenientDescription: game.i18n.localize('tokenlightcond-effect-dim-desc') },
        };
      } else {
        dim = {
          name: label,
          icon: this.dimIcon,
          description: game.i18n.localize('tokenlightcond-effect-dim-desc'),
          flags: {},
          statuses: [label.toLowerCase()],
          changes: [],
        };
      }
    }

    if (game.version < 12) {
      dim.flags['core.statusId'] = '1';
    }
    await selected_token.actor.createEmbeddedDocuments('ActiveEffect', [dim]);
  }

  static async addDimAE_pf2e(selected_token) {
    // If we haven't found an ouside source, create the default one
    const label = game.i18n.localize('tokenlightcond-effect-dim');
    let dim = selected_token.actor.items.find(e => e.name === label);

    if (!dim) {
      dim = game.items.find(e => e.name === label);
    }

    if (game.version < 12) {
      dim.flags['core.statusId'] = '1';
    }
    await selected_token.actor.createEmbeddedDocuments('Item', [dim]);
  }
}
