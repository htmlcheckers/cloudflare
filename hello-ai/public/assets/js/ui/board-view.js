import { getBoardSize } from "../core/rulesets.js";

/**
 * Pure view of the board. It renders a GameState and turns clicks / drags into
 * move *intents* ({from, to}); it knows nothing about turns, rules or the AI.
 *
 * DOM contract (unchanged, so the existing CSS keeps working):
 *   #game > .square.(black|white)#<index>[occupied]  >  .piece.piece-<color>[.<color>-king]
 *   state classes: .moving .possible .highlight .dragging .drop-target, .drag-preview
 */
export class BoardView {
  /**
   * @param {{root: HTMLElement, getMovesFrom: (square:number)=>Array<{to:number,captures:number[]}>,
   *          onMove: (from:number, to:number)=>void}} options
   */
  constructor({ root, getMovesFrom, onMove }) {
    this.root = root;
    this.getMovesFrom = getMovesFrom;
    this.onMove = onMove;
    this.squares = [];
    this.movable = new Set();
    this.forced = new Set();
    this.selected = null;
    this.suppressClickUntil = 0;
    this.drag = null;

    root.addEventListener("click", (event) => this.#onClick(event));
    root.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
    root.addEventListener("pointermove", (event) => this.#onPointerMove(event));
    root.addEventListener("pointerup", (event) => this.#onPointerUp(event));
    root.addEventListener("pointercancel", () => this.#cancelDrag());
    root.addEventListener("dragstart", (event) => event.preventDefault());
  }

  // --- building & rendering ----------------------------------------------

  buildGrid(ruleset) {
    const boardSize = getBoardSize(ruleset);
    this.#cancelDrag();
    this.selected = null;
    this.root.dataset.boardSize = String(boardSize);
    this.root.querySelectorAll(".square").forEach((square) => square.remove());
    this.root.style.gridTemplateColumns = `repeat(${boardSize}, auto)`;
    const squareSize = boardSize === 10 ? "8vmin" : "10vmin";
    this.squares = [];
    let color = "white";
    for (let i = 0; i < boardSize * boardSize; i++) {
      color = color === "black" ? "white" : "black";
      if (i % boardSize === 0) color = color === "black" ? "white" : "black"; // invert on each new row
      const square = globalThis.document.createElement("div");
      square.className = `square ${color}`;
      square.style.width = `max(24px, ${squareSize})`;
      square.id = String(i);
      square.setAttribute("occupied", "false");
      this.root.appendChild(square);
      this.squares.push(square);
    }
    this.movable = new Set();
    this.forced = new Set();
  }

  setOrientation(color) {
    this.root.classList.remove("player-white", "player-black");
    this.root.classList.add(`player-${color}`);
  }

  /** Make the DOM match a GameState (pieces only; other square children are left alone). */
  render(state) {
    this.clearSelection();
    state.squares.forEach((piece, index) => {
      const square = this.squares[index];
      if (!square) return;
      let element = this.#pieceElement(square);
      if (!piece) {
        if (element) element.remove();
        square.setAttribute("occupied", "false");
        return;
      }
      if (element && !element.classList.contains(`piece-${piece.color}`)) {
        element.remove();
        element = null;
      }
      if (!element) {
        element = globalThis.document.createElement("div");
        element.className = `piece piece-${piece.color}`;
        element.id = String((piece.color === "black" ? 100 : 200) + index);
        element.draggable = false;
        square.appendChild(element);
      }
      element.classList.remove("white-king", "black-king");
      if (piece.king) element.classList.add(`${piece.color}-king`);
      square.setAttribute("occupied", "true");
    });
    this.#applyHighlights();
  }

  /** Which pieces the player may pick up, and which of them are forced to capture. */
  setInteractive({ movable = [], forced = [] } = {}) {
    this.movable = new Set(movable);
    this.forced = new Set(forced);
    this.clearSelection();
    this.#applyHighlights();
  }

  clearSelection() {
    this.root.querySelectorAll(".moving, .possible").forEach((node) => {
      node.classList.remove("moving", "possible");
    });
    this.selected = null;
  }

  select(from) {
    this.clearSelection();
    const moves = this.getMovesFrom(from);
    const element = this.squares[from] && this.#pieceElement(this.squares[from]);
    if (!element || moves.length === 0) return false;
    element.classList.add("moving");
    moves.forEach((move) => this.squares[move.to].classList.add("possible"));
    this.selected = from;
    return true;
  }

  #pieceElement(square) {
    return [...square.children].find((child) => child.classList.contains("piece")) || null;
  }

  #applyHighlights() {
    this.root.querySelectorAll(".piece.highlight").forEach((node) => node.classList.remove("highlight"));
    if (!this.highlightForced) return;
    this.forced.forEach((index) => {
      const element = this.squares[index] && this.#pieceElement(this.squares[index]);
      if (element) element.classList.add("highlight");
    });
  }

  get highlightForced() {
    return this._highlightForced !== false;
  }

  set highlightForced(value) {
    this._highlightForced = Boolean(value);
    this.#applyHighlights();
  }

  #squareOf(pieceElement) {
    return Number(pieceElement.parentElement.id);
  }

  // --- click -------------------------------------------------------------

  #onClick(event) {
    if (performance.now() < this.suppressClickUntil) return;
    const target = event.target;
    const pieceElement = target.closest && target.closest(".piece");
    if (pieceElement && this.root.contains(pieceElement)) {
      const square = this.#squareOf(pieceElement);
      if (this.movable.has(square)) this.select(square);
      else this.clearSelection();
      return;
    }
    const squareElement = target.closest && target.closest(".square");
    if (squareElement && squareElement.classList.contains("possible") && this.selected != null) {
      const from = this.selected;
      this.clearSelection();
      this.onMove(from, Number(squareElement.id));
    }
  }

