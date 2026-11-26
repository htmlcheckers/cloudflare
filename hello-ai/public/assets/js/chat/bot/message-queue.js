/**
 * Delivers bot messages one at a time with a calm, human-like rhythm
 * (reading delay, typing indicator, minimum gap) and priorities.
 * Nothing is ever lost: higher priority messages overtake lower ones, and when
 * the queue overflows the lowest priority items are dropped first.
 */
export class MessageQueue {
  constructor({ pace = 1.25, minGapMs = 2200, onTypingChange, deliver, maxSize = 4 }) {
    this.pace = pace;
    this.minGapMs = minGapMs;
    this.onTypingChange = onTypingChange || (() => {});
    this.deliver = deliver;
    this.maxSize = maxSize;
    this.items = [];
    this.isTyping = false;
    this.lastDeliveredAt = 0;
    this.timers = new Set();
  }

  get size() {
    return this.items.length;
  }

  get busy() {
    return this.isTyping || this.items.length > 0;
  }

  push(items) {
    this.items.push(...items);
    while (this.items.length > this.maxSize) {
      let lowest = 0;
      this.items.forEach((item, index) => {
        if (item.priority < this.items[lowest].priority) lowest = index;
      });
      this.items.splice(lowest, 1);
    }
    this.#drain();
  }

  /** Drop everything below `priority` (stale casual remarks). */
  dropBelow(priority) {
    this.items = this.items.filter((item) => item.priority >= priority);
  }

  clear() {
    this.items = [];
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.isTyping = false;
  }

  #later(callback, ms) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, ms);
    this.timers.add(timer);
  }

  #deliverNow(item) {
    this.isTyping = false;
    this.lastDeliveredAt = Date.now();
    this.deliver(item);
    this.#drain();
  }

  #drain() {
    if (this.isTyping || this.items.length === 0) return;
    let next = 0;
    this.items.forEach((item, index) => {
      if (item.priority > this.items[next].priority) next = index;
    });
    const item = this.items.splice(next, 1)[0];

    if (item.immediate) {
      this.onTypingChange(false);
      this.#deliverNow(item);
      return;
    }
    this.isTyping = true;
    const wait = Math.max(0, this.minGapMs - (Date.now() - this.lastDeliveredAt));
    const readDelay = wait + (950 + Math.random() * 1200) * this.pace;
    this.#later(() => {
      this.onTypingChange(true);
      const typeDuration =
        Math.min(4200, Math.max(900, item.text.length * 38 + Math.random() * 400)) * this.pace;
      this.#later(() => {
        this.onTypingChange(false);
        this.#deliverNow(item);
      }, typeDuration);
    }, readDelay);
  }
}
