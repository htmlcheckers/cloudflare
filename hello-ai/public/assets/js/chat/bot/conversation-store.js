/**
 * ConversationStore – single source of truth for one persona's chat history.
 *
 *   summary : string                         LLM summary of everything already compacted
 *   messages: [{id, role, content, at}]      the "hot conversation"
 *
 * - Loaded once, written through to localStorage on every mutation.
 * - Oldest messages are summarised in two steps: beginCompaction() hands out a
 *   ticket (a copy), commitCompaction() removes those ids only once a summary
 *   exists. A failure or a page refresh in between loses nothing.
 * - Storage stays bounded even if summarising never succeeds (hard limits).
 */
const VERSION = 2;
const KEY_PREFIX = "checkers_bot_chat_v2_";
const LEGACY_PREFIX = "checkers_bot_historic_";
const INDEX_KEY = "checkers_bot_chat_index";

export const DEFAULT_LIMITS = Object.freeze({
  softChars: 5000, // hot conversation >= this → compact
  softMessages: 40, // ... or >= this many messages
  targetChars: 2500, // summarise roughly this much of the oldest text per run
  targetMessages: 20, // ... and never more than this many messages per run
  keepRecent: 6, // the newest N messages are never summarised
  hardChars: 12000, // summarising keeps failing: drop oldest beyond this
  hardMessages: 80,
  maxMessageChars: 600,
  maxSummaryChars: 1500
});

const isMessage = (m) =>
  m && Number.isInteger(m.id) && (m.role === "user" || m.role === "assistant") && typeof m.content === "string";

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export class ConversationStore {
  constructor({ storage, key, legacyKey = null, limits = {} }) {
    this.storage = storage;
    this.key = key;
    this.legacyKey = legacyKey;
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.inFlight = null; // Set of message ids currently being summarised

    const loaded = this.#load();
    this.state = loaded.state;
    if (loaded.migrated) {
      this.#save();
      this.storage.remove(this.legacyKey);
    }
  }

  // --- reads ----------------------------------------------------------------

  get summary() {
    return this.state.summary;
  }

  get size() {
    return this.state.messages.length;
  }

  get hotChars() {
    return this.state.messages.reduce((total, m) => total + m.content.length, 0);
  }

  /** Plain copies, safe to hand to the LLM client. */
  hot() {
    return this.state.messages.map(({ role, content }) => ({ role, content }));
  }

  /** Last n messages, e.g. to re-render the chat panel after a refresh. */
  transcript(n = 8) {
    return this.state.messages.slice(-n).map(({ role, content, at }) => ({ role, content, at }));
  }

  /** True once the player has ever spoken. A bot greeting alone does not count. */
  hasPlayerTurn() {
    return this.state.summary !== "" || this.state.messages.some((m) => m.role === "user");
  }

  // --- writes ---------------------------------------------------------------

  append(role, content) {
    if (role !== "user" && role !== "assistant") throw new RangeError("Unsupported role: " + role);
    const message = {
      id: ++this.state.seq,
      role,
      content: String(content).slice(0, this.limits.maxMessageChars),
      at: Date.now()
    };
    this.state.messages.push(message);
    this.#enforceHardLimits();
    this.#save();
    return message;
  }

  needsCompaction() {
    if (this.inFlight) return false;
    return this.hotChars >= this.limits.softChars || this.state.messages.length >= this.limits.softMessages;
  }

  /**
   * Selects the oldest messages (never the newest `keepRecent`) and returns a
   * ticket. Nothing is removed here. Returns null when there is nothing to do.
   */
  beginCompaction() {
    if (!this.needsCompaction()) return null;
    const eligible = this.state.messages.slice(0, Math.max(0, this.state.messages.length - this.limits.keepRecent));
    const batch = [];
    let chars = 0;
    for (const message of eligible) {
      if (chars >= this.limits.targetChars || batch.length >= this.limits.targetMessages) break;
      batch.push(message);
      chars += message.content.length;
    }
    if (batch.length === 0) return null;
    this.inFlight = new Set(batch.map((m) => m.id));
    return {
      ids: [...this.inFlight],
      messages: batch.map(({ role, content }) => ({ role, content })),
      previousSummary: this.state.summary
    };
  }

  /** Success path: replace the batch by the new summary, then persist. */
  commitCompaction(ticket, summary) {
    this.inFlight = null;
    const text = String(summary || "").trim().slice(0, this.limits.maxSummaryChars);
    if (!text) return false;
    const gone = new Set(ticket.ids);
    this.state.messages = this.state.messages.filter((m) => !gone.has(m.id));
    this.state.summary = text;
    this.#save();
    return true;
  }

  /** Failure path: keep everything exactly as it was. */
  abortCompaction() {
    this.inFlight = null;
  }

  clear() {
    this.inFlight = null;
    this.state = { v: VERSION, seq: 0, summary: "", messages: [] };
    this.storage.remove(this.key);
  }

  // --- internals ------------------------------------------------------------

  #enforceHardLimits() {
    const { messages } = this.state;
    while (messages.length > 1 && (this.hotChars > this.limits.hardChars || messages.length > this.limits.hardMessages)) {
      messages.shift();
    }
  }

  #save() {
    const write = () => this.storage.set(this.key, JSON.stringify(this.state));
    try {
      write();
    } catch {
      // Quota exceeded: halve the hot window and retry once.
      const { messages } = this.state;
      this.state.messages = messages.slice(Math.floor(messages.length / 2));
      try {
        write();
      } catch {
        /* storage unavailable: memory-only for this session */
      }
    }
  }

  #load() {
    const empty = () => ({ v: VERSION, seq: 0, summary: "", messages: [] });

    const current = parseJson(this.storage.get(this.key, "") || "");
    if (current && current.v === VERSION && Array.isArray(current.messages)) {
      const messages = current.messages.filter(isMessage);
      const maxId = messages.reduce((max, m) => Math.max(max, m.id), 0);
      return {
        migrated: false,
        state: {
          v: VERSION,
          seq: Math.max(Number.isInteger(current.seq) ? current.seq : 0, maxId),
          summary: typeof current.summary === "string" ? current.summary : "",
          messages
        }
      };
    }

    // One-time migration from checkers_bot_historic_<persona>
    if (!this.legacyKey) return { migrated: false, state: empty() };
    const raw = this.storage.get(this.legacyKey, "") || "";
    if (!raw) return { migrated: false, state: empty() };

    let summary = "";
    let legacyMessages = [];
    const legacy = parseJson(raw);
    if (legacy && typeof legacy === "object") {
      summary = typeof legacy.summary === "string" ? legacy.summary : "";
      legacyMessages = Array.isArray(legacy.messages) ? legacy.messages : [];
    } else if (!/^Bot:\s*/i.test(raw) || /(?:^|\|\s*)Player:\s*/i.test(raw)) {
      summary = raw; // very old plain-text summary
    } // else: greeting-only leftovers, drop them

    const messages = legacyMessages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m, i) => ({ id: i + 1, role: m.role, content: m.content.slice(0, this.limits.maxMessageChars), at: 0 }));

    return { migrated: true, state: { v: VERSION, seq: messages.length, summary, messages } };
  }
}

