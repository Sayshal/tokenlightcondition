import { exposeApi } from './scripts/api.mjs';
import { MODULE } from './scripts/constants.mjs';
import { effectQueue } from './scripts/effect-queue.mjs';
import { onReady, registerHooks } from './scripts/hooks.mjs';
import { registerSettings } from './scripts/settings.mjs';
import './styles/tokenlightcondition.css';

/**
 * Troubleshooter lines covering live lighting state.
 * @returns {string[]} Markdown lines appended to the module's troubleshooter section
 */
function troubleshooterDebug() {
  const counts = { bright: 0, dim: 0, dark: 0, unset: 0 };
  for (const token of canvas?.tokens?.placeables ?? []) {
    const level = token.document.getFlag(MODULE.ID, 'lightLevel') ?? 'unset';
    if (level in counts) counts[level] += 1;
  }
  return [
    `- Scene: ${canvas?.scene?.name ?? 'none'}`,
    `- Pending queue operations: ${effectQueue.pendingOperations.size}`,
    `- Queue processing active: ${effectQueue.processingActive}`,
    `- Token light levels: ${counts.bright} bright, ${counts.dim} dim, ${counts.dark} dark, ${counts.unset} unset`
  ];
}

Hooks.once('init', () => {
  ATLAS.register(MODULE.ID, { title: MODULE.TITLE, github: 'Sayshal/tokenlightcondition', debug: troubleshooterDebug });
  ATLAS.log(3, 'Initializing module');
  registerSettings();
  registerHooks();
  exposeApi();
});

Hooks.once('ready', onReady);
