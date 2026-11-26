/**
 * Builds the single, whitelisted "what is going on right now?" object that is
 * handed to the chat. Plain JSON only: no DOM, no CSS class names, no globals.
 *
 * @typedef {Object} ChatContext
 * @property {Object} game     ruleset, difficulty, status, turn ("player"|"computer"),
 *                             moveNumber, score {player,computer} (captures this game),
 *                             material {player,computer}:{men,kings}, lastMoves[], position
 * @property {Object} player   { name, topics, gamesPlayed, lossStreak }
 * @property {Object} session  { language, hour, recentDistress }
 */
export function createChatContextBuilder({ session, memory, i18n, crisisActive = () => false, now = () => new Date() }) {
  return {
    build() {
      const snapshot = session.snapshot();
      return {
        game: {
          ruleset: snapshot.ruleset,
          difficulty: snapshot.difficulty,
          status: snapshot.status,
          turn: snapshot.turn,
          moveNumber: snapshot.moveNumber,
          playerColor: snapshot.humanColor,
          score: snapshot.captureScore,
          material: snapshot.material,
          lastMoves: snapshot.history.slice(-4),
          position: snapshot.notation
        },
        player: memory.publicProfile(),
        session: {
          language: i18n.language,
          hour: now().getHours(),
          recentDistress: Boolean(crisisActive())
        }
      };
    }
  };
}
