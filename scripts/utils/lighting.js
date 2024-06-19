import { Core } from './core.js';
import { Effects } from './effects.js';

export class Lighting {

  static lightTable = {'dark':'DRK', 'dim':'DIM', 'bright':'BRT'};

  static async setDarknessThreshold(darknessLevel) {
    if (darknessLevel >= 0 && darknessLevel < 0.5) {
      return 'bright';
    } else if (darknessLevel >= 0.5 && darknessLevel < 0.75) {
      return 'dim';
    }
    return 'dark';
  }

  static setLightLevel(darknessLevel) {
    if (darknessLevel >= 0 && darknessLevel < 0.5) {
      return 2;
    } else if (darknessLevel >= 0.5 && darknessLevel < 0.75) {
      return 1;
    }
    return 0;
  }

  static async show_lightLevel_box(selected_token, tokenHUD, html) {
    if (Core.isValidActor(selected_token)) {
      if (selected_token.actor.system.attributes.hp?.value > 0) {
        // Determine lightLevel of the token (dark,dim,light)
        let boxString = this.lightTable[await this.find_token_lighting(selected_token)];

        const divToAdd = $('<input disabled id="lightL_scr_inp_box" title="Light Level" type="text" name="lightL_score_inp_box" value="' + boxString + '"></input>');
        html.find('.right').append(divToAdd);
      
        divToAdd.change(async (inputbox) => {
        });
      }
    }
  }

  static async show_lightLevel_player_box(selected_token, tokenHUD, html) {
    if (Core.isValidActor(selected_token)) {
      if (selected_token.actor.system.attributes.hp?.value > 0) {
        // Show the stored value lightLevel of the token (dark,dim,light)
        // only the GM should be processing the token light level.
        let storedResult = selected_token.actor.getFlag('tokenlightcondition','lightLevel');

        let boxString = this.lightTable[storedResult];

        const divToAdd = $('<input disabled id="lightL_scr_inp_box" title="Light Level" type="text" name="lightL_score_inp_box" value="' + boxString + '"></input>');
        html.find('.right').append(divToAdd);
      
        divToAdd.change(async (inputbox) => {
        });
      }
    }
  }

  static async check_token_lighting(placed_token) {
    if (game.user.isGM) {
      if (Core.isValidActor(placed_token)) {
        if (placed_token.actor.system.attributes.hp?.value > 0) {
          await this.find_token_lighting(placed_token);
        } else {
          Effects.clearEffects(placed_token);
        }
      }
    }
  }
  
  static async check_all_tokens_lightingRefresh() {
    let result = [];
    for (const placed_token of canvas.tokens.placeables) {
      result.push(await this.check_token_lighting(placed_token));
    }
    return result;
  }

