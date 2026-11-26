export const DEFAULT_RULESET = "international";

export const RULESETS = Object.freeze({
  british: Object.freeze({
    boardSize: 8,
    pieceRows: 3,
    menCaptureBackward: false,
    flyingKings: false,
    longestCaptureMandatory: false,
    deferCapturedPieces: false
  }),
  international: Object.freeze({
    boardSize: 10,
    pieceRows: 4,
    menCaptureBackward: true,
    flyingKings: true,
    longestCaptureMandatory: true,
    deferCapturedPieces: true
  })
});

export function isRuleset(name) {
  return typeof name === "string" && Object.hasOwn(RULESETS, name);
}

export function getBoardSize(ruleset = DEFAULT_RULESET) {
  if (!isRuleset(ruleset)) throw new RangeError(`Unsupported ruleset: ${ruleset}`);
  return RULESETS[ruleset].boardSize;
}

export function getSquareCount(ruleset = DEFAULT_RULESET) {
  return getBoardSize(ruleset) ** 2;
}

/**
 * Standard draughts numbering of a dark square (1..N/2, row by row from the
 * top-left dark square). Used for human-readable move history.
 */
export function toSquareNumber(index, ruleset = DEFAULT_RULESET) {
  const size = getBoardSize(ruleset);
  const row = Math.floor(index / size);
  const column = index % size;
  return row * (size / 2) + Math.floor(column / 2) + 1;
}
