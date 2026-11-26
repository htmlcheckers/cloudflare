import test from "node:test";
import assert from "node:assert/strict";
import { GameSession } from "../public/assets/js/app/game-session.js";
import { EventBus } from "../public/assets/js/services/event-bus.js";
import { createStorage } from "../public/assets/js/services/storage.js";
import { manualScheduler, memoryBackend } from "./helpers.js";

function setup(opts = {}) {
  const bus = new EventBus();
  const scheduler = manualScheduler();
  const storage = createStorage(() => memoryBackend());
  const session = new GameSession({ bus, storage, scheduler, ...opts });
  const events = [];
  ["game:configured", "game:started", "game:move", "game:turn", "game:over"].forEach((type) =>
    bus.on(type, (detail) => events.push({ type, detail }))
  );
  return { bus, scheduler, session, events };
}

test("start emits started + turn and waits for the human", () => {
  const { session, events, scheduler } = setup();
  session.configure({ ruleset: "british", humanColor: "white" });
  session.start();
  assert.deepEqual(events.map((e) => e.type), ["game:configured", "game:started", "game:turn"]);
  assert.equal(events.at(-1).detail.turn, "player");
  assert.equal(scheduler.pending, 0);
});

test("playing black: the computer opens after a scheduled delay", () => {
  const { session, events, scheduler } = setup();
  session.configure({ ruleset: "british", humanColor: "black", difficulty: "hard" });
  session.start();
  assert.equal(scheduler.pending, 1);
  scheduler.runNext();
  const move = events.find((e) => e.type === "game:move").detail;
  assert.equal(move.by, "computer");
  assert.equal(move.color, "white");
  assert.equal(session.isHumanTurn(), true);
});

test("human move + computer reply; snapshot exposes chat-ready context", () => {
  const { session, scheduler } = setup();
  session.configure({ ruleset: "british", humanColor: "white" });
  session.start();
  const [from, moves] = [...session.getLegalMoves()][0];
  const result = session.tryMove(from, moves[0].to);
  assert.equal(result.valid, true);
  assert.equal(session.tryMove(from, moves[0].to).valid, false, "not the human's turn any more");
  scheduler.runNext();
  const snapshot = session.snapshot();
  assert.equal(snapshot.turn, "player");
  assert.equal(snapshot.history.length, 2);
  assert.equal(snapshot.history[0].by, "player");
  assert.equal(snapshot.material.player.men, 12);
  assert.match(snapshot.notation, /^w /);
});

test("rulesets and colours cannot change mid-game", () => {
  const { session } = setup();
  session.configure({ ruleset: "british" });
  session.start();
  assert.throws(() => session.configure({ ruleset: "international" }), /during a game/);
  assert.throws(() => session.configure({ humanColor: "black" }), /during a game/);
  session.configure({ difficulty: "hard" });
});

test("random full games always finish without errors (both rulesets)", () => {
  for (const ruleset of ["british", "international"]) {
    for (let game = 0; game < 6; game++) {
      const { session, scheduler, events } = setup();
      session.configure({ ruleset, humanColor: game % 2 ? "black" : "white", difficulty: "easy" });
      session.start();
      let plies = 0;
      while (session.status === "playing" && plies++ < 600) {
        if (session.isHumanTurn()) {
          const all = [...session.getLegalMoves()].flatMap(([from, list]) => list.map((m) => ({ from, to: m.to })));
          const pick = all[Math.floor(Math.random() * all.length)];
          assert.equal(session.tryMove(pick.from, pick.to).valid, true);
        } else {
          assert.equal(scheduler.runNext(), true);
        }
      }
      const over = events.find((e) => e.type === "game:over");
      if (over) assert.ok(["player", "computer"].includes(over.detail.winner));
      session.dispose();
    }
  }
});

test("a won game emits game:over exactly once and stops the clock", () => {
  const { session, events, scheduler } = setup();
  session.configure({ ruleset: "british" });
  session.start();
  // Force a nearly finished position through the public state object.
  session.state.squares.fill(null);
  session.state.squares[5 * 8 + 2] = { color: "white", king: false };
  session.state.squares[4 * 8 + 3] = { color: "black", king: false };
  session.state.revision += 1;
  const moves = session.getLegalMoves();
  const from = 5 * 8 + 2;
  assert.ok(moves.has(from));
  session.tryMove(from, moves.get(from)[0].to);
  assert.equal(events.filter((e) => e.type === "game:over").length, 1);
  assert.equal(events.find((e) => e.type === "game:over").detail.winner, "player");
  assert.equal(session.status, "over");
  assert.equal(scheduler.pending, 0);
});
