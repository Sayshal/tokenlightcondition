import { MODULE, VALID_ACTOR_TYPES } from './constants.mjs';

/**
 * Whether a token contributes light to the scene
 * @param {object} tokenDocument - The TokenDocument to test
 * @returns {boolean} True when the token emits light or darkness
 */
export function emitsLight(tokenDocument) {
  const light = tokenDocument.light;
  return Boolean(light?.dim || light?.bright);
}

/**
 * Read the light level a token experiences, promoting darkness to dim when its vision mode sees unlit ground
 * @param {object} token - The Token placeable or TokenDocument to read
 * @returns {string|null} 'bright', 'dim', 'dark', or null when unset (never calculated, or cleared)
 */
export function getEffectiveLightLevel(token) {
  const level = getLightLevel(token);
  if (level !== 'dark') return level;
  const sight = (token?.document ?? token)?.sight;
  const visionMode = CONFIG.Canvas.visionModes[sight?.visionMode];
  const seesUnlit = visionMode?.lighting.background.visibility === foundry.canvas.perception.VisionMode.LIGHTING_VISIBILITY.REQUIRED;
  return sight?.enabled && seesUnlit ? 'dim' : 'dark';
}

/**
 * Read the environmental light level currently stored on a token
 * @param {object} token - The Token placeable or TokenDocument to read
 * @returns {string|null} 'bright', 'dim', 'dark', or null when unset (never calculated, or cleared)
 */
export function getLightLevel(token) {
  return (token?.document ?? token)?.getFlag(MODULE.ID, 'lightLevel') ?? null;
}

/**
 * Check if a token has valid HP
 * @param {object} token - The token to check
 * @returns {boolean} True if the token has valid HP
 */
export function hasValidHitPoints(token) {
  if (!token?.actor?.system?.attributes?.hp) return false;
  const currentHP = token.actor.system.attributes.hp.value;
  return currentHP > 0;
}

/**
 * Check if a token is valid for lighting effects processing
 * @param {object} token - The token to validate
 * @returns {boolean} True if the token is valid for processing
 */
export function isValidToken(token) {
  if (!token?.actor) return false;
  return VALID_ACTOR_TYPES.includes(token.actor.type);
}
