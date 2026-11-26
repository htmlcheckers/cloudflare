import { GameState } from "../game-state.js";
import { getBoardSize } from "../rulesets.js";

/**
 * Heuristic score of a candidate move. Pure: depends only on the rules engine
 * and the game state (no DOM). Higher is better for the side that moves.
 *
 * @param {import("../rules-engine.js").RulesEngine} engine
 * @param {GameState} state
 * @param {{from:number,to:number,captures:number[]}} move
 */
export function scoreMove(engine, state, move) {
  const piece = state.squares[move.from];
  if (!piece) throw new Error(`No piece on square ${move.from}`);
  const wasKing = piece.king;
  const opponentColor = piece.color === "white" ? "black" : "white";

  const simulation = GameState.fromJSON(state.toJSON());
  simulation.applyMove({
    from: move.from,
    to: move.to,
    captures: move.captures,
    keepTurn: false,
    revision: simulation.revision
  });

  const movedPiece = simulation.squares[move.to];
  const promotes = !wasKing && movedPiece.king;

  let immediateCaptures = 0;
  let capturesOfMovedPiece = 0;
  engine.getMandatoryCaptures(simulation, opponentColor).forEach((options) => {
    options.forEach((option) => {
      immediateCaptures += 1;
      if (option.captures.includes(move.to)) capturesOfMovedPiece += 1;
    });
  });

  const mobility = engine.getLegalMoves(simulation, move.to).length;
  const boardSize = getBoardSize(state.ruleset);
  const row = Math.floor(move.to / boardSize);
  const column = move.to % boardSize;
  const center = (boardSize - 1) / 2;
  const centerDistance = Math.abs(column - center) + Math.abs(row - center);
  const advancement = movedPiece.color === "white" ? -row : row;

  return (
    advancement * 2 +
    mobility * 2 -
    centerDistance +
    (promotes ? 80 : 0) -
    capturesOfMovedPiece * 100 -
    (immediateCaptures - capturesOfMovedPiece) * 10
  );
}
