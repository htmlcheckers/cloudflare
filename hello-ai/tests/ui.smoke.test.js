import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { createStorage } from "../public/assets/js/services/storage.js";
import { manualScheduler, memoryBackend } from "./helpers.js";

function boot({ language = "en", storageBackend = memoryBackend() } = {}) {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  const storage = createStorage(() => storageBackend);
  storage.set("language", language);
  storage.set("soundEnabled", "false");
  return { dom, storage };
}

const click = (dom, node) => node.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));

test("full UI flow: menu → setup → start → click-move → computer reply → chat", async () => {
  const { dom, storage } = boot();
  const { createApp } = await import("../public/assets/js/app.js");
  const scheduler = manualScheduler();
  const app = createApp({
    config: { version: "test", llmEndpoint: null },
    doc: dom.window.document,
    storage,
    scheduler,
    reload: () => {},
    createAudio: () => ({ play: async () => {} })
  });
  const doc = dom.window.document;

  // main menu
  assert.ok(doc.getElementById("menu").classList.contains("menu-main"));
  click(dom, doc.getElementById("vs-computer"));
  assert.ok(doc.getElementById("menu").classList.contains("menu-setup"));

  // pick British + hard, white
  const ruleset = doc.getElementById("ruleset-select");
  ruleset.value = "british";
  ruleset.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.equal(doc.querySelectorAll("#game .square").length, 64);
  doc.getElementById("difficulty-select").value = "hard";
  doc.getElementById("difficulty-select").dispatchEvent(new dom.window.Event("change", { bubbles: true }));

  click(dom, doc.getElementById("start-computer"));
  assert.equal(app.session.status, "playing");
  assert.equal(doc.querySelectorAll(".piece-white").length, 12);
  assert.equal(doc.querySelectorAll(".piece-black").length, 12);
  assert.equal(doc.getElementById("messages").textContent, "White's turn");
  assert.ok(doc.querySelector(".menu-hidden"), "menu collapses to the cog");
  assert.equal(doc.getElementById("computer-chat").hidden, false);
  assert.equal(doc.getElementById("chat-toggle").hidden, false);
  assert.equal(doc.getElementById("chat-persona").textContent, "Lucas");

  // click a movable piece, then one of its targets
  const [from, moves] = [...app.session.getLegalMoves()][0];
  const piece = doc.getElementById(String(from)).querySelector(".piece");
  click(dom, piece);
  assert.ok(piece.classList.contains("moving"));
  const possible = doc.querySelectorAll(".possible");
  assert.equal(possible.length, moves.length);
  click(dom, possible[0]);

  assert.equal(doc.getElementById("messages").textContent, "", "computer is thinking");
  assert.equal(doc.querySelectorAll(".square.last-move").length, 2);
  assert.equal(scheduler.runNext(), true);
  assert.equal(doc.getElementById("messages").textContent, "White's turn");
  assert.equal(doc.querySelectorAll(".piece").length, 24);

  // the chat context is available and game-aware
  const context = app.chat.contextBuilder.build();
  assert.equal(context.game.ruleset, "british");
  assert.equal(context.game.turn, "player");
  assert.equal(context.game.lastMoves.length, 2);
  assert.equal(context.session.language, "en");

  // language switch updates the chat panel and the document
  app.i18n.setLanguage("fr");
  assert.equal(doc.documentElement.lang, "fr");
  assert.equal(doc.getElementById("chat-send").textContent, "Envoyer");
  assert.equal(doc.getElementById("messages").textContent, "Aux Blancs de jouer");
  app.dispose();
  app.chat.bot?.destroy();
});

test("black side: board orientation class and computer opens", async () => {
  const { dom, storage } = boot();
  const { createApp } = await import("../public/assets/js/app.js");
  const scheduler = manualScheduler();
  const app = createApp({ config: { version: "t", llmEndpoint: null }, doc: dom.window.document, storage, scheduler, reload: () => {}, createAudio: () => ({ play: async () => {} }) });
  const doc = dom.window.document;
  click(dom, doc.getElementById("vs-computer"));
  doc.getElementById("player-color-select").value = "black";
  click(dom, doc.getElementById("start-computer"));
  assert.ok(doc.getElementById("game").classList.contains("player-black"));
  assert.equal(doc.getElementById("messages").textContent, "");
  scheduler.runNext();
  assert.equal(app.session.isHumanTurn(), true);
  assert.equal(doc.getElementById("messages").textContent, "Black's turn");
  app.dispose();
  app.chat.bot?.destroy();
});

test("options menu: highlight toggle + language; results menu migrates legacy scores", async () => {
  const backend = memoryBackend();
  backend.setItem("whiteScore", "3");
  backend.setItem("blackScore", "5");
  const { dom, storage } = boot({ storageBackend: backend });
  const { createApp } = await import("../public/assets/js/app.js");
  const app = createApp({ config: { version: "t", llmEndpoint: null }, doc: dom.window.document, storage, scheduler: manualScheduler(), reload: () => {}, createAudio: () => ({ play: async () => {} }) });
  const doc = dom.window.document;

  click(dom, doc.getElementById("results"));
  assert.match(doc.getElementById("player-score").textContent, /Player\s+3/);
  assert.match(doc.getElementById("computer-score").textContent, /Computer\s+5/);
  click(dom, doc.getElementById("reset-score"));
  assert.match(doc.getElementById("player-score").textContent, /0/);
  click(dom, doc.getElementById("rules-back"));

  click(dom, doc.getElementById("options"));
  const lang = doc.getElementById("language-select");
  lang.value = "fr";
  lang.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.equal(doc.querySelector("#menu .menu-title").textContent, "Options");
  assert.equal(doc.querySelector("#language-control label").textContent, "Langue");
  const box = doc.querySelector("#highlight-switch input");
  box.checked = false;
  box.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.equal(app.presenter.forcedHighlight, false);
  app.dispose();
});
