/**
 * What the companion remembers about the player (name, favourite topics, a few
 * counters). Stored locally only. `publicProfile()` is the ONLY view of this data
 * that is allowed to leave the browser (it is what the LLM proxy receives).
 */
const PREFIX = "checkers_bot_";

export class PlayerMemory {
  constructor({ storage }) {
    this.storage = storage;
    this.name = this.#readText("name");
    this.topics = this.#readList("topics");
    this.gamesPlayed = this.#readInt("games", 0);
    this.lossStreak = this.#readInt("losses", 0);
    this.askedName = this.#readInt("askedname", 0) > 0;
  }

  #readText(key) {
    return this.storage.get(PREFIX + key, null);
  }

  #readInt(key, fallback) {
    const parsed = Number.parseInt(this.storage.get(PREFIX + key, String(fallback)), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  #readList(key) {
    try {
      const parsed = JSON.parse(this.storage.get(PREFIX + key, "[]"));
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    } catch {
      return [];
    }
  }

  setName(name) {
    this.name = name;
    this.storage.set(PREFIX + "name", name);
    this.markAskedName();
  }

  markAskedName() {
    this.askedName = true;
    this.storage.set(PREFIX + "askedname", 1);
  }

  addTopic(topic) {
    if (this.topics.includes(topic)) return;
    this.topics = this.topics.concat(topic).slice(-8);
    this.storage.set(PREFIX + "topics", JSON.stringify(this.topics));
  }

  recordGameStarted() {
    this.gamesPlayed += 1;
    this.storage.set(PREFIX + "games", this.gamesPlayed);
  }

  recordResult(playerWon) {
    this.lossStreak = playerWon ? 0 : this.lossStreak + 1;
    this.storage.set(PREFIX + "losses", this.lossStreak);
  }

  publicProfile() {
    return {
      name: this.name,
      topics: this.topics.slice(),
      gamesPlayed: this.gamesPlayed,
      lossStreak: this.lossStreak
    };
  }

  forget() {
    ["name", "topics", "losses", "games", "askedname"].forEach((key) =>
      this.storage.remove(PREFIX + key)
    );
    this.name = null;
    this.topics = [];
    this.gamesPlayed = 0;
    this.lossStreak = 0;
    this.askedName = false;
  }
}
