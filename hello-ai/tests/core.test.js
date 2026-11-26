import test from "node:test";
import assert from "node:assert/strict";
import { GameState } from "../public/assets/js/core/game-state.js";
import { RulesEngine } from "../public/assets/js/core/rules-engine.js";
import { toSquareNumber } from "../public/assets/js/core/rulesets.js";
import { chooseMove } from "../public/assets/js/core/ai/index.js";
import { stateFrom, sq } from "./helpers.js";

test("initial positions have the right material", () => {
  const british = GameState.initial("british").getMaterial();
  assert.deepEqual(british.white, { men: 12, kings: 0 });
  assert.deepEqual(british.black, { men: 12, kings: 0 });
  const intl = GameState.initial("international").getMaterial();
  assert.equal(intl.white.men, 20);
  assert.equal(intl.black.men, 20);
});

test("notation and square numbers", () => {
  const state = GameState.initial("international");
  assert.match(state.toNotation(), /^w bbbbb\/bbbbb\/bbbbb\/bbbbb\/\.{5}\/\.{5}\/wwwww/);
  assert.equal(toSquareNumber(1, "international"), 1);
  assert.equal(toSquareNumber(98, "international"), 50);
});

test("legal first moves: 7 for white in British, 9 in International", () => {
  const british = new RulesEngine("british");
  const moves = british.getAllLegalMoves(GameState.initial("british"), "white");
  assert.equal([...moves.values()].reduce((n, list) => n + list.length, 0), 7);
  const intl = new RulesEngine("international");
  const m2 = intl.getAllLegalMoves(GameState.initial("international"), "white");
  assert.equal([...m2.values()].reduce((n, list) => n + list.length, 0), 9);
});

test("captures are mandatory (British)", () => {
  const engine = new RulesEngine("british");
  const state = stateFrom("british", { "5,2": "w", "4,3": "b", "6,5": "w" });
  const moves = engine.getAllLegalMoves(state, "white");
  assert.deepEqual([...moves.keys()], [sq("british", 5, 2)]);
  assert.equal(moves.get(sq("british", 5, 2))[0].capture, true);
  const bad = engine.validateMove(state, { from: sq("british", 6, 5), to: sq("british", 5, 4) });
  assert.equal(bad.valid, false);
});

test("international: longest capture is mandatory", () => {
  const engine = new RulesEngine("international");
  const state = stateFrom("international", {
    "9,0": "w", "8,1": "b", // single capture available to this man
    "9,4": "w", "8,5": "b", "6,5": "b", "4,5": "b" // double or more via 9,4→7,6 ...
  });
  const moves = engine.getAllLegalMoves(state, "white");
  const first = moves.get(sq("international", 9, 4));
  assert.ok(first, "the piece with the longer sequence must be the only mover");
  assert.equal(moves.has(sq("international", 9, 0)), false);
});

test("men promote on the last row and kings are flagged", () => {
  const state = stateFrom("british", { "1,2": "w", "7,0": "b" });
  state.applyMove({ from: sq("british", 1, 2), to: sq("british", 0, 1) });
  assert.equal(state.squares[sq("british", 0, 1)].king, true);
});

test("applyMove rejects stale revisions", () => {
  const state = GameState.initial("british");
  assert.throws(() => state.applyMove({ from: 40, to: 33, revision: 99 }), /stale/);
});

test("AI never returns an illegal move and always captures when forced", () => {
  const engine = new RulesEngine("british");
  const state = stateFrom("british", { "5,2": "w", "4,3": "b", "2,1": "b" }, "black");
  for (const difficulty of ["easy", "medium", "hard"]) {
    const move = chooseMove(engine, state, difficulty);
    assert.ok(engine.validateMove(state, move).valid);
  }
  const forced = stateFrom("british", { "5,2": "w", "4,3": "b", "6,5": "w" }, "white");
  const move = chooseMove(engine, forced, "hard");
  assert.equal(move.capture, true);
});
