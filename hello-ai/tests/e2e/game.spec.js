import { expect, test } from "@playwright/test";

test("computer vs computer visibly plays a full game", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(async () => {
    const [{ EventBus }, { GameSession }, { chooseMove }, { BoardView }, { LastMoveView }] =
      await Promise.all([
        import("/assets/js/services/event-bus.js"),
        import("/assets/js/app/game-session.js"),
        import("/assets/js/core/ai/index.js"),
        import("/assets/js/ui/board-view.js"),
        import("/assets/js/ui/last-move-view.js")
      ]);

    document.querySelectorAll("#game > #menu, #game > .menu-hidden")
      .forEach((menu) => menu.remove());
    const status = document.createElement("output");
    status.id = "self-play-status";
    status.dataset.state = "running";
    status.dataset.moves = "0";
    status.textContent = "Computer vs computer: starting";
    document.querySelector("#center").appendChild(status);

    let seed = 123456789;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const bus = new EventBus();
    const session = new GameSession({
      bus,
      rng,
      scheduler: {
        after(_delay, callback) {
          const timer = setTimeout(callback, 40);
          return () => clearTimeout(timer);
        }
      }
    });
    const boardView = new BoardView({
      root: document.querySelector("#game"),
      getMovesFrom: (square) => session.getMovesFrom(square),
      onMove: (from, to) => session.tryMove(from, to)
    });
    boardView.buildGrid("british");
    boardView.setOrientation("white");
    new LastMoveView({
      bus,
      i18n: { onChange() {}, t: (_key, { count }) => `${count} captured` }
    });

    const moveCounts = { player: 0, computer: 0 };
    bus.on("game:started", () => boardView.render(session.state));
    bus.on("game:move", (move) => {
      moveCounts[move.by] += 1;
      boardView.render(session.state);
      const legalMoves = session.getLegalMoves();
      boardView.setInteractive(session.isHumanTurn()
        ? { movable: [...legalMoves.keys()], forced: session.getForcedCaptureSquares() }
        : {});
      status.dataset.moves = String(moveCounts.player + moveCounts.computer);
      status.dataset.playerMoves = String(moveCounts.player);
      status.dataset.computerMoves = String(moveCounts.computer);
      status.textContent = `Computer vs computer: ${status.dataset.moves} moves`;
    });
    bus.on("game:turn", () => {
      const legalMoves = session.getLegalMoves();
      boardView.setInteractive(session.isHumanTurn()
        ? { movable: [...legalMoves.keys()], forced: session.getForcedCaptureSquares() }
        : {});
    });
    bus.on("game:over", ({ winner }) => {
      status.dataset.state = "complete";
      status.dataset.winner = winner;
      status.dataset.revision = String(session.snapshot().revision);
      status.dataset.playerMoves = String(moveCounts.player);
      status.dataset.computerMoves = String(moveCounts.computer);
      status.textContent = `Computer vs computer: ${winner} wins`;
    });

    session.configure({ ruleset: "british", difficulty: "easy", humanColor: "white" });
    session.start();

    const waitForPlayerTurn = () => new Promise((resolve, reject) => {
      let timeout;
      const unsubscribeTurn = bus.on("game:turn", ({ turn }) => {
        if (turn === "player") {
          clearTimeout(timeout);
          unsubscribeTurn();
          unsubscribeOver();
          resolve();
        }
      });
      const unsubscribeOver = bus.on("game:over", () => {
        clearTimeout(timeout);
        unsubscribeTurn();
        unsubscribeOver();
        resolve();
      });
      timeout = setTimeout(() => {
        unsubscribeTurn();
        unsubscribeOver();
        reject(new Error("Computer did not complete its turn"));
      }, 5000);
    });

    const pauseForPaint = () => new Promise((resolve) => setTimeout(resolve, 40));
    const runGame = async () => {
      try {
        let steps = 0;
        while (session.status === "playing" && steps < 300) {
          if (!session.isHumanTurn()) {
            throw new Error("Expected the simulated computer to have the turn");
          }
          const move = chooseMove(session.engine, session.state, "easy", rng);
          if (!move) throw new Error("The simulated computer has no legal move");
          const result = session.tryMove(move.from, move.to);
          if (!result.valid) {
            throw new Error(`The simulated computer made an illegal move: ${result.error}`);
          }

          if (session.status === "playing" && !session.isHumanTurn()) {
            await waitForPlayerTurn();
          }
          await pauseForPaint();
          steps += 1;
        }

        if (session.status !== "over") {
          throw new Error("The game did not finish within 300 moves");
        }
      } catch (error) {
        status.dataset.state = "failed";
        status.textContent = error.message;
      } finally {
        session.dispose();
      }
    };
    void runGame();
  });

  await expect(page.locator("#game > .square")).toHaveCount(64);
  await expect(page.locator("#game > .square.last-move")).toHaveCount(2);
  await expect.poll(async () =>
    Number(await page.locator("#self-play-status").getAttribute("data-moves"))
  ).toBeGreaterThan(1);
  await page.waitForFunction(() => {
    const status = document.querySelector("#self-play-status");
    if (status.dataset.state === "failed") throw new Error(status.textContent);
    return status.dataset.state === "complete";
  }, null, { timeout: 30000 });

  const game = await page.locator("#self-play-status").evaluate((status) => ({
    winner: status.dataset.winner,
    revision: Number(status.dataset.revision),
    playerMoves: Number(status.dataset.playerMoves),
    computerMoves: Number(status.dataset.computerMoves)
  }));
  expect(game.revision).toBeGreaterThan(0);
  expect(game.playerMoves).toBeGreaterThan(0);
  expect(game.computerMoves).toBeGreaterThan(0);
  expect(game.winner).toMatch(/^(player|computer)$/);
});
