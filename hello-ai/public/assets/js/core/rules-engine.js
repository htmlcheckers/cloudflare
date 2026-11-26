import { GameState } from "./game-state.js";
import {
  DEFAULT_RULESET,
  RULESETS,
  getBoardSize,
  getSquareCount,
  isRuleset
} from "./rulesets.js";

export { getBoardSize, getSquareCount, RULESETS };

const DIAGONALS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

function cloneOccupancy(squares) {
  return squares.map((item) => (item ? { ...item } : null));
}

export class RulesEngine {
  constructor(ruleset = DEFAULT_RULESET) {
    if (!isRuleset(ruleset)) throw new RangeError(`Unsupported ruleset: ${ruleset}`);
    this.ruleset = ruleset;
    this.config = RULESETS[ruleset];
    this.boardSize = this.config.boardSize;
    this.squareCount = this.boardSize * this.boardSize;
  }

  getCapturePaths(state, from) {
    if (!(state instanceof GameState) && (!state || !Array.isArray(state.squares))) {
      throw new TypeError("A GameState snapshot is required");
    }

    const piece = state.squares[from];
    if (!piece) return [];

    const size = this.boardSize;
    const inBoard = (row, column) => row >= 0 && row < size && column >= 0 && column < size;
    const at = (row, column) => row * size + column;
    const occupancy = cloneOccupancy(state.squares);
    const pending = state.pendingCaptures || [];
    const paths = [];

    const restore = (original) => {
      for (let i = 0; i < occupancy.length; i++) occupancy[i] = original[i];
    };

    const search = (current, isKing, captured, steps) => {
      let foundCapture = false;
      const currentRow = Math.floor(current / size);
      const currentColumn = current % size;

      if (isKing && this.config.flyingKings) {
        DIAGONALS.forEach(([rowStep, columnStep]) => {
          let enemy = null;
          let nextRow = currentRow + rowStep;
          let nextColumn = currentColumn + columnStep;
          while (inBoard(nextRow, nextColumn)) {
            const square = at(nextRow, nextColumn);
            const occupant = occupancy[square];
            if (enemy === null) {
              if (occupant) {
                if (
                  occupant.color !== piece.color &&
                  !captured.includes(square) &&
                  !pending.includes(square)
                ) {
                  enemy = square;
                } else break;
              }
            } else {
              if (occupant) break;
              const next = cloneOccupancy(occupancy);
              next[current] = null;
              if (!this.config.deferCapturedPieces) next[enemy] = null;
              next[square] = { color: piece.color, king: true };
              const original = cloneOccupancy(occupancy);
              for (let i = 0; i < occupancy.length; i++) occupancy[i] = next[i];
              foundCapture = true;
              search(
                square,
                true,
                [...captured, enemy],
                [...steps, { to: square, capture: enemy }]
              );
              restore(original);
            }
            nextRow += rowStep;
            nextColumn += columnStep;
          }
        });
      } else {
        const manDirections = isKing
          ? DIAGONALS
          : piece.color === "white"
            ? this.config.menCaptureBackward ? DIAGONALS : [[-1, -1], [-1, 1]]
            : this.config.menCaptureBackward ? DIAGONALS : [[1, -1], [1, 1]];
        manDirections.forEach(([rowStep, columnStep]) => {
          const enemyRow = currentRow + rowStep;
          const enemyColumn = currentColumn + columnStep;
          const landingRow = currentRow + rowStep * 2;
          const landingColumn = currentColumn + columnStep * 2;
          if (!inBoard(landingRow, landingColumn)) return;
          const enemy = at(enemyRow, enemyColumn);
          const landing = at(landingRow, landingColumn);
          const enemyPiece = occupancy[enemy];
          if (
            enemyPiece &&
            enemyPiece.color !== piece.color &&
            !captured.includes(enemy) &&
            !pending.includes(enemy) &&
            occupancy[landing] === null
          ) {
            const next = cloneOccupancy(occupancy);
            next[current] = null;
            if (!this.config.deferCapturedPieces) next[enemy] = null;
            const promotionRow = landingRow === 0 || landingRow === size - 1;
            const becomesKing = isKing || (
              promotionRow &&
              !this.config.menCaptureBackward
            );
            next[landing] = { color: piece.color, king: becomesKing };
            const original = cloneOccupancy(occupancy);
            for (let i = 0; i < occupancy.length; i++) occupancy[i] = next[i];
            foundCapture = true;
            const nextSteps = [...steps, { to: landing, capture: enemy }];
            if (becomesKing && !isKing) {
              paths.push({
                to: landing,
                captures: [...captured, enemy],
                steps: nextSteps
              });
            } else {
              search(landing, becomesKing, [...captured, enemy], nextSteps);
            }
            restore(original);
          }
        });
      }
      if (!foundCapture && captured.length > 0) {
        paths.push({ to: current, captures: [...captured], steps });
      }
    };

    search(from, Boolean(piece.king), [], []);
    return paths;
  }

  getFirstCaptureOptions(paths, longest = null) {
    const options = new Map();
    paths.forEach((path) => {
      if (longest !== null && path.captures.length !== longest) return;
      const step = path.steps[0];
      if (!options.has(step.to)) {
        options.set(step.to, { to: step.to, captures: [step.capture] });
      }
    });
    return [...options.values()];
  }

  getCaptureOptions(state, from) {
    if (!(state instanceof GameState) && (!state || !Array.isArray(state.squares))) {
      throw new TypeError("A GameState snapshot is required");
    }
    if (state.continuationSquare != null && state.continuationSquare !== from) {
      return [];
    }
    const paths = this.getCapturePaths(state, from);
    if (paths.length === 0) return [];
    const longest = this.config.longestCaptureMandatory
      ? Math.max(...paths.map((path) => path.captures.length))
      : null;
    return this.getFirstCaptureOptions(paths, longest);
  }

