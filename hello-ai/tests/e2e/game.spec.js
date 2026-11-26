import { expect, test } from "@playwright/test";

test("ruleset selection, Rules screen, and capture history preserve the board", async ({ page }) => {
  await page.goto("/");
  await page.locator("#vs-computer").click();
  await page.locator("#ruleset-select").selectOption("british");
  await page.locator("#ruleset-select").selectOption("international");

  await expect(page.locator("#start-computer")).toBeVisible();
  await page.locator("#start-computer").click();
  await expect(page.locator("#game > .square")).toHaveCount(100);
  await expect(page.locator("#game > .square .piece")).toHaveCount(40);

  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent("checkers:move", {
      detail: {
        from: 44,
        to: 55,
        captures: [1],
        pendingCaptures: [1],
        mover: "white",
        turnCompleted: false
      }
    }));
  });
  await expect(page.locator(".last-captured-ghost")).toHaveCount(0);
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent("checkers:move", {
      detail: {
        from: 55,
        to: 66,
        captures: [21],
        pendingCaptures: [],
        mover: "white",
        turnCompleted: true
      }
    }));
  });
  await expect(page.locator(".last-captured-ghost")).toHaveCount(2);
  await expect(page.locator("#removedw .capture-counter")).toHaveText("2");
  await expect(page.locator("#removedw .capture-counter")).toHaveClass(/capture-counter-white/);
  await expect(page.locator("#removedw .piece-out-white")).toHaveCount(0);
  const [counterTop, boardTop] = await Promise.all([
    page.locator("#removedw .capture-counter").evaluate((counter) =>
      counter.getBoundingClientRect().top
    ),
    page.locator("#game").evaluate((board) => board.getBoundingClientRect().top)
  ]);
  expect(counterTop).toBeLessThanOrEqual(boardTop + 1);
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent("checkers:move", {
      detail: {
        from: 66,
        to: 77,
        captures: [],
        pendingCaptures: [],
        mover: "black",
        turnCompleted: true
      }
    }));
  });
  await expect(page.locator(".last-captured-ghost")).toHaveCount(0);
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent("checkers:move", {
      detail: {
        from: 66,
        to: 77,
        captures: [31],
        pendingCaptures: [],
        mover: "black",
        turnCompleted: true
      }
    }));
  });
  await expect(page.locator("#removedb .capture-counter")).toHaveText("1");
  await expect(page.locator("#removedb .capture-counter")).toHaveClass(/capture-counter-black/);

  await page.locator(".menu-hidden").click();
  await page.locator("#rules").click();
  await expect(page.locator("#menu")).toContainText("International draughts");
  await expect(page.locator("#game > .square")).toHaveCount(100);
  await expect(page.locator("#game > .square .piece")).toHaveCount(40);
});

test("language can be changed from the in-game options menu", async ({ page }) => {
  await page.goto("/");
  await page.locator("#vs-computer").click();
  await page.locator("#start-computer").click();

  await page.locator(".menu-hidden").click();
  await expect(page.locator("#menu #options")).toBeVisible();
  await page.locator("#options").click();
  await page.locator("#language-select").selectOption("fr");

  await expect(page.locator("#language-select")).toHaveValue("fr");
  await expect(page.locator("#menu")).toContainText("Langue");
  await expect(page.locator("#game > .square")).toHaveCount(100);
  await expect(page.locator("#game > .square .piece")).toHaveCount(40);
  expect(await page.evaluate(() => ({
    boardLanguage: window.checkersBoard.language,
    documentLanguage: document.documentElement.lang
  }))).toEqual({ boardLanguage: "fr", documentLanguage: "fr" });

  await page.locator("#back").click();
  await expect(page.locator("#menu #options")).toHaveText("Options");
  await expect(page.locator("#menu #rules")).toHaveText("Règles");
});

test("captured-piece marker matches board piece size on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.locator("#vs-computer").click();
  await page.locator("#start-computer").click();

  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent("checkers:move", {
      detail: {
        from: 44,
        to: 55,
        captures: [1],
        pendingCaptures: [],
        mover: "white",
        turnCompleted: true
      }
    }));
  });

  const [capturedPieceBounds, boardPieceBounds] = await Promise.all([
    page.locator(".last-captured-ghost").evaluate((piece) => {
      const { width, height } = piece.getBoundingClientRect();
      return { width, height };
    }),
    page.locator("#game .piece").first().evaluate((piece) => {
      const { width, height } = piece.getBoundingClientRect();
      return { width, height };
    })
  ]);
  expect(capturedPieceBounds).toEqual(boardPieceBounds);
});

test("hard computer only considers globally legal longest captures", async ({ page }) => {
  await page.goto("/");

  const captureSources = await page.evaluate(async () => {
    const { RulesEngine } = await import("/assets/js/core/rules-engine.js");
    const board = window.checkersBoard;
    const squares = Array(100).fill(null);
    squares[11] = { color: "white", king: false };
    squares[22] = { color: "black", king: false };
    squares[44] = { color: "black", king: false };
    squares[71] = { color: "white", king: false };
    squares[82] = { color: "black", king: false };
    const pieces = [{}, {}];

    board.ruleset = "international";
    board.rulesEngine = new RulesEngine("international");
    board.gameState = {
      squares,
      turn: "white",
      ruleset: "international",
      revision: 0,
      pendingCaptures: [],
      continuationSquare: null
    };
    board.piecePositions = new WeakMap([
      [pieces[0], 11],
      [pieces[1], 71]
    ]);

    return board.getComputerCaptures(pieces).map(([piece]) =>
      board.piecePositions.get(piece)
    );
  });

  expect(captureSources).toEqual([11]);
});

