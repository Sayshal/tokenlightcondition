import { Effects } from './effects.js';
import { Lighting } from './lighting.js';

export class Core {
  static CONSOLE_COLORS = ['background: #222; color: #ff80ff', 'color: #fff'];
  static HEADER = `<b>Token Light Condition:</b> `;

  static checkModuleState() {
    let enableSetting = game.settings.get('tokenlightcondition', 'enable');
    if (enableSetting) return true;
    else return false;
  }

  static async toggleTokenLightCond(toggled) {
    await game.settings.set('tokenlightcondition', 'enable', toggled);
    if (game.user.isGM) {
      let enableSetting = game.settings.get('tokenlightcondition', 'enable');
      if (enableSetting) await Lighting.check_all_tokens_lightingRefresh();
      else for (const placed_token of canvas.tokens.placeables) if (this.isValidActor(placed_token)) await Effects.clearEffects(placed_token);
    }
  }

  static async initialize_token(token) {
    if (game.user.isGM) {
      await token.actor.setFlag('tokenlightcondition');
      Lighting.check_token_lighting(token);
    }
  }

  static isValidActor(selected_token) {
    if (selected_token.actor) {
      if (selected_token.actor.type == 'character' || selected_token.actor.type == 'npc') {
        if (!selected_token.actor.flags['tokenlightcondition']) this.initialize_token(selected_token);
        return true;
      }
    }
    return false;
  }

  static find_token_by_token_id(token_id) {
    for (const placed_token of canvas.tokens.placeables) {
      if (placed_token.id == token_id) return placed_token;
    }
    return;
  }

  static find_token_by_actor_id(token_id) {
    for (const placed_token of canvas.tokens.placeables) {
      if (placed_token.actor.id == token_id) return placed_token;
    }
    return;
  }

  static find_token_by_user_char_id(actor_id) {
    for (const placed_token of canvas.tokens.placeables) {
      if (placed_token.actor.id == game.user.character.id) return placed_token;
    }
    return;
  }

  static find_selected_token(tokenHUD) {
    let index_of_token = 0;
    if (canvas.tokens.controlled.length > 1) {
      let token_with_hud_open = canvas.tokens.controlled.find((token) => token.id == tokenHUD.object.actor.token.id);
      index_of_token = canvas.tokens.controlled.indexOf(token_with_hud_open);
    }
    return canvas.tokens.controlled[index_of_token];
  }

  static get_calculated_distance(selected_token, light_source) {
    let gridSize = canvas.grid.size;
    let gridDistance = canvas.scene.grid.distance;
    const x1 = selected_token.center.x;
    const y1 = selected_token.center.y;
    const z1 = (selected_token.document.elevation / gridDistance) * gridSize;
    const x2 = light_source.x;
    const y2 = light_source.y;
    const z2 = (light_source.elevation / gridDistance) * gridSize;
    let e1 = Math.abs(x1 - x2);
    let e2 = Math.abs(y1 - y2);
    let e3 = Math.abs(z1 - z2);
    const distance = Math.sqrt(e1 * e1 + e2 * e2 + e3 * e3);
    return distance;
  }

  static get_wall_collision(selected_token, targetObject) {
    let testResult = CONFIG.Canvas.polygonBackends['sight'].testCollision(selected_token.center, targetObject.center, { type: 'sight', mode: 'all' });
    if (testResult.length == 0) return false;
    else return true;
  }

  static isWithinDrawing(drawingShape, token) {
    let tokenPosition = token.center;
    let x = drawingShape.x;
    let y = drawingShape.y;
    let width = drawingShape.shape.width;
    let height = drawingShape.shape.height;
    let type = drawingShape.shape.type;
    if (drawingShape.rotation != 0) {
      let drawing_center = [x + 0.5 * width, y + 0.5 * height];
      tokenPosition = {
        x:
          Math.cos((-drawingShape.rotation * Math.PI) / 180) * (tokenPosition.x - drawing_center[0]) -
          Math.sin((-drawingShape.rotation * Math.PI) / 180) * (tokenPosition.y - drawing_center[1]) +
          drawing_center[0],
        y:
          Math.sin((-drawingShape.rotation * Math.PI) / 180) * (tokenPosition.x - drawing_center[0]) +
          Math.cos((-drawingShape.rotation * Math.PI) / 180) * (tokenPosition.y - drawing_center[1]) +
          drawing_center[1]
      };
    }

    if (Number.between(tokenPosition.x, x, x + width) && Number.between(tokenPosition.y, y, y + height)) {
      if (type == 'r') {
        return true;
      } else if (type == 'e') {
        return (tokenPosition.x - x - 0.5 * width) ** 2 * (0.5 * height) ** 2 + (tokenPosition.y - y - 0.5 * height) ** 2 * (0.5 * width) ** 2 <= (0.5 * width) ** 2 * (0.5 * height) ** 2;
      } else if (type == 'p' || type == 'f') {
        let vertices = [];
        for (let i = 0; i < drawingShape.shape.points.length; i++) {
          if (i % 2) vertices.push([drawingShape.shape.points[i - 1] + x, drawingShape.shape.points[i] + y]);
        }
        let isInside = false;
        let i = 0,
          j = vertices.length - 1;
        for (i, j; i < vertices.length; j = i++) {
          if (
            vertices[i][1] > tokenPosition.y != vertices[j][1] > tokenPosition.y &&
            tokenPosition.x((vertices[j][0] - vertices[i][0]) * (tokenPosition.y - vertices[i][1])) / (vertices[j][1] - vertices[i][1]) + vertices[i][0]
          ) {
            isInside = !isInside;
          }
        }
        return isInside;
      } else {
        return true;
      }
    } else {
      return false;
    }
  }
}
