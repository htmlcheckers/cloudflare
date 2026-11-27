import test from "node:test";
import assert from "node:assert/strict";
import { CompanionBot } from "../public/assets/js/chat/bot/companion-bot.js";
import { createNlu } from "../public/assets/js/chat/bot/nlu.js";
import { PERSONAS, pickRandomPersona } from "../public/assets/js/chat/bot/personas.js";
import { getPack } from "../public/assets/js/chat/bot/packs/index.js";
import { createStorage } from "../public/assets/js/services/storage.js";
import { memoryBackend } from "./helpers.js";

function makeBot(extra = {}) {
  const messages = [];
  const storage = createStorage(() => memoryBackend());
  const bot = new CompanionBot({
    storage,
    pace: 0,
    minGapMs: 0,
    idleMs: 10_000_000,
    onMessage: (m) => messages.push(m.text),
    ...extra
  });
  return { bot, messages, storage };
}
const wait = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));

test("persona archetypes have complete European profiles and all speak French", () => {
  assert.ok(PERSONAS.length >= 20);
  const traits = new Set(["shy", "cheerful", "quiet", "playful"]);
  for (const persona of PERSONAS) {
    assert.ok(persona.firstName);
    assert.ok(["male", "female"].includes(persona.gender));
    assert.ok(persona.city);
    assert.ok(persona.country);
    assert.ok(persona.preferredLanguage);
    assert.equal(persona.speaksFrench, true);
    assert.ok(traits.has(persona.trait));
  }
  assert.equal(pickRandomPersona(() => 0), PERSONAS[0]);
  assert.equal(pickRandomPersona(() => 0.999), PERSONAS[PERSONAS.length - 1]);
});

test("NLU: negation and idioms (fr + en)", () => {
  const fr = createNlu(getPack("fr"));
  assert.equal(fr.analyze("je ne suis pas triste").scores.low_morale, undefined);
  assert.ok(fr.analyze("je suis triste").scores.low_morale);
  assert.equal(fr.analyze("je meurs de rire").scores.crisis, undefined);
  const en = createNlu(getPack("en"));
  assert.equal(en.analyze("I am not sad today").scores.low_morale, undefined);
  assert.ok(en.analyze("I am so sad").scores.low_morale);
  assert.ok(en.analyze("I want to die").scores.crisis);
  assert.equal(en.extractName("my name is marie", false), "Marie");
  assert.equal(en.extractName("I'm tired", false), null);
  assert.equal(fr.extractName("je m'appelle jeanne", false), "Jeanne");
});

test("crisis detection is local, immediate and uses locale resources", async () => {
  const fr = makeBot({ language: "fr" });
  fr.bot.receivePlayerMessage("j'ai envie de mourir");
  await wait();
  assert.ok(fr.messages.some((m) => m.includes("3114")));
  fr.bot.destroy();

  const en = makeBot({ language: "en" });
  en.bot.receivePlayerMessage("I want to die");
  await wait();
  assert.ok(en.messages.some((m) => m.includes("988")));
  assert.ok(!en.messages.some((m) => m.includes("3114")));
  assert.equal(en.bot.recentDistress, true);
  en.bot.destroy();
});

test("name is remembered and publicProfile is whitelisted", async () => {
  const { bot, storage } = makeBot({ language: "fr" });
  bot.receivePlayerMessage("je m'appelle marie");
  await wait();
  assert.equal(bot.memory.name, "Marie");
  assert.equal(storage.get("checkers_bot_name"), "Marie");
  assert.deepEqual(Object.keys(bot.memory.publicProfile()).sort(), ["gamesPlayed", "lossStreak", "name", "topics"]);
  bot.forgetPlayer();
  assert.equal(bot.memory.name, null);
  bot.destroy();
});

test("game events produce commentary and the language can change", async () => {
  const { bot, messages } = makeBot({ language: "en" });
  bot.onGameEvent("botLose", true);
  await wait();
  assert.equal(messages.length, 1);
  assert.match(messages[0], /[a-z]/i);
  assert.ok(!/[éèà]/.test(messages[0]));
  bot.setLanguage("fr");
  bot.onGameEvent("botWin", true);
  await wait();
  assert.equal(messages.length, 2);
  bot.destroy();
});

test("the LLM context carries the game snapshot; bad/failed replies fall back", async () => {
  let sentBody = null;
  const fetchImpl = async (url, init) => {
    sentBody = JSON.parse(init.body);
    return { ok: true, json: async () => ({ reply: "Je suis un humain." }) }; // must be rejected
  };
  const game = { ruleset: "british", score: { player: 2, computer: 1 }, turn: "player" };
  const { bot, messages } = makeBot({
    language: "fr",
    llm: { endpoint: "/chat" },
    fetchImpl,
    getContext: () => ({ game })
  });
  bot.receivePlayerMessage("la journée est longue et je suis seule");
  await wait(120);
  assert.deepEqual(sentBody.context.game, game);
  assert.equal(sentBody.context.language, "fr");
  assert.ok(messages.length >= 1);
  assert.ok(!messages.some((m) => /humain\./i.test(m) && m.startsWith("Je suis un humain")));
  bot.destroy();
});
