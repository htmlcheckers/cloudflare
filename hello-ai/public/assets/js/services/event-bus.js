/**
 * Minimal synchronous pub/sub. Handler errors are isolated so one failing
 * subscriber never breaks the game or the other subscribers.
 */
export class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(type, handler) {
    if (typeof handler !== "function") throw new TypeError("handler must be a function");
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(handler);
    return () => this.off(type, handler);
  }

  off(type, handler) {
    const list = this.handlers.get(type);
    if (list) list.delete(handler);
  }

  emit(type, detail = {}) {
    const list = this.handlers.get(type);
    if (!list) return;
    for (const handler of [...list]) {
      try {
        handler(detail, type);
      } catch (error) {
        console.error(`Handler for "${type}" failed:`, error);
      }
    }
  }
}