test("forced-capture highlight only includes globally longest International captures", async ({ page }) => {
  await page.goto("/");

  const highlightedSources = await page.evaluate(async () => {
    const { RulesEngine } = await import("/assets/js/core/rules-engine.js");
    const board = window.checkersBoard;
    const squares = Array(100).fill(null);
    squares[11] = { color: "white", king: false };
    squares[22] = { color: "black", king: false };
    squares[44] = { color: "black", king: false };
    squares[71] = { color: "white", king: false };
    squares[82] = { color: "black", king: false };
    const pieces = [11, 71].map((square) => {
      const piece = document.createElement("div");
      piece.className = "piece piece-white";
      board.piecePositions.set(piece, square);
      return piece;
    });

    board.ruleset = "international";
    board.rulesEngine = new RulesEngine("international");
    board.gameState = {
      squares,
      turn: "white",
      ruleset: "international",
      revision: 0,
      pendingCaptures: [],
      continuationSquare: null
    };
    board.playerColor = "piece-white";
    board.pieceTaking = null;
    board.optionHighlight = true;

    board.checkIfcanTake(pieces);
    return pieces
      .filter((piece) => piece.classList.contains("highlight"))
      .map((piece) => board.piecePositions.get(piece));
  });

  expect(highlightedSources).toEqual([11]);
});

test("runs a full computer-vs-computer party", async ({ page }) => {
  await page.goto("/");
  await page.locator("#vs-computer").click();
  await page.locator("#difficulty-select").selectOption("hard");
  await page.locator("#ruleset-select").selectOption("british");
  await page.locator("#start-computer").click();

  await expect(page.locator("#game > .square")).toHaveCount(64);
  await expect(page.locator("#game > .square .piece")).toHaveCount(24);
  const initialRevision = await page.evaluate(
    () => window.checkersBoard.gameState.revision
  );

  for (let turn = 0; turn < 1000; turn += 1) {
    const stateBeforeMove = await page.evaluate(() => ({
      revision: window.checkersBoard.gameState.revision,
      turn: window.checkersBoard.gameState.turn
    }));

    if (await page.locator("#game-over").count()) break;

    const moveStarted = await page.evaluate(() => {
      if (window.checkersBoard.gameOver) return false;
      if (window.checkersBoard.pieceTaking) return true;

      const currentTurn = window.checkersBoard.gameState.turn;
      window.checkersBoard.setPlayerColor(currentTurn === "white" ? "black" : "white");
      window.checkersBoard.computerMove();
      return true;
    });

    expect(moveStarted).toBe(true);

    await page.waitForFunction(({ revision, turn }) => {
      if (document.querySelector("#game-over")) return true;
      if (window.checkersBoard.pieceTaking) return false;
      return window.checkersBoard.gameState.revision > revision
        || window.checkersBoard.gameState.turn !== turn;
    }, stateBeforeMove, { timeout: 5000 });
  }

  const finalState = await page.evaluate(() => ({
    revision: window.checkersBoard.gameState.revision,
    pieceCount: window.checkersBoard.gameState.squares.filter(Boolean).length
  }));
  expect(finalState.revision).toBeGreaterThan(initialRevision);
  expect(finalState.pieceCount).toBeLessThanOrEqual(24);
});

test("French chat is shown below the board on desktop and toggles on compact screens", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.locator("#vs-computer").click();
  await page.locator("#start-computer").click();

  await expect(page.locator("#chat-toggle")).toBeVisible();
  await expect(page.locator("#computer-chat")).toBeVisible();
  await expect(page.locator("#chat-persona")).toHaveText("Lucas");

  const [boardBounds, squareBounds, chatTop] = await Promise.all([
    page.locator("#game").evaluate(board => {
      const { top, width, height, bottom } = board.getBoundingClientRect();
      return { top, width, height, bottom };
    }),
    page.locator("#game > .square").first().evaluate(square => {
      const { width, height } = square.getBoundingClientRect();
      return { width, height };
    }),
    page.locator("#computer-chat").evaluate(chat => chat.getBoundingClientRect().top)
  ]);
  expect(boardBounds.top).toBeGreaterThanOrEqual(16);
  expect(Math.abs(boardBounds.width - boardBounds.height)).toBeLessThan(1);
  expect(Math.abs(squareBounds.width - squareBounds.height)).toBeLessThan(1);
  expect(chatTop).toBeGreaterThanOrEqual(boardBounds.bottom);
  expect(await page.evaluate(() => document.documentElement.scrollHeight))
    .toBeLessThanOrEqual(900);

  const input = page.locator("#chat-input");
  await expect(input).toBeEnabled();
  await input.fill("Bien joué !");
  const sentAt = Date.now();
  await page.locator("#chat-send").click();
  const reply = page.locator(".chat-message-computer").last();
  await expect(reply).toContainText(/merci|chance/i);
  await expect(page.locator(".chat-thinking")).toHaveCount(0);
  expect(Date.now() - sentAt).toBeGreaterThanOrEqual(1200);

  await page.setViewportSize({ width: 390, height: 700 });
  await expect(page.locator("#computer-chat")).toBeHidden();
  await page.locator("#chat-toggle").click();
  await expect(page.locator("#computer-chat")).toBeVisible();
});
