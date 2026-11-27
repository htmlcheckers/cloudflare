import { el } from "./dom.js";

/**
 * Connects the game (events from GameSession) to the screen: board rendering,
 * "whose turn" message, sound effects and the game-over dialog.
 */
export class GamePresenter {
  constructor({ bus, session, boardView, i18n, sound, scores, getPersona = () => null, messagesEl, gameEl, onExit, onRematch = onExit }) {
    this.session = session;
    this.boardView = boardView;
    this.i18n = i18n;
    this.sound = sound;
    this.scores = scores;
    this.getPersona = getPersona;
    this.messagesEl = messagesEl;
    this.gameEl = gameEl;
    this.onExit = onExit;
    this.onRematch = onRematch;
    this.timers = new Set();

    bus.on("game:configured", (e) => this.#onConfigured(e));
    bus.on("game:started", () => this.#onStarted());
    bus.on("game:move", (e) => this.#onMove(e));
    bus.on("game:turn", () => this.refreshTurn());
    bus.on("game:over", (e) => this.#onOver(e));
    i18n.onChange(() => this.refreshTurn());
  }

  init() {
    this.boardView.buildGrid(this.session.ruleset);
    this.boardView.setOrientation(this.session.humanColor);
    this.boardView.render(this.session.state);
  }

  setForcedHighlight(enabled) {
    this.boardView.highlightForced = enabled;
  }

  get forcedHighlight() {
    return this.boardView.highlightForced;
  }

  dispose() {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }

  #onConfigured({ changed }) {
    if (changed.includes("ruleset")) {
      this.boardView.buildGrid(this.session.ruleset);
      this.boardView.render(this.session.state);
    }
    this.boardView.setOrientation(this.session.humanColor);
  }

  #onStarted() {
    this.boardView.setOrientation(this.session.humanColor);
    this.boardView.render(this.session.state);
  }

  #onMove(move) {
    this.sound.play(move.captures.length > 0 ? "take" : "move");
    this.boardView.render(this.session.state);
  }

  /** Who may move what, plus the "your turn" message. */
  refreshTurn() {
    const session = this.session;
    if (session.status !== "playing") return;
    if (session.isHumanTurn()) {
      const legal = session.getLegalMoves();
      this.boardView.setInteractive({
        movable: [...legal.keys()],
        forced: session.getForcedCaptureSquares()
      });
      this.messagesEl.textContent = this.i18n.t(session.humanColor === "white" ? "whiteTurn" : "blackTurn");
    } else {
      this.boardView.setInteractive({ movable: [], forced: [] });
      this.messagesEl.textContent = "";
    }
  }

  #onOver({ winnerColor }) {
    this.boardView.setInteractive({ movable: [], forced: [] });
    // Let the last move be seen before the dialog appears.
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this.#showGameOver(winnerColor);
    }, 1000);
    this.timers.add(timer);
  }

  #showGameOver(winnerColor) {
    const t = (key) => this.i18n.t(key);
    const rematchButton = el("button", { class: "game-over-button", type: "button" }, t("rematchGame"));
    const restartButton = el("button", { class: "game-over-button", type: "button" }, t("restartGame"));
    const persona = this.getPersona();
    const score = persona
      ? this.scores.getByPersona()[persona.firstName] || { player: 0, computer: 0 }
      : { player: 0, computer: 0 };
    const overlay = el(
      "div",
      {
        id: "game-over",
        class: "game-over",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "game-over-title"
      },
      el(
        "div",
        { class: "game-over-card" },
        el("h2", { id: "game-over-title" }, t("gameOver")),
        el("p", {}, t(winnerColor === "white" ? "whiteWins" : "blackWins")),
        el("p", { class: "game-over-score" }, `${persona ? `${persona.firstName} · ` : ""}${t("player")} ${Number(score.player) || 0} · ${t("computer")} ${Number(score.computer) || 0}`),
        el("div", { class: "game-over-actions" }, rematchButton, restartButton)
      )
    );
    this.gameEl.appendChild(overlay);
    rematchButton.addEventListener("click", () => this.onRematch());
    restartButton.addEventListener("click", () => this.onExit());
    rematchButton.focus();
  }
}
