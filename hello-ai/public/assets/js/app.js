import { EventBus } from "./services/event-bus.js";
import { createStorage } from "./services/storage.js";
import { I18n } from "./services/i18n.js";
import { SoundService } from "./services/sound.js";
import { ScoreBoard } from "./services/scores.js";
import { GameSession } from "./app/game-session.js";
import { createChatContextBuilder } from "./app/chat-context.js";
import { BoardView } from "./ui/board-view.js";
import { GamePresenter } from "./ui/game-presenter.js";
import { LastMoveView } from "./ui/last-move-view.js";
import { Toolbar } from "./ui/toolbar.js";
import { Menu } from "./ui/menu.js";
import { ChatPanel } from "./ui/chat-panel.js";
import { ChatController } from "./chat/chat-controller.js";
import { CompanionBot } from "./chat/bot/companion-bot.js";
import { PlayerMemory } from "./chat/bot/player-memory.js";

/**
 * Composition root: the only place that knows about every module.
 * All dependencies are explicit (and overridable for tests); nothing is global.
 */
export function createApp({
  config,
  doc = globalThis.document,
  storage = createStorage(),
  scheduler,
  rng,
  createAudio,
  reload = () => globalThis.location.reload()
} = {}) {
  const byId = (id) => doc.getElementById(id);

  const bus = new EventBus();
  const i18n = new I18n({ storage });
  i18n.applyToDocument(doc);
  i18n.onChange(() => i18n.applyToDocument(doc));

  const sound = new SoundService({ storage, createAudio });
  const scores = new ScoreBoard(storage);
  const session = new GameSession({ bus, storage, scheduler, rng });
  let chat = null;
  let menu = null;

  // --- board ---
  const gameEl = byId("game");
  const boardView = new BoardView({
    root: gameEl,
    getMovesFrom: (square) => session.getMovesFrom(square),
    onMove: (from, to) => {
      const result = session.tryMove(from, to);
      if (!result.valid) presenter.refreshTurn();
    }
  });
  const presenter = new GamePresenter({
    bus,
    session,
    boardView,
    i18n,
    sound,
    scores,
    getPersona: () => chat?.persona,
    messagesEl: byId("messages"),
    gameEl,
    onExit: reload,
    onRematch: () => menu?.rematch()
  });
  presenter.init();
  new LastMoveView({ bus, i18n, doc });
  new Toolbar({
    soundButton: byId("sound-toggle"),
    fullscreenButton: byId("fullscreen-toggle"),
    sound,
    i18n,
    doc,
    messagesEl: byId("messages")
  });
  bus.on("game:over", ({ winner }) => {
    scores.increment(winner);
    scores.incrementForPersona(winner, chat.persona);
  });

  // --- chat ---
  const memory = new PlayerMemory({ storage });
  const contextBuilder = createChatContextBuilder({ session, memory, i18n });
  const panel = new ChatPanel({
    center: byId("center"),
    toggleButton: byId("chat-toggle"),
    panel: byId("computer-chat"),
    log: byId("chat-log"),
    personaLabel: byId("chat-persona"),
    form: byId("chat-form"),
    input: byId("chat-input"),
    sendButton: byId("chat-send"),
    i18n
  });
  chat = new ChatController({
    bus,
    panel,
    i18n,
    contextBuilder,
    createBot: (options) =>
      new CompanionBot({
        ...options,
        memory,
        llm: config && config.llmEndpoint ? { endpoint: config.llmEndpoint } : null
      })
  });

  // --- menu ---
  menu = new Menu({ gameEl, session, i18n, sound, scores, presenter, getPersona: () => chat.persona, setNextPersona: (persona) => chat.setNextPersona(persona), onRestart: reload, doc });
  menu.createMenu();

  const versionEl = byId("app-version");
  if (versionEl && config) versionEl.textContent = `v${config.version}`;

  return { bus, session, i18n, chat, menu, presenter, memory, scores, dispose() { chat.dispose(); session.dispose(); presenter.dispose(); } };
}