  // --- drag & drop (pointer events, delegated) ----------------------------

  #findDropTarget(x, y) {
    let closest = null;
    let closestDistance = Infinity;
    this.root.querySelectorAll(".possible").forEach((square) => {
      const rect = square.getBoundingClientRect();
      const distance = Math.hypot(x - (rect.left + rect.width / 2), y - (rect.top + rect.height / 2));
      if (distance <= Math.min(rect.width, rect.height) * 0.75 && distance < closestDistance) {
        closest = square;
        closestDistance = distance;
      }
    });
    return closest;
  }

  #setDropTarget(square) {
    if (this.drag.target === square) return;
    if (this.drag.target) this.drag.target.classList.remove("drop-target");
    this.drag.target = square;
    if (square) square.classList.add("drop-target");
  }

  #onPointerDown(event) {
    const pieceElement = event.target.closest && event.target.closest(".piece");
    if (!pieceElement || event.button !== 0) return;
    const from = this.#squareOf(pieceElement);
    if (!this.movable.has(from)) return;
    event.preventDefault();
    const rect = pieceElement.getBoundingClientRect();
    this.drag = {
      pieceElement,
      from,
      pointerId: event.pointerId,
      started: false,
      startX: event.clientX,
      startY: event.clientY,
      grabX: event.clientX - rect.left,
      grabY: event.clientY - rect.top,
      preview: null,
      target: null
    };
    pieceElement.setPointerCapture(event.pointerId);
  }

  #onPointerMove(event) {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.started && distance > 6) {
      drag.started = true;
      this.select(drag.from);
      drag.pieceElement.classList.add("dragging");
      const rect = drag.pieceElement.getBoundingClientRect();
      drag.preview = drag.pieceElement.cloneNode(false);
      drag.preview.removeAttribute("id");
      drag.preview.classList.add("drag-preview");
      drag.preview.style.width = rect.width + "px";
      drag.preview.style.height = rect.height + "px";
      globalThis.document.body.appendChild(drag.preview);
    }
    if (!drag.started) return;
    const target = this.#findDropTarget(event.clientX, event.clientY);
    this.#setDropTarget(target);
    if (target) {
      const rect = target.getBoundingClientRect();
      drag.preview.style.left = rect.left + (rect.width - drag.preview.offsetWidth) / 2 + "px";
      drag.preview.style.top = rect.top + (rect.height - drag.preview.offsetHeight) / 2 + "px";
    } else {
      drag.preview.style.left = event.clientX - drag.grabX + "px";
      drag.preview.style.top = event.clientY - drag.grabY + "px";
    }
  }

  #onPointerUp(event) {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.pieceElement.hasPointerCapture && drag.pieceElement.hasPointerCapture(event.pointerId)) {
      drag.pieceElement.releasePointerCapture(event.pointerId);
    }
    if (!drag.started) {
      this.drag = null;
      return; // a plain click: the click handler selects the piece
    }
    const snapped = this.#findDropTarget(event.clientX, event.clientY);
    const from = drag.from;
    this.#cancelDrag();

    // Ignore the synthetic click generated after a drag.
    this.suppressClickUntil = performance.now() + 100;

    const under = globalThis.document.elementFromPoint(event.clientX, event.clientY);
    let square = snapped || (under ? under.closest(".square") : null);
    if (square && !square.classList.contains("possible")) {
      // Dropped on the captured piece itself: land just behind it.
      const dropped = Number(square.id);
      const landing = this.getMovesFrom(from)
        .filter((move) => move.captures[0] === dropped)
        .sort((a, b) => Math.abs(a.to - dropped) - Math.abs(b.to - dropped))[0];
      if (landing) square = this.squares[landing.to];
    }
    if (square && square.classList.contains("possible")) {
      this.clearSelection();
      this.onMove(from, Number(square.id));
    }
  }

  #cancelDrag() {
    const drag = this.drag;
    if (!drag) return;
    if (drag.preview) drag.preview.remove();
    if (drag.target) drag.target.classList.remove("drop-target");
    drag.pieceElement.classList.remove("dragging");
    drag.pieceElement.style.pointerEvents = "";
    this.drag = null;
  }
}
