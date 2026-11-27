/**
 * Talks to your own proxy (never to a model provider directly, and never with an
 * API key in the browser). Any failure resolves to null so the bot falls back
 * to its built-in replies.
 */
export class LlmClient {
  constructor({ endpoint, timeoutMs = 9000, maxHistory = 10, fetchImpl }) {
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
    this.maxHistory = maxHistory;
    this.fetchImpl = fetchImpl || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
  }

  /**
   * @param {{message:string, history:Array<{role:string,content:string}>, context:object, reject?:RegExp}} request
   * @returns {Promise<{reply:string}|null>}
   */
  async ask({ message, history = [], context, reject }) {
    if (!this.endpoint || !this.fetchImpl) return null;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => controller && controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: context?.historic
            ? [{ role: "user", content: String(message || "").slice(-600) }]
            : history.slice(-this.maxHistory),
          context
        }),
        signal: controller ? controller.signal : undefined
      });
      if (!response.ok) throw new Error(`http ${response.status}`);
      const data = await response.json();
      const text = typeof data.reply === "string" ? data.reply.trim().slice(0, 400) : "";
      // Safety net: the companion must never claim to be a person.
      if (!text || (reject && reject.test(text))) throw new Error("rejected");
      return { reply: text };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async summarize({ history = [], context, playerMessage, reply }) {
    if (!this.endpoint || !this.fetchImpl) return null;
    const messages = history.length
      ? history
      : [
          ...(playerMessage ? [{ role: "user", content: String(playerMessage) }] : []),
          ...(reply ? [{ role: "assistant", content: String(reply) }] : [])
        ];
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => controller && controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "historic", messages, context: { historicSummary: context?.historicSummary || context?.historic || "" } }),
        signal: controller ? controller.signal : undefined
      });
      if (!response.ok) throw new Error(`http ${response.status}`);
      const data = await response.json();
      return typeof data.historic === "string" ? data.historic.trim() || null : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
