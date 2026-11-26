/**
 * Glue between the game and the companion bot.
 *
 *  game events  ──►  bot.onGameEvent / updateBoardState / timers
 *  panel input  ──►  bot.receivePlayerMessage
 *  bot messages ──►  panel
 *
 * The bot receives game knowledge only through `getContext` (a ChatContext
 * snapshot, see app/chat-context.js) and through the typed events below.
 */
export class ChatController {
  constructor({ bus, panel, i18n, createBot, contextBuilder, personaName = "Lucas" }) {
    this.panel = panel;
    this.i18n = i18n;
    this.createBot = createBot;
    this.contextBuilder = contextBuilder;
    this.personaName = personaName;
    this.bot = null;
    this.generation = 0;
    this.pending = false;
    this.turnAccumulator = null;

    bus.on("game:started", () => this.start());
    bus.on("game:move", (move) => this.#onMove(move));
    bus.on("game:turn", (turn) => this.#onTurn(turn));
    bus.on("game:over", (over) => {
      if (this.bot) this.bot.onGameEvent(over.winner === "player" ? "botLose" : "botWin", true);
    });
    i18n.onChange((language) => {
      if (this.bot) this.bot.setLanguage(language);
    });
    panel.onSubmit((text) => this.#send(text));
  }

  start() {
    if (this.bot) this.bot.destroy();
    this.generation++;
    const generation = this.generation;
    this.turnAccumulator = null;
    this.panel.clear();
    this.panel.activate();
    this.#setPending(true);

    this.bot = this.createBot({
      name: this.personaName,
      language: this.i18n.language,
      onTypingChange: (typing) => {
        if (generation === this.generation) this.panel.showThinking(typing);
      },
      onMessage: (message) => this.#onBotMessage(message, generation),
      getContext: () => this.contextBuilder.build()
    });
    this.panel.setPersona(this.bot.name);
    this.bot.start();
  }

  dispose() {
    this.generation++;
    if (this.bot) this.bot.destroy();
    this.bot = null;
  }

  #setPending(pending) {
    this.pending = pending;
    this.panel.setPending(pending);
  }

  #onBotMessage(message, generation) {
    if (generation !== this.generation) return;
    this.panel.showThinking(false);
    const text = typeof message === "string" ? message : message.text;
    if (typeof text !== "string") throw new TypeError("Bot messages must contain text");
    this.panel.addMessage(text, "computer");
    this.#setPending(false);
    this.panel.focusIfOpen();
  }

  #send(text) {
    if (!this.bot || this.pending) return;
    const element = this.panel.addMessage(text, "player");
    this.panel.clearInput();
    this.#setPending(true);
    try {
      this.bot.receivePlayerMessage(text);
    } catch (error) {
      this.#setPending(false);
      this.panel.restoreInput(text);
      element.remove();
      throw error;
    }
  }

  #onMove(move) {
    if (!this.bot) return;
    this.bot.updateBoardState(move.totals.computer, move.totals.player);
    if (move.by === "player") this.bot.resetIdleTimer();

    // A "turn" can contain several capture steps: comment once, when it ends.
    if (!this.turnAccumulator || this.turnAccumulator.by !== move.by) {
      this.turnAccumulator = { by: move.by, captures: 0, promoted: false };
    }
    this.turnAccumulator.captures += move.captures.length;
    this.turnAccumulator.promoted ||= move.promoted;
    if (!move.turnCompleted) return;

    const { by, captures, promoted } = this.turnAccumulator;
    this.turnAccumulator = null;
    const prefix = by === "player" ? "player" : "bot";
    if (captures > 1) this.bot.onGameEvent(`${prefix}MultiCapture`);
    else if (captures === 1) this.bot.onGameEvent(`${prefix}Capture`);
    if (promoted) this.bot.onGameEvent(`${prefix}King`);
  }

  #onTurn(turn) {
    if (this.bot && turn.turn === "player" && !turn.continuing) this.bot.startPlayerTurnTimer();
  }
}
