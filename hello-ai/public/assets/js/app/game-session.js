import { GameState } from "../core/game-state.js";
import { RulesEngine } from "../core/rules-engine.js";
import {
  DEFAULT_RULESET,
  RULESETS,
  isRuleset,
  toSquareNumber
} from "../core/rulesets.js";
import { chooseMove, getThinkDelay, isDifficulty } from "../core/ai/index.js";

/**
 * Events emitted on the bus (all payloads are plain data):
 *
 *  game:configured { changed: string[], ruleset, difficulty, humanColor }
 *  game:started    { snapshot }
 *  game:move       { by, color, from, to, captures, capturedPieces, removed,
 *                    pendingCaptures, promoted, turnCompleted, totals,
 *                    capturedByColor, revision }
 *  game:turn       { turn, color, continuing, revision }
 *  game:over       { winner, winnerColor, reason }
 *
 * `by` / `turn` / `winner` are roles ("player" | "computer"), never CSS classes.
 */

const timeoutScheduler = {
  after(ms, callback) {
    const id = setTimeout(callback, ms);
    return () => clearTimeout(id);
  }
};

const opposite = (color) => (color === "white" ? "black" : "white");

/**
 * Owns the game: state, turn order, history, outcome and the computer player.
 * Contains no DOM code. The UI sends intents (tryMove) and listens to events.
 */
export class GameSession {
  #legalCache = null;
  #pending = new Set();

  constructor({
    bus,
    storage,
    scheduler = timeoutScheduler,
    rng = Math.random,
    historyLimit = 24
  }) {
    this.bus = bus;
    this.storage = storage;
    this.scheduler = scheduler;
    this.rng = rng;
    this.historyLimit = historyLimit;

    const savedRuleset = storage ? storage.get("ruleset") : null;
    const savedDifficulty = storage ? storage.get("difficulty") : null;
    this.ruleset = isRuleset(savedRuleset) ? savedRuleset : DEFAULT_RULESET;
    this.difficulty = isDifficulty(savedDifficulty) ? savedDifficulty : "easy";
    this.humanColor = "white";
    this.engine = new RulesEngine(this.ruleset);
    this.state = GameState.empty(this.ruleset);
    this.status = "idle"; // idle | playing | over
    this.#reset();
  }