  static async find_token_lighting(selected_token) {
    let lightLevel = 0;

    let globalConfig = game.settings.get('tokenlightcondition', 'globalIllumination');

    if (globalConfig) {
      // check global lighting
      let globalLight = false;
      let darkness = 1;
      if (game.version < 12) {
        globalLight = canvas.scene.globalLight;
        darkness = canvas.scene.darkness;
      } else {
        globalLight = canvas.scene.environment.globalLight.enabled;
        darkness = canvas.scene.environment.darknessLevel;
      }
      
      // without mods this can be null or disabled.
      let globalLightThreshold = 1;
      if (game.version < 12) {
        globalLightThreshold = canvas.scene.globalLightThreshold;
      } else {
        globalLightThreshold = canvas.scene.environment.globalLight.darkness.max;
      }

      // if field is empty (0-1), then the value is null, set the value to 1 for evaluation
      if (globalLightThreshold == null) {
        globalLightThreshold = 1;
      }
      let globalLightBright = true;

      if (globalLight) {
        if (globalLightThreshold) {
          if (darkness <= globalLightThreshold){
            // globallight is active
            if (!globalLightBright) { // perfect vision gives an option for bright/dim
              if (lightLevel < 1) {
                lightLevel = 1; // scene is set to dim
              }
            } else {
              lightLevel = 2; // scene is set to bright
            }
          }
        }
      }
    }

    const negativeLights = game.settings.get('tokenlightcondition', 'negativelights');
    if (lightLevel < 2 || negativeLights) {
      const lightSources = [...canvas.lighting.objects.children, ...canvas.tokens.placeables];
      const sortedLights = lightSources.sort((a,b) => (b.document.light ?? b.document.config).luminosity - (a.document.light ?? a.document.config).luminosity );
      for (const lightSource of sortedLights) {
        const isToken = Boolean(lightSource.light);
        let source = null;
        if (game.version < 12) {
          source = isToken ? lightSource.light : lightSource.source;
        } else {
          source = isToken ? lightSource.light : lightSource.lightSource;
        }
        if (source) {
          if (source.active) {
            let tokenDistance = Core.get_calculated_distance(selected_token, source);
            let lightDimDis = source.data.dim;
            let lightBrtDis = source.data.bright;
            const negativeLight = negativeLights && source.data.luminosity < 0;

            if (tokenDistance <= lightDimDis || tokenDistance <= lightBrtDis) {
              // If light has a reduced angle and possibly rotated...
              let inLight = true;
              const lightAngle = source.data.angle;
              if (lightAngle < 360) {
                let lightRotation = source.data.rotation;
                let angle = this.get_calculated_light_angle(selected_token, lightSource);

                // convert from +180/-180
                if (angle < 0) {angle += 360;}

                // find the difference between token angle and light rotation
                let adjustedAngle = Math.abs(angle - lightRotation);
                if (adjustedAngle > 180) {adjustedAngle = 360 - adjustedAngle;}
                
                // check if token is in the light wedge or not
                if (adjustedAngle > (lightAngle / 2)) {
                  inLight = false;
                }
              }

              // If the token is found to be within a potential light...
              if (inLight) {
                let foundWall = Core.get_wall_collision(selected_token, lightSource);

                if (!foundWall) {
                  // check for dim
                  if (tokenDistance <= lightDimDis && (lightDimDis > 0)) {
                    if (negativeLight && lightLevel > 1) {
                      lightLevel = 1;
                    }
                    else if ((lightLevel < 1) && !negativeLight) {
                      lightLevel = 1;
                    }
                  }
                  // check for bright
                  if (tokenDistance <= lightBrtDis && (lightBrtDis > 0)) {
                    if (negativeLight && lightLevel > 0) {
                      lightLevel = 0;
                    }
                    else if ((lightLevel < 2) && !negativeLight) {
                      lightLevel = 2;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // final results determine if effects need to be removed/applied.
    let lightLevelText = 'bright';
    let dark = '';
    let dim = '';
    let system_pf2e = (game.system.id == 'pf2e');
    if (system_pf2e) {
      switch (lightLevel) {
        case 0:
          lightLevelText = 'dark';
          let dark = selected_token.actor.items.find(e => e.name === game.i18n.localize('tokenlightcond-effect-dark'));
          if (!dark) {
            await Effects.clearEffects(selected_token);
            await Effects.addDark(selected_token);
          }
          break;
        case 1:
          lightLevelText = 'dim';
          let dim = selected_token.actor.items.find(e => e.name === game.i18n.localize('tokenlightcond-effect-dim'));
          if (!dim) {
            await Effects.clearEffects(selected_token);
            await Effects.addDim(selected_token);
          }
          break;
        case 2:
          lightLevelText = 'bright';
          await Effects.clearEffects(selected_token);
      }        
    } else {
      switch (lightLevel) {
        case 0:
          lightLevelText = 'dark';
          let dark = "";
          if (game.version < 12) {
            dark = selected_token.actor.effects.find(e => e.label === game.i18n.localize('tokenlightcond-effect-dark'));
          } else {
            dark = selected_token.actor.effects.find(e => e.name === game.i18n.localize('tokenlightcond-effect-dark'));
          }
          if (!dark) {
            await Effects.clearEffects(selected_token);
            await Effects.addDark(selected_token);
          }
          break;
        case 1:
          lightLevelText = 'dim';
          let dim = "";
          if (game.version < 12) {
            dim = selected_token.actor.effects.find(e => e.label === game.i18n.localize('tokenlightcond-effect-dim'));
          } else {
            dim = selected_token.actor.effects.find(e => e.name === game.i18n.localize('tokenlightcond-effect-dim'));
          }
          if (!dim) {
            await Effects.clearEffects(selected_token);
            await Effects.addDim(selected_token);
          }
          break;
        case 2:
          lightLevelText = 'bright';
          await Effects.clearEffects(selected_token);
      }        
  
    }
    await selected_token.actor.setFlag('tokenlightcondition', 'lightLevel', lightLevelText);
    
    let result = selected_token.actor.getFlag('tokenlightcondition','lightLevel')
    //Core.log(`${selected_token.actor.name} : ${result}`);

    return result;
  }

  // Check if Token is within defined range of another token i.e. Is friendly token within range of hostile token
  static get_calculated_light_distance(selected_token, placed_lights) {
    let elevated_distance = 0;
    let gridSize = canvas.grid.size;
    let gridDistance = canvas.scene.grid.distance;
    let z1Actual = 0;
    let z2Actual = 0;

    const x1 = selected_token.center.x;
    const y1 = selected_token.center.y;
    let z1 = selected_token.document.elevation;

    const x2 = placed_lights.center.x;
    const y2 = placed_lights.center.y;
    let z2 = 0;

    // If using Mod that adds elevation to light placements ( Levels for example )
    if (game.modules.get('levels')?.active) {
      if (placed_lights.document.flags['levels']) {
        let t = placed_lights.document.flags['levels'].rangeTop;
        let b = placed_lights.document.flags['levels'].rangeBottom;

        if (t == null) {t = 1000;}
        if (b == null) {b = -1000;}

        // for levels we should treat bottom as floor that can't be seen through

        if (z1 > t) {t = z1;}
        if (z1 < (b - 5)) {return 1000;} // Treat this as a floor
        
        // between top and bottom so, treat it as a pill
        // treat the light as being at the same level as the token for calculation
        if ((z1 > b) && (z1 < t)) {
          z2 = z1;
        }
      }
    }

    // convert elevation (ft) to canvas grid values
    z1Actual =  (z1 / gridDistance) * gridSize;
    z2Actual = (z2 / gridDistance) * gridSize;
    
    // Measure grid distance with elevation
    let e1 = Math.abs(x1 - x2);
    let e2 = Math.abs(y1 - y2);
    let e3 = Math.abs(z1Actual - z2Actual);
    let distance = Math.sqrt(e1*e1 + e2*e2 + e3*e3);

    elevated_distance = (distance / gridSize) * gridDistance;;

    return elevated_distance;
  }

  static get_calculated_light_angle(selected_token, placed_lights) {
    const a1 = placed_lights.center.x;
    const a2 = placed_lights.center.y;
    const b1 = selected_token.center.x;
    const b2 = selected_token.center.y;

    if (selected_token.center == placed_lights.center) {
      return 0;
    }

    let angle = Math.atan2(a1-b1, b2-a2) * ( 180 / Math.PI);

    return angle;
  }
}