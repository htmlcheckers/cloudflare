/**
 * Talks to your own proxy (never to a model provider directly, and never with an
 * API key in the browser). Any failure resolves to null so the bot falls back
 * to its built-in replies.
 *
 * Chat request   : { messages: <hot window>, context }       → { reply }
 * Summary request: { action: "historic", messages,
 *                    previousSummary, context }              → { historic }
 */
export class LlmClient {
  constructor({ endpoint, timeoutMs = 9000, maxMessages = 60, fetchImpl }) {
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
    this.maxMessages = maxMessages; // sanity cap only; the hot window is already bounded by the store
    this.fetchImpl = fetchImpl || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
  }

  async #post(body) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => controller && controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller ? controller.signal : undefined
      });
      if (!response.ok) throw new Error(`http ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * @param {{messages:Array<{role:string,content:string}>, context:object, reject?:RegExp}} request
   *   `messages` is the whole hot conversation, oldest first, ending with the player's message.
   * @returns {Promise<{reply:string}|null>}
   */
  async ask({ messages = [], context, reject }) {
    if (!this.endpoint || !this.fetchImpl) return null;
    try {
      const data = await this.#post({ messages: messages.slice(-this.maxMessages), context });
      const text = typeof data.reply === "string" ? data.reply.trim().slice(0, 400) : "";
      // Safety net: the companion must never claim to be a person.
      if (!text || (reject && reject.test(text))) throw new Error("rejected");
      return { reply: text };
    } catch {
      return null;
    }
  }

  /**
   * Merge `previousSummary` and `messages` into one new summary.
   * @returns {Promise<string|null>}
   */
  async summarize({ messages = [], previousSummary = "" }) {
    if (!this.endpoint || !this.fetchImpl || messages.length === 0) return null;
    try {
      const data = await this.#post({
        action: "historic",
        messages,
        previousSummary,
        // Duplicate kept for proxies that still read context.historicSummary; remove once updated.
        context: { historicSummary: previousSummary }
      });
      return typeof data.historic === "string" ? data.historic.trim() || null : null;
    } catch {
      return null;
    }
  }
}
