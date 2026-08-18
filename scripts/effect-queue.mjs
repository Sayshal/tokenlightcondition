import { MODULE } from './constants.mjs';
import { EffectsManager } from './effects.mjs';
import { LightingCalculator } from './lighting.mjs';
import { isValidToken } from './utils.mjs';

/** Effect processing queue. */
export const effectQueue = {
  pendingOperations: new Set(),
  processingActive: false,
  drained: Promise.resolve(),
  resolveDrained: null,

  /**
   * Queue a token for re-derivation on the next drain
   * @param {string} tokenId - The token ID
   */
  add(tokenId) {
    if (!this.resolveDrained) this.drained = new Promise((resolve) => (this.resolveDrained = resolve));
    this.pendingOperations.add(tokenId);
    ATLAS.log(3, `Queued operation for token ${tokenId}`);
    this.scheduleProcessing();
  },

  /** Schedule processing of queued operations; a backgrounded tab runs no animation frames */
  scheduleProcessing() {
    if (this.processingActive) return;
    if (document.hidden) setTimeout(() => this.processQueue(), 0);
    else requestAnimationFrame(() => this.processQueue());
  },

  /** Re-derive, apply and commit every queued token */
  async processQueue() {
    if (this.processingActive || this.pendingOperations.size === 0) return;
    this.processingActive = true;
    ATLAS.log(3, `Processing ${this.pendingOperations.size} queued operations`);
    try {
      const tokenIds = [...this.pendingOperations];
      this.pendingOperations.clear();
      const tokens = tokenIds.map((tokenId) => canvas.tokens.get(tokenId)).filter((token) => token && isValidToken(token));
      const sources = LightingCalculator.gatherLightSources();
      const results = await Promise.all(tokens.map((token) => this.processTokenEffects(token, sources)));
      const changes = results.filter((change) => change);
      const updates = changes.map(({ token, newLevel }) =>
        newLevel === null ? { _id: token.id, [`flags.${MODULE.ID}.-=lightLevel`]: null } : { _id: token.id, [`flags.${MODULE.ID}.lightLevel`]: newLevel }
      );
      const previousLevels = Object.fromEntries(changes.map(({ token, oldLevel }) => [token.id, oldLevel]));
      if (updates.length) await canvas.scene.updateEmbeddedDocuments('Token', updates, { [MODULE.ID]: previousLevels });
    } catch (error) {
      ATLAS.log(1, 'Error processing effect queue:', error);
    } finally {
      this.processingActive = false;
      if (this.pendingOperations.size > 0) this.scheduleProcessing();
      else {
        this.resolveDrained?.();
        this.resolveDrained = null;
      }
    }
  },

  /**
   * Re-derive one token's level and apply the matching effects, without committing the flag
   * @param {object} token - The token to process
   * @param {object[]} sources - Pre-gathered source list shared across the drain
   * @returns {Promise<{token: object, newLevel: string|null, oldLevel: string|null}|null>} The transition to commit, or null when nothing changed or the effect writes failed
   */
  async processTokenEffects(token, sources) {
    const oldLevel = token.document.getFlag(MODULE.ID, 'lightLevel') ?? null;
    try {
      const newLevel = await LightingCalculator.resolveLightLevel(token, null, sources);
      if (newLevel === oldLevel) return null;
      ATLAS.log(3, `Processing effects for token ${token.id}: ${oldLevel} -> ${newLevel}`);
      await EffectsManager.syncEffects(token, newLevel);
      return { token, newLevel, oldLevel };
    } catch (error) {
      ATLAS.log(1, `Error processing effects for token ${token.id}:`, error);
      return null;
    }
  }
};