  getSimpleMoves(state, from) {
    const piece = state.squares[from];
    if (!piece) return [];
    const row = Math.floor(from / this.boardSize);
    const column = from % this.boardSize;
    const inBoard = (nextRow, nextColumn) =>
      nextRow >= 0 && nextRow < this.boardSize &&
      nextColumn >= 0 && nextColumn < this.boardSize;
    const at = (nextRow, nextColumn) => nextRow * this.boardSize + nextColumn;
    const directions = piece.king
      ? DIAGONALS
      : piece.color === "white"
        ? [[-1, -1], [-1, 1]]
        : [[1, -1], [1, 1]];

    const moves = [];
    if (piece.king && this.config.flyingKings) {
      directions.forEach(([rowStep, columnStep]) => {
        let nextRow = row + rowStep;
        let nextColumn = column + columnStep;
        while (inBoard(nextRow, nextColumn)) {
          const square = at(nextRow, nextColumn);
          if (state.squares[square]) break;
          moves.push(square);
          nextRow += rowStep;
          nextColumn += columnStep;
        }
      });
    } else {
      directions.forEach(([rowStep, columnStep]) => {
        const nextRow = row + rowStep;
        const nextColumn = column + columnStep;
        if (!inBoard(nextRow, nextColumn)) return;
        const square = at(nextRow, nextColumn);
        if (state.squares[square] === null) moves.push(square);
      });
    }
    return moves;
  }

  getMandatoryCaptures(state, color) {
    const captures = new Map();
    let longest = 0;
    for (let from = 0; from < this.squareCount; from++) {
      if (state.continuationSquare != null && from !== state.continuationSquare) {
        continue;
      }
      const piece = state.squares[from];
      if (piece && piece.color === color) {
        const paths = this.getCapturePaths(state, from);
        if (paths.length > 0) {
          const length = Math.max(...paths.map((path) => path.captures.length));
          longest = Math.max(longest, length);
          captures.set(from, { paths, length });
        }
      }
    }
    if (this.config.longestCaptureMandatory) {
      for (const [from, result] of captures) {
        if (result.length !== longest) {
          captures.delete(from);
          continue;
        }
        captures.set(
          from,
          this.getFirstCaptureOptions(result.paths, result.length)
        );
      }
    } else {
      for (const [from, result] of captures) {
        captures.set(from, this.getFirstCaptureOptions(result.paths));
      }
    }
    return captures;
  }

  /**
   * Every legal move of `color`, computed once.
   * Returns Map<from, Array<{ to, captures, capture }>>.
   * Mandatory-capture rules (including "longest capture") and capture
   * continuations are already applied, so callers never need to re-derive them.
   */
  getAllLegalMoves(state, color = state.turn) {
    const result = new Map();
    const mandatory = this.getMandatoryCaptures(state, color);
    if (mandatory.size > 0) {
      mandatory.forEach((options, from) => {
        result.set(
          from,
          options.map((option) => ({
            to: option.to,
            captures: option.captures.slice(),
            capture: true
          }))
        );
      });
      return result;
    }
    if (state.continuationSquare != null) return result;
    for (let from = 0; from < this.squareCount; from++) {
      const piece = state.squares[from];
      if (!piece || piece.color !== color) continue;
      const moves = this.getSimpleMoves(state, from);
      if (moves.length > 0) {
        result.set(from, moves.map((to) => ({ to, captures: [], capture: false })));
      }
    }
    return result;
  }

  getLegalMoves(state, from) {
    if (!state || !Array.isArray(state.squares)) {
      throw new TypeError("A GameState snapshot is required");
    }
    const piece = state.squares[from];
    if (!piece) return [];
    const moves = this.getAllLegalMoves(state, piece.color).get(from) || [];
    return moves.map((move) => move.to);
  }

  getCaptureMoves(state, from) {
    return this.getCaptureOptions(state, from).map((option) => option.to);
  }

  validateMove(state, command) {
    if (!command || !Number.isInteger(command.from) || !Number.isInteger(command.to)) {
      return { valid: false, error: "Move must contain integer from and to squares" };
    }
    if (
      state.continuationSquare != null &&
      command.from !== state.continuationSquare
    ) {
      return { valid: false, error: "The same piece must continue capturing" };
    }
    const piece = state.squares[command.from];
    if (!piece) return { valid: false, error: "The source square is empty" };
    if (piece.color !== state.turn) return { valid: false, error: "It is not this piece's turn" };
    if (state.squares[command.to]) return { valid: false, error: "The destination square is occupied" };

    const moves = this.getAllLegalMoves(state, piece.color);
    const mandatory = [...moves.values()].some((list) => list.some((move) => move.capture));
    const options = moves.get(command.from) || [];
    if (state.continuationSquare != null && options.length === 0) {
      return { valid: false, error: "A capture continuation is mandatory" };
    }
    const match = options.find((option) => option.to === command.to);
    if (match) return { valid: true, captures: match.captures, capture: match.capture };
    if (mandatory) {
      return {
        valid: false,
        error: moves.has(command.from) ? "The capture is illegal" : "A capture is mandatory"
      };
    }
    return { valid: false, error: "The move is illegal" };
  }

  hasLegalMoves(state, color) {
    return this.getAllLegalMoves(state, color).size > 0;
  }
}

export class CheckersRules extends RulesEngine {}

export function getLegalMoves(state, from, ruleset = DEFAULT_RULESET) {
  return new RulesEngine(ruleset).getLegalMoves(state, from);
}

export function validateMove(state, command, ruleset = DEFAULT_RULESET) {
  return new RulesEngine(ruleset).validateMove(state, command);
}
