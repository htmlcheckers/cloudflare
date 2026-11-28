import test from "node:test";
import assert from "node:assert/strict";
import { CompanionBot } from "../public/assets/js/chat/bot/companion-bot.js";
import { getConversationStore } from "../public/assets/js/chat/bot/conversation-store.js";

class FakeStorage {
  constructor() { this.map = new Map(); }
  get(k, d = null) { return this.map.has(k) ? this.map.get(k) : d; }
  set(k, v) { this.map.set(k, String(v)); }
  remove(k) { this.map.delete(k); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function setup({ summarizeOk = true } = {}) {
  const storage = new FakeStorage();
  const calls = { ask: [], summarize: [] };
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    if (body.action === "historic") {
      calls.summarize.push(body);
      if (!summarizeOk) return { ok: false, status: 500 };
      return { ok: true, json: async () => ({ historic: "SUMMARY#" + calls.summarize.length }) };
    }
    calls.ask.push(body);
    return { ok: true, json: async () => ({ reply: "llm says hi" }) };
  };
  const shown = [];
  const bot = new CompanionBot({
    name: "Lucas", persona: { firstName: "Lucas" }, language: "en", storage, pace: 0, minGapMs: 0,
    llm: { endpoint: "/llm" }, fetchImpl, onMessage: (m) => shown.push(m.text),
    historyLimits: { softChars: 300, targetChars: 150, keepRecent: 2 }
  });
  return { bot, storage, calls, shown };
}

test("replies are stored, hot window goes to the LLM, summary replaces old messages on success", async () => {
  const { bot, storage, calls, shown } = setup();
  for (let i = 0; i < 8; i++) {
    bot.receivePlayerMessage(`message number ${i} `.padEnd(60, "z"));
    await wait(30);
  }
  await wait(50);
  assert.ok(shown.includes("Llm says hi"));
  assert.ok(calls.summarize.length >= 1, "summarize was called");
  assert.equal(calls.summarize[0].previousSummary, "");
  assert.ok(calls.summarize.length < 2 || calls.summarize[1].previousSummary.startsWith("SUMMARY#"));
  assert.ok(bot.chat.summary.startsWith("SUMMARY#"));
  assert.ok(bot.chat.hotChars < 300 + 200);
  const saved = JSON.parse(storage.get("checkers_bot_chat_v2_lucas"));
  assert.equal(saved.summary, bot.chat.summary);
  assert.equal(saved.messages.length, bot.chat.size);
  // chat requests: whole hot window, summary in context, last message is the player's
  const last = calls.ask.at(-1);
  assert.equal(last.messages.at(-1).role, "user");
  assert.ok(last.context.historicSummary.startsWith("SUMMARY#")); // may predate the newest summary
  assert.equal("historic" in last.context, false);
  bot.destroy();
});

test("a failing summary removes nothing and backs off", async () => {
  const { bot, calls } = setup({ summarizeOk: false });
  for (let i = 0; i < 8; i++) {
    bot.receivePlayerMessage(`message number ${i} `.padEnd(60, "z"));
    await wait(30);
  }
  await wait(50);
  assert.equal(bot.chat.summary, "");
  assert.ok(bot.chat.size >= 16, "nothing removed");
  assert.equal(calls.summarize.length, 1, "backoff prevents hammering");
  assert.ok(bot.compactBackoffUntil > Date.now());
  bot.destroy();
});

test("a new bot for the same persona resumes the conversation (refresh)", async () => {
  const { bot, storage } = setup();
  bot.receivePlayerMessage("I like cats a lot");
  await wait(50);
  bot.destroy();
  const again = new CompanionBot({ name: "Lucas", persona: { firstName: "Lucas" }, language: "en", storage, pace: 0, minGapMs: 0 });
  const transcript = again.recentTranscript();
  assert.equal(transcript[0].content, "I like cats a lot");
  assert.equal(again.chat.hasPlayerTurn(), true);
  assert.equal(getConversationStore(storage, "Lucas"), again.chat);
});

test("event commentary and the very first greeting are not stored; forgetPlayer wipes", async () => {
  const { bot, shown } = setup();
  bot.start();
  bot.onGameEvent("playerCapture", true);
  await wait(60);
  assert.ok(shown.length >= 1);
  assert.equal(bot.chat.size, 0);
  bot.receivePlayerMessage("hi there");
  await wait(50);
  assert.ok(bot.chat.size >= 1);
  bot.forgetPlayer();
  assert.equal(bot.chat.size, 0);
  assert.equal(bot.chat.hasPlayerTurn(), false);
  bot.destroy();
});
