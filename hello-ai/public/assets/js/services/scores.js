/** Persistent win counters. Migrates the legacy whiteScore/blackScore keys. */
export class ScoreBoard {
  constructor(storage) {
    this.storage = storage;
    this.keys = { player: "playerScore", computer: "computerScore" };
    const legacy = { player: "whiteScore", computer: "blackScore" };
    for (const role of ["player", "computer"]) {
      if (storage.get(this.keys[role]) == null) {
        storage.set(this.keys[role], this.#parse(storage.get(legacy[role], "0")));
      }
    }
  }

  #parse(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  get() {
    return {
      player: this.#parse(this.storage.get(this.keys.player, "0")),
      computer: this.#parse(this.storage.get(this.keys.computer, "0"))
    };
  }

  increment(role) {
    if (role !== "player" && role !== "computer") return;
    this.storage.set(this.keys[role], this.get()[role] + 1);
  }

  getByPersona() {
    try {
      const saved = JSON.parse(this.storage.get("personaScores", "{}"));
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
      return saved;
    } catch {
      return {};
    }
  }

  incrementForPersona(role, persona) {
    if ((role !== "player" && role !== "computer") || !persona?.firstName) return;
    const scores = this.getByPersona();
    const name = persona.firstName;
    const score = scores[name] || { player: 0, computer: 0 };
    score[role] = this.#parse(score[role]) + 1;
    scores[name] = score;
    this.storage.set("personaScores", JSON.stringify(scores));
  }

  reset() {
    this.storage.set(this.keys.player, 0);
    this.storage.set(this.keys.computer, 0);
    this.storage.set("personaScores", "{}");
  }
}
