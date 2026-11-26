import { GameState } from "../public/assets/js/core/game-state.js";
import { getBoardSize } from "../public/assets/js/core/rulesets.js";

/** Build a state from a map like { "5,2": "w", "3,4": "B" } ("row,col" → piece code). */
export function stateFrom(ruleset, pieces, turn = "white") {
  const size = getBoardSize(ruleset);
  const squares = Array(size * size).fill(null);
  for (const [position, code] of Object.entries(pieces)) {
    const [row, column] = position.split(",").map(Number);
    squares[row * size + column] = {
      color: code.toLowerCase() === "w" ? "white" : "black",
      king: code === code.toUpperCase()
    };
  }
  return new GameState({ squares, turn, ruleset });
}

export const sq = (ruleset, row, column) => row * getBoardSize(ruleset) + column;

/** Scheduler whose timers run only when the test says so. */
export function manualScheduler() {
  const queue = [];
  return {
    after(ms, callback) {
      const entry = { callback, active: true };
      queue.push(entry);
      return () => { entry.active = false; };
    },
    runNext() {
      while (queue.length) {
        const entry = queue.shift();
        if (entry.active) { entry.callback(); return true; }
      }
      return false;
    },
    get pending() { return queue.filter((e) => e.active).length; }
  };
}

export function memoryBackend() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
}
