/**
 * Highlights the last move / captures and keeps the captured-pieces counters.
 * Driven only by bus events (game:started, game:move); no access to the game.
 */
export class LastMoveView {
  constructor({ bus, i18n, doc = globalThis.document }) {
    this.i18n = i18n;
    this.doc = doc;
    this.completedTurn = null;
    this.currentTurn = null;
    this.counts = { white: 0, black: 0 };

    bus.on("game:started", () => this.#reset());
    bus.on("game:move", (move) => this.#onMove(move));
    i18n.onChange(() => this.#refreshCounterLabels());
  }

  #reset() {
    this.completedTurn = null;
    this.currentTurn = null;
    this.counts = { white: 0, black: 0 };
    this.doc.querySelectorAll(".capture-counter").forEach((node) => node.remove());
    this.#render();
  }

  #onMove(move) {
    const { from, to, color, capturedPieces = [], pendingCaptures = [], turnCompleted, capturedByColor } = move;

    if (!this.currentTurn || this.currentTurn.mover !== color) {
      if (this.currentTurn) this.completedTurn = this.currentTurn;
      this.currentTurn = { mover: color, moves: [], captures: [] };
    }

    if (capturedByColor) this.#updateCounter(color, capturedByColor[color]);

    this.currentTurn.moves.push({ from, to });
    const pending = new Set(pendingCaptures);
    capturedPieces.forEach((captured) => {
      this.currentTurn.captures.push({
        squareId: captured.square,
        ghost: this.#createGhost(captured),
        pending: pending.has(captured.square)
      });
    });

    this.#render();
    if (turnCompleted) {
      this.completedTurn = this.currentTurn;
      this.currentTurn = null;
      this.#render();
    }
  }

  #createGhost({ color, king }) {
    const ghost = this.doc.createElement("div");
    ghost.className = `captured-ghost-${color} last-captured-ghost`;
    if (king) ghost.classList.add(`${color}-king`);
    ghost.setAttribute("aria-hidden", "true");
    ghost.setAttribute("tabindex", "-1");
    return ghost;
  }

  #render() {
    this.doc.querySelectorAll(".square.last-move, .square.last-capture").forEach((square) => {
      square.classList.remove("last-move", "last-capture");
    });
    this.doc.querySelectorAll(".last-captured-ghost").forEach((ghost) => ghost.remove());

    [this.completedTurn, this.currentTurn].forEach((turn) => {
      if (!turn) return;
      turn.moves.forEach(({ from, to }) => {
        this.#square(from)?.classList.add("last-move");
        this.#square(to)?.classList.add("last-move");
      });
      turn.captures.forEach(({ squareId, ghost, pending }) => {
        const square = this.#square(squareId);
        if (!square) return;
        square.classList.add("last-capture");
        if (turn === this.completedTurn || !pending) square.appendChild(ghost);
      });
    });
  }

  #square(id) {
    return this.doc.getElementById(String(id));
  }

  #updateCounter(color, count) {
    this.counts[color] = count;
    if (count === 0) return;
    const tray = this.doc.getElementById(color === "white" ? "removedw" : "removedb");
    if (!tray) return;
    let counter = tray.querySelector(".capture-counter");
    if (!counter) {
      counter = this.doc.createElement("span");
      counter.className = "capture-counter";
      counter.setAttribute("role", "status");
      counter.setAttribute("aria-live", "polite");
      tray.appendChild(counter);
    }
    counter.classList.add(`capture-counter-${color}`);
    counter.textContent = String(count);
    counter.setAttribute("aria-label", this.i18n.t("capturedCount", { count }));
  }

  #refreshCounterLabels() {
    ["white", "black"].forEach((color) => {
      const tray = this.doc.getElementById(color === "white" ? "removedw" : "removedb");
      const counter = tray && tray.querySelector(".capture-counter");
      if (counter) counter.setAttribute("aria-label", this.i18n.t("capturedCount", { count: this.counts[color] }));
    });
  }
}
