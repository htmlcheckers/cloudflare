/**
 * Tracks a distress episode. Detection itself is lexicon based (pack.lexicon.crisis)
 * and always local: it never depends on the LLM or the network.
 */
export class CrisisGuard {
  constructor({ durationMs = 15 * 60 * 1000, maxFollowUps = 2 } = {}) {
    this.durationMs = durationMs;
    this.maxFollowUps = maxFollowUps;
    this.until = 0;
    this.followUps = 0;
  }

  trigger(now = Date.now()) {
    this.until = now + this.durationMs;
    this.followUps = 0;
  }

  isActive(now = Date.now()) {
    return now < this.until;
  }

  /** True (once per allowed follow-up) while the episode is still active. */
  takeFollowUp(now = Date.now()) {
    if (!this.isActive(now) || this.followUps >= this.maxFollowUps) return false;
    this.followUps += 1;
    return true;
  }
}
