import { scoreMove } from "./heuristics.js";

export const DIFFICULTIES = Object.freeze(["easy", "medium", "hard"]);

export function isDifficulty(value) {
  return DIFFICULTIES.includes(value);
}

/** Probability that the computer plays a random legal move instead of the best one. */
const RANDOM_MOVE_CHANCE = Object.freeze({ easy: 1, medium: 0.35, hard: 0 });

/** [minimum, spread] of the computer's simulated thinking time in ms. */
const THINK_TIME = Object.freeze({
  easy: [1800, 2000],
  medium: [1200, 1300],
  hard: [550, 700]
});

export function getThinkDelay(difficulty, rng = Math.random) {
  const [base, spread] = THINK_TIME[difficulty] || THINK_TIME.easy;
  return base + rng() * spread;
}

/**
 * Pick a move for the side to move in `state`.
 * @returns {{from:number,to:number,captures:number[],capture:boolean,score:number}|null}
 */
export function chooseMove(engine, state, difficulty = "easy", rng = Math.random) {
  const candidates = [];
  engine.getAllLegalMoves(state, state.turn).forEach((moves, from) => {
    moves.forEach((move) => candidates.push({ from, ...move }));
  });
  if (candidates.length === 0) return null;

  const randomChance = RANDOM_MOVE_CHANCE[difficulty] ?? 1;
  if (rng() < randomChance) {
    const choice = candidates[Math.floor(rng() * candidates.length)];
    return { ...choice, score: NaN };
  }

  let best = [];
  let bestScore = -Infinity;
  candidates.forEach((candidate) => {
    const score = scoreMove(engine, state, candidate);
    if (score > bestScore) {
      bestScore = score;
      best = [candidate];
    } else if (score === bestScore) {
      best.push(candidate);
    }
  });
  const choice = best[Math.floor(rng() * best.length)];
  return { ...choice, score: bestScore };
}