// --- one store per (storage, persona) for the whole page lifetime ------------
// A new CompanionBot is created for every game; sharing the instance prevents an
// old bot's late summary from overwriting the new bot's state.

const registries = new WeakMap();

export function getConversationStore(storage, persona, limits) {
  let stores = registries.get(storage);
  if (!stores) {
    stores = new Map();
    registries.set(storage, stores);
  }
  const personaKey = encodeURIComponent(String(persona).toLowerCase());
  if (!stores.has(personaKey)) {
    stores.set(
      personaKey,
      new ConversationStore({
        storage,
        key: KEY_PREFIX + personaKey,
        legacyKey: LEGACY_PREFIX + personaKey,
        limits
      })
    );
    const index = parseJson(storage.get(INDEX_KEY, "[]") || "[]");
    const keys = Array.isArray(index) ? index.filter((k) => typeof k === "string") : [];
    if (!keys.includes(personaKey)) {
      try {
        storage.set(INDEX_KEY, JSON.stringify(keys.concat(personaKey)));
      } catch {
        /* index is only used by clearAllConversations */
      }
    }
  }
  return stores.get(personaKey);
}

/** Forget every persona's conversation (loaded or not). */
export function clearAllConversations(storage) {
  const stores = registries.get(storage);
  if (stores) for (const store of stores.values()) store.clear();
  const index = parseJson(storage.get(INDEX_KEY, "[]") || "[]");
  if (Array.isArray(index)) {
    for (const personaKey of index) {
      if (typeof personaKey === "string") {
        storage.remove(KEY_PREFIX + personaKey);
        storage.remove(LEGACY_PREFIX + personaKey);
      }
    }
  }
  storage.remove(INDEX_KEY);
}