  #reset() {
    this.captured = { white: 0, black: 0 }; // pieces captured BY each colour
    this.history = [];
    this.turnsPlayed = 0;
    this.#legalCache = null;
  }

  get computerColor() {
    return opposite(this.humanColor);
  }

  roleOf(color) {
    return color === this.humanColor ? "player" : "computer";
  }

  isHumanTurn() {
    return this.status === "playing" && this.state.turn === this.humanColor;
  }

  configure({ ruleset, difficulty, humanColor } = {}) {
    const changed = [];
    if (ruleset !== undefined && ruleset !== this.ruleset) {
      if (!isRuleset(ruleset)) throw new RangeError(`Unsupported ruleset: ${ruleset}`);
      if (this.status === "playing") throw new Error("Cannot change the ruleset during a game");
      this.ruleset = ruleset;
      this.engine = new RulesEngine(ruleset);
      this.state = GameState.empty(ruleset);
      this.#reset();
      if (this.storage) this.storage.set("ruleset", ruleset);
      changed.push("ruleset");
    }
    if (difficulty !== undefined && difficulty !== this.difficulty) {
      if (!isDifficulty(difficulty)) throw new RangeError(`Unsupported difficulty: ${difficulty}`);
      this.difficulty = difficulty;
      if (this.storage) this.storage.set("difficulty", difficulty);
      changed.push("difficulty");
    }
    if (humanColor !== undefined && humanColor !== this.humanColor) {
      if (humanColor !== "white" && humanColor !== "black") {
        throw new RangeError(`Unsupported player color: ${humanColor}`);
      }
      if (this.status === "playing") throw new Error("Cannot change colour during a game");
      this.humanColor = humanColor;
      changed.push("humanColor");
    }
    if (changed.length > 0) {
      this.bus.emit("game:configured", {
        changed,
        ruleset: this.ruleset,
        difficulty: this.difficulty,
        humanColor: this.humanColor
      });
    }
  }

  start() {
    this.#cancelTimers();
    this.state = GameState.initial(this.ruleset);
    this.status = "playing";
    this.#reset();
    this.bus.emit("game:started", { snapshot: this.snapshot() });
    this.bus.emit("game:turn", this.#turnPayload(false));
    this.#scheduleComputer(false);
  }

  /** Legal moves of the side to move: Map<from, [{to, captures, capture}]>. */
  getLegalMoves() {
    if (this.status !== "playing") return new Map();
    const cache = this.#legalCache;
    if (cache && cache.revision === this.state.revision && cache.turn === this.state.turn) {
      return cache.moves;
    }
    const moves = this.engine.getAllLegalMoves(this.state, this.state.turn);
    this.#legalCache = { revision: this.state.revision, turn: this.state.turn, moves };
    return moves;
  }

  getMovesFrom(from) {
    return this.getLegalMoves().get(from) || [];
  }

  /** Squares whose pieces must capture this turn. */
  getForcedCaptureSquares() {
    const squares = [];
    this.getLegalMoves().forEach((moves, from) => {
      if (moves.some((move) => move.capture)) squares.push(from);
    });
    return squares;
  }

  /** Human intent. Returns { valid, error?, keepTurn? }. */
  tryMove(from, to) {
    if (!this.isHumanTurn()) return { valid: false, error: "It is not the player's turn" };
    return this.#applyMove(from, to, "player");
  }

  snapshot() {
    const material = this.state.getMaterial();
    const humanColor = this.humanColor;
    const computerColor = this.computerColor;
    return {
      ruleset: this.ruleset,
      difficulty: this.difficulty,
      status: this.status,
      humanColor,
      turn: this.roleOf(this.state.turn),
      turnColor: this.state.turn,
      turnsPlayed: this.turnsPlayed,
      moveNumber: this.turnsPlayed + 1,
      captureScore: {
        player: this.captured[humanColor],
        computer: this.captured[computerColor]
      },
      material: {
        player: material[humanColor],
        computer: material[computerColor]
      },
      history: this.history.slice(-this.historyLimit).map((entry) => ({
        by: entry.by,
        from: toSquareNumber(entry.from, this.ruleset),
        to: toSquareNumber(entry.to, this.ruleset),
        captures: entry.captures,
        promoted: entry.promoted
      })),
      notation: this.state.toNotation(),
      revision: this.state.revision
    };
  }

  dispose() {
    this.#cancelTimers();
  }

  // --- internals ---------------------------------------------------------

  #turnPayload(continuing) {
    return {
      turn: this.roleOf(this.state.turn),
      color: this.state.turn,
      continuing,
      revision: this.state.revision
    };
  }

  #applyMove(from, to, by) {
    const state = this.state;
    const validation = this.engine.validateMove(state, { from, to });
    if (!validation.valid) return { ...validation, keepTurn: false };

    const piece = state.squares[from];
    const color = piece.color;
    const wasKing = Boolean(piece.king);

    let keepTurn = false;
    if (validation.capture) {
      const provisional = state.clone();
      provisional.applyMove({
        from,
        to,
        captures: validation.captures,
        keepTurn: true,
        revision: state.revision
      });
      keepTurn = this.engine.getCaptureOptions(provisional, to).length > 0;
    }

    const capturedPieces = validation.captures.map((square) => ({
      square,
      color: state.squares[square].color,
      king: Boolean(state.squares[square].king)
    }));
    const removed =
      RULESETS[this.ruleset].deferCapturedPieces && keepTurn
        ? []
        : [...new Set([...state.pendingCaptures, ...validation.captures])];

    state.applyMove({
      from,
      to,
      captures: validation.captures,
      keepTurn,
      revision: state.revision
    });
    this.#legalCache = null;

    const promoted = !wasKing && Boolean(state.squares[to].king);
    this.captured[color] += validation.captures.length;
    if (!keepTurn) this.turnsPlayed += 1;
    this.history.push({ by, from, to, captures: validation.captures.length, promoted });
    if (this.history.length > this.historyLimit * 2) {
      this.history.splice(0, this.history.length - this.historyLimit);
    }

    this.bus.emit("game:move", {
      by,
      color,
      from,
      to,
      captures: validation.captures.slice(),
      capturedPieces,
      removed,
      pendingCaptures: state.pendingCaptures.slice(),
      promoted,
      turnCompleted: !keepTurn,
      totals: {
        player: this.captured[this.humanColor],
        computer: this.captured[this.computerColor]
      },
      capturedByColor: { ...this.captured },
      revision: state.revision
    });

    if (!keepTurn && this.#checkGameOver()) {
      return { ...validation, keepTurn };
    }
    this.bus.emit("game:turn", this.#turnPayload(keepTurn));
    this.#scheduleComputer(keepTurn);
    return { ...validation, keepTurn };
  }

  #checkGameOver() {
    const material = this.state.getMaterial();
    const count = (color) => material[color].men + material[color].kings;
    let winnerColor = null;
    let reason = null;
    if (count("white") === 0) {
      winnerColor = "black";
      reason = "pieces";
    } else if (count("black") === 0) {
      winnerColor = "white";
      reason = "pieces";
    } else if (!this.engine.hasLegalMoves(this.state, this.state.turn)) {
      winnerColor = opposite(this.state.turn);
      reason = "no-moves";
    }
    if (!winnerColor) return false;

    this.status = "over";
    this.#cancelTimers();
    this.bus.emit("game:over", {
      winner: this.roleOf(winnerColor),
      winnerColor,
      reason
    });
    return true;
  }

  #scheduleComputer(continuing) {
    if (this.status !== "playing" || this.state.turn === this.humanColor) return;
    const delay = continuing ? 500 : getThinkDelay(this.difficulty, this.rng);
    const handle = { cancel: null };
    handle.cancel = this.scheduler.after(delay, () => {
      this.#pending.delete(handle);
      this.#computerStep();
    });
    this.#pending.add(handle);
  }

  #computerStep() {
    if (this.status !== "playing" || this.state.turn === this.humanColor) return;
    const move = chooseMove(this.engine, this.state, this.difficulty, this.rng);
    if (!move) {
      this.#checkGameOver();
      return;
    }
    const result = this.#applyMove(move.from, move.to, "computer");
    if (!result.valid) {
      throw new Error(`The computer chose an illegal move: ${result.error}`);
    }
  }

  #cancelTimers() {
    this.#pending.forEach((handle) => handle.cancel());
    this.#pending.clear();
  }
}
