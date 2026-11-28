import test from "node:test";
import assert from "node:assert/strict";
import { ConversationStore, getConversationStore, clearAllConversations } from "../public/assets/js/chat/bot/conversation-store.js";

class FakeStorage {
  constructor() { this.map = new Map(); this.failSets = 0; }
  get(key, fallback = null) { return this.map.has(key) ? this.map.get(key) : fallback; }
  set(key, value) {
    if (this.failSets > 0) { this.failSets--; throw new Error("QuotaExceededError"); }
    this.map.set(key, String(value));
  }
  remove(key) { this.map.delete(key); }
}

const make = (storage = new FakeStorage(), limits = {}) =>
  new ConversationStore({ storage, key: "k", legacyKey: "legacy", limits });

const fill = (store, n, size = 100) => {
  for (let i = 0; i < n; i++) store.append(i % 2 ? "assistant" : "user", `${i}:`.padEnd(size, "x"));
};

test("append persists immediately and survives a reload", () => {
  const storage = new FakeStorage();
  const a = make(storage);
  a.append("user", "hello");
  a.append("assistant", "hi");
  const b = make(storage);
  assert.deepEqual(b.hot(), [{ role: "user", content: "hello" }, { role: "assistant", content: "hi" }]);
  assert.equal(b.append("user", "again").id, 3);
});

test("hasPlayerTurn ignores greetings alone", () => {
  const s = make();
  s.append("assistant", "hello!");
  assert.equal(s.hasPlayerTurn(), false);
  s.append("user", "hey");
  assert.equal(s.hasPlayerTurn(), true);
});

test("no compaction below the thresholds", () => {
  const s = make(new FakeStorage(), { softChars: 1000 });
  fill(s, 5);
  assert.equal(s.beginCompaction(), null);
});

test("compaction picks oldest messages and never the newest keepRecent", () => {
  const s = make(new FakeStorage(), { softChars: 1000, targetChars: 10000, keepRecent: 4 });
  fill(s, 12);
  const ticket = s.beginCompaction();
  assert.equal(ticket.messages.length, 8);
  assert.deepEqual(ticket.ids, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("commit removes exactly the ticket ids, keeps newer messages, sets the summary, persists", () => {
  const storage = new FakeStorage();
  const s = make(storage, { softChars: 1000, targetChars: 500, keepRecent: 2 });
  fill(s, 12);
  const ticket = s.beginCompaction();
  s.append("user", "typed while summarising");
  assert.equal(s.commitCompaction(ticket, "  the summary  "), true);
  assert.equal(s.summary, "the summary");
  assert.ok(s.hot().some((m) => m.content === "typed while summarising"));
  assert.ok(!s.hot().some((m) => m.content.startsWith("0:")));
  const reloaded = make(storage);
  assert.equal(reloaded.summary, "the summary");
  assert.equal(reloaded.size, s.size);
});

test("abort or empty summary keeps everything unchanged", () => {
  const s = make(new FakeStorage(), { softChars: 1000, keepRecent: 2 });
  fill(s, 12);
  const before = JSON.stringify(s.state);
  let ticket = s.beginCompaction();
  s.abortCompaction();
  assert.equal(JSON.stringify(s.state), before);
  ticket = s.beginCompaction();
  assert.equal(s.commitCompaction(ticket, "   "), false);
  assert.equal(JSON.stringify(s.state), before);
  assert.equal(s.inFlight, null);
});

test("single flight: a second ticket is refused while one is open", () => {
  const s = make(new FakeStorage(), { softChars: 1000, keepRecent: 2 });
  fill(s, 12);
  assert.ok(s.beginCompaction());
  assert.equal(s.beginCompaction(), null);
  s.abortCompaction();
  assert.ok(s.beginCompaction());
});

test("duplicate message texts are handled (removal is by id)", () => {
  const s = make(new FakeStorage(), { softChars: 5, keepRecent: 1, targetChars: 3 });
  s.append("user", "ok"); s.append("user", "ok"); s.append("user", "ok");
  const ticket = s.beginCompaction();
  s.commitCompaction(ticket, "s");
  assert.ok(s.size >= 1 && s.size < 3);
});

test("message-count threshold triggers compaction too", () => {
  const s = make(new FakeStorage(), { softMessages: 10, keepRecent: 2 });
  fill(s, 10, 3);
  assert.ok(s.beginCompaction());
});

test("hard limits keep storage bounded when summarising never succeeds", () => {
  const s = make(new FakeStorage(), { hardChars: 1000, hardMessages: 1000 });
  fill(s, 100);
  assert.ok(s.hotChars <= 1000);
  const t = make(new FakeStorage(), { hardMessages: 5 });
  fill(t, 20, 3);
  assert.equal(t.size, 5);
});

test("quota error on save does not throw", () => {
  const storage = new FakeStorage();
  const s = make(storage);
  fill(s, 10);
  storage.failSets = 1;
  assert.doesNotThrow(() => s.append("user", "boom"));
  storage.failSets = 5;
  assert.doesNotThrow(() => s.append("user", "boom again"));
});

test("legacy migration: JSON {summary, messages}", () => {
  const storage = new FakeStorage();
  storage.set("legacy", JSON.stringify({ summary: "old", messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }, { role: "x", content: "c" }] }));
  const s = make(storage);
  assert.equal(s.summary, "old");
  assert.equal(s.size, 2);
  assert.equal(storage.get("legacy", null), null);
  assert.equal(make(storage).size, 2);
  assert.equal(s.append("user", "n").id, 3);
});

test("legacy migration: plain-text summary and greeting-only leftovers", () => {
  const a = new FakeStorage();
  a.set("legacy", "Player: salut | Bot: coucou");
  assert.equal(make(a).summary, "Player: salut | Bot: coucou");
  const b = new FakeStorage();
  b.set("legacy", "Bot: Salut !");
  const sb = make(b);
  assert.equal(sb.hasPlayerTurn(), false);
  assert.equal(b.get("legacy", null), null);
});

test("corrupt v2 data is ignored, not thrown", () => {
  const storage = new FakeStorage();
  storage.set("k", "{not json");
  assert.equal(make(storage).size, 0);
  storage.set("k", JSON.stringify({ v: 2, seq: "x", summary: 3, messages: [null, { id: 1, role: "user", content: "ok" }, { id: "a" }] }));
  const s = make(storage);
  assert.equal(s.size, 1);
  assert.equal(s.summary, "");
  assert.equal(s.append("user", "x").id, 2);
});

test("registry shares one instance per persona; clearAllConversations wipes every persona", () => {
  const storage = new FakeStorage();
  const a1 = getConversationStore(storage, "Lucas");
  const a2 = getConversationStore(storage, "lucas");
  const b = getConversationStore(storage, "Hugo");
  assert.equal(a1, a2);
  a1.append("user", "hi"); b.append("user", "yo");
  clearAllConversations(storage);
  assert.equal(a1.size, 0);
  assert.equal(b.size, 0);
  assert.equal([...storage.map.keys()].length, 0);
  assert.equal(getConversationStore(new FakeStorage(), "Lucas") === a1, false);
});
