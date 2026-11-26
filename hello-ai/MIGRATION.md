# Refactor: what changed and how to apply it

Drop the contents of `public/` over your repository's `public/` folder, then **delete** the files that no longer exist:

```
public/assets/js/script.js                       → replaced by main.js + app.js + ui/*
public/assets/js/last-move.js                    → ui/last-move-view.js
public/assets/js/chat/french_chat.js             → ui/chat-panel.js + chat/chat-controller.js
public/assets/js/chat/french_checkers_chat.js    → chat/bot/*
```

Unchanged: `assets/css/*`, `assets/audio/*`, favicon, and your `/chat` proxy.
`package.json`, `tests/` are optional (dev only): `npm install && npm test`.

## New layout

```
assets/js/
├── main.js                    entry point (3 lines)
├── app.js                     composition root: wires everything, no globals
├── config.js                  reads window.APP_VERSION / window.llm_url once
├── core/                      pure, no DOM (Node-testable)
│   ├── rulesets.js            + pieceRows, DEFAULT_RULESET, toSquareNumber
│   ├── game-state.js          + initial(), empty(), clone(), getMaterial(), toNotation()
│   ├── rules-engine.js        + getAllLegalMoves(); static imports
│   └── ai/                    heuristics.js, index.js (chooseMove, thinkDelay)
├── app/
│   ├── game-session.js        owns state, turns, history, outcome, computer player; emits events
│   └── chat-context.js        builds the ChatContext snapshot
├── services/                  event-bus, storage, i18n, sound, scores
├── locales/                   en.js, fr.js (UI + chat panel strings)
├── ui/                        dom, board-view, game-presenter, menu, toolbar,
│                              last-move-view, chat-panel
└── chat/
    ├── chat-controller.js     game events ⇄ bot ⇄ panel
    └── bot/                   companion-bot, nlu, player-memory, message-queue,
                               llm-client, safety, packs/{fr,en,index}.js
```

## Events (replace the `checkers:*` DOM events)

| Event | Payload (plain data) |
|---|---|
| `game:configured` | `changed[]`, `ruleset`, `difficulty`, `humanColor` |
| `game:started` | `snapshot` |
| `game:move` | `by`, `color`, `from`, `to`, `captures`, `capturedPieces`, `removed`, `pendingCaptures`, **`promoted`**, `turnCompleted`, `totals`, `capturedByColor` |
| `game:turn` | `turn` (`"player"`/`"computer"`), `color`, `continuing` |
| `game:over` | `winner` (role), `winnerColor`, `reason` |

## How the chat gets context now

1. **Push**: `ChatController` turns `game:move` / `game:turn` / `game:over` into bot events
   (`playerCapture`, `botMultiCapture`, `playerKing`, `botWin`, …) and starts the idle timer.
   Capture steps are accumulated per turn, so a multi-capture is commented once.
   These events were defined in the old bot but never fired.
2. **Pull**: the bot calls `getContext()` → `ChatContext`:
   ```js
   { game: { ruleset, difficulty, status, turn, moveNumber, playerColor,
             score: {player, computer}, material: {player:{men,kings}, computer:{…}},
             lastMoves: [{by, from, to, captures, promoted}], position: "w bbbbb/…" },
     player:  { name, topics, gamesPlayed, lossStreak },
     session: { language, hour, recentDistress } }
   ```
3. **To the proxy**: the request body is still `{ messages, context }`. `context` keeps the old
   flat fields (`botName`, `playerName`, `topics`, `gameMood`, `playerMorale`, `turn`,
   `gamesPlayed`, `language`, `recentLosses`, `recentDistress`, `hour`) so the current proxy
   keeps working, and adds `context.game` (the snapshot above). Update your proxy's system prompt
   to use it (e.g. "the player has captured N pieces, it is the player's turn…").
   Treat all of it, including `messages`, as untrusted input on the proxy side.

## Behaviour changes to be aware of

- **Chat language follows the UI language** (English pack added). Crisis resources are locale-specific
  (FR: 3114/15/112; EN: generic + 988 / Samaritans 116 123 / local emergency number).
- Score keys are now `playerScore` / `computerScore`; legacy `whiteScore` / `blackScore` are migrated on first load.
- The game-over check runs immediately after the turn; the dialog still appears after 1 s.
- "Restart" and "OK" on the game-over dialog still call `location.reload()` (injectable via `createApp({ reload })`).
- Rule engine: `validateMove` now derives everything from `getAllLegalMoves`, so a non-longest capture
  is consistently rejected in International draughts. Default ruleset is `international` everywhere.
- Cache busting: `index.html` builds an import map that maps every module URL to `…?v=<APP_VERSION>`.
  **When you add a module, add it to the list in `index.html`** (a test fails if you forget).
  Requires import-map support (all current browsers; Safari ≥ 16.4).
- Removed dead/unreachable code (`setRuleset` tail, `timerIds`, `removeMoving`, `needTake`/`takeIt`/`pieceTaking`).
- Bot: `forgetPlayer()` is available (`app.chat.bot.forgetPlayer()`); wire it to a button if you want a "forget me" option.

## Tests (`npm test`)

- `core.test.js` – rules, mandatory/longest capture, promotion, AI legality
- `session.test.js` – turn flow, scheduler, events, random full games in both rulesets, game over
- `bot.test.js` – NLU (negation/idioms/names), crisis handling per locale, memory whitelist, LLM context + fallback
- `ui.smoke.test.js` – jsdom: menu → setup → start → click-move → computer reply → language switch
- `structure.test.js` – import-map completeness; `core/`, `app/`, `chat/bot/` stay DOM-free

Not covered by automated tests: real pointer drag-and-drop and visual styling (please try them in a browser).
