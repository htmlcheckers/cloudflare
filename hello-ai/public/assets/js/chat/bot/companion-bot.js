import { createNlu } from "./nlu.js";
import { PlayerMemory } from "./player-memory.js";
import { MessageQueue } from "./message-queue.js";
import { LlmClient } from "./llm-client.js";
import { CrisisGuard } from "./safety.js";
import { getPack } from "./packs/index.js";

/**
 * CompanionBot – the chat persona selected for the current game.
 *
 * Public port (everything the app is allowed to call):
 *   start()                          greet the player
 *   receivePlayerMessage(text)
 *   onGameEvent(name, force?)        botCapture | playerCapture | *MultiCapture | *King
 *                                    | botWin | botLose | playerIdle
 *   updateBoardState(botScore, playerScore)
 *   startPlayerTurnTimer() / resetIdleTimer()
 *   setLanguage('fr' | 'en')
 *   destroy()
 *
 * Everything the bot needs to know about the game arrives through the injected
 * `getContext()` function (see app/chat-context.js). The bot never reads globals
 * or the DOM. Wording and language-specific rules live in packs/<lang>.js.
 */
export class CompanionBot {
  constructor(options = {}) {
    this.persona = options.persona || null;
    this.name = options.name || (this.persona && this.persona.firstName) || "Lucas";
    this.onTypingChange = options.onTypingChange || (() => {});
    this.onMessage = options.onMessage || (() => {});
    this.getContext = options.getContext || (() => ({}));
    this.pace = options.pace ?? 1.25;
    this.idleMs = options.idleMs || 60000;
    this.cooldownMs = options.cooldownMs || 9000;
    this.memory = options.memory || new PlayerMemory({ storage: options.storage });
    this.llm = options.llm && options.llm.endpoint ? new LlmClient({ ...options.llm, fetchImpl: options.fetchImpl }) : null;
    this.guard = new CrisisGuard();
    this.setLanguage(options.language || "fr");

    this.history = []; // [{ role: 'user' | 'assistant', content }] sent to the LLM as context
    this.llmSeq = 0; // invalidates an LLM answer if the player writes again while we wait
    this.llmPending = Promise.resolve();

    this.state = {
      botMood: "chill", // chill | confident | nervous | tilted
      playerMorale: 0, // -10 (very down) to +10 (happy)
      turnCount: 0,
      discussedTopics: new Set(),
      lastBotTopic: null,
      pendingQuestion: null, // { id, at }
      lastQuestionTime: 0,
      lastPlayerMessageTime: 0,
      idleNudges: 0
    };

    this.usedSignatures = new Set();
    this.idleTimer = null;
    this.followUpTimer = null;
    this.optionalReplyTimers = new Set();
    this.queue = new MessageQueue({
      pace: this.pace,
      minGapMs: options.minGapMs === undefined ? 2200 : options.minGapMs,
      onTypingChange: (typing) => this.onTypingChange(typing, this.name),
      deliver: (item) => this.#deliver(item)
    });
  }

  // --- language -----------------------------------------------------------

  setLanguage(language) {
    if (language !== "en" && language !== "fr") {
      throw new RangeError("Unsupported language: " + language);
    }
    this.language = language;
    this.pack = getPack(language);
    this.nlu = createNlu(this.pack);
  }

  // --- public port --------------------------------------------------------

  start() {
    this.triggerEvent("start", true);
  }

  onGameEvent(eventName, force = false) {
    this.triggerEvent(eventName, force);
  }

  updateBoardState(botScore, playerScore) {
    const s = this.state;
    s.turnCount++;
    const diff = botScore - playerScore;
    if (diff >= 5) s.playerMorale = Math.max(-10, s.playerMorale - 2);
    else if (diff <= -2) s.playerMorale = Math.min(10, s.playerMorale + 2);

    if (diff >= 4) s.botMood = "confident";
    else if (diff <= -5) s.botMood = "tilted";
    else if (diff <= -2) s.botMood = "nervous";
    else s.botMood = "chill";
  }

  startPlayerTurnTimer() {
    this.resetIdleTimer();
    this.idleTimer = setTimeout(() => {
      if (this.state.idleNudges < 2 && Math.random() < 0.6) {
        this.state.idleNudges++;
        this.triggerEvent("playerIdle", true);
      }
    }, this.idleMs);
  }

  resetIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /** Stop every pending timer (leaving the page / starting a new game). */
  destroy() {
    this.resetIdleTimer();
    clearTimeout(this.followUpTimer);
    this.#cancelOptionalReplies();
    this.llmSeq++;
    this.queue.clear();
  }

  /** Erase everything the bot remembered about the player. */
  forgetPlayer() {
    this.memory.forget();
  }

  get recentDistress() {
    return this.guard.isActive();
  }

  // --- tone & events ------------------------------------------------------

  _getEffectiveTone() {
    if (this.guard.isActive()) return "supportive";
    if (this.state.playerMorale <= -3 || this.memory.lossStreak >= 2) return "supportive";
    return this.state.botMood;
  }

  triggerEvent(eventName, force = false) {
    this.resetIdleTimer();
    const s = this.state;

    if (eventName === "start") {
      this.#cancelOptionalReplies();
      this.memory.recordGameStarted();
      s.turnCount = 0;
      s.botMood = "chill";
      s.idleNudges = 0;
      this.#send(this._buildStartGreeting(), 1);
      clearTimeout(this.followUpTimer);
      this.followUpTimer = setTimeout(() => {
        if (Date.now() - s.lastPlayerMessageTime > 8000) this._askNext();
      }, this.memory.gamesPlayed <= 1 ? 11000 : 7000);
      return;
    }

    if (eventName === "botWin") this.memory.recordResult(false);
    else if (eventName === "botLose") this.memory.recordResult(true);

    const now = Date.now();
    const isCritical = ["botWin", "botLose", "botMultiCapture", "playerMultiCapture"].includes(eventName);
    if (isCritical) this.#cancelOptionalReplies();

    if (!force && !isCritical) {
      if (now - this.queue.lastDeliveredAt < this.cooldownMs) return;
      if (this.queue.busy) return;
      // Cheer her good moves more often than we comment on ours
      const chance = { botCapture: 0.25, botKing: 0.4, playerCapture: 0.55, playerKing: 0.7 }[eventName] || 0.4;
      if (Math.random() > chance) return;
    }

    const line = this._generateEventLine(eventName);
    if (line) {
      if (isCritical) this.#send(line, 1.5);
      else this.#scheduleOptionalReply(line, 1);
    }
  }

  #scheduleOptionalReply(text, priority = 1, after = null) {
    if (
      this.optionalReplyTimers.size > 0 ||
      this.queue.busy ||
      Math.random() < 0.2
    ) return;
    const delay = (800 + Math.random() * 1800) * this.pace;
    const timer = setTimeout(() => {
      this.optionalReplyTimers.delete(timer);
      this.#send(text, priority, after);
    }, delay);
    this.optionalReplyTimers.add(timer);
  }

  #cancelOptionalReplies() {
    for (const timer of this.optionalReplyTimers) clearTimeout(timer);
    this.optionalReplyTimers.clear();
  }

  // --- conversation -------------------------------------------------------

  receivePlayerMessage(playerText) {
    if (!playerText || !playerText.trim()) return;
    const s = this.state;
    this.resetIdleTimer();
    clearTimeout(this.followUpTimer);
    this.#cancelOptionalReplies();
    s.lastPlayerMessageTime = Date.now();
    this.llmSeq++;
    this.#remember("user", playerText);
    const historySnapshot = this.history.slice();
    // Anything casual we were about to say is stale now: answer the player first
    this.queue.dropBelow(2);

    const nlu = this.nlu.analyze(playerText);
    if (nlu.scores.low_morale) s.playerMorale = Math.max(-10, s.playerMorale - 4);
    else if (nlu.scores.high_morale || nlu.scores.humor) s.playerMorale = Math.min(10, s.playerMorale + 2);

    const reply = this._buildReply(playerText, nlu);
    const localSafetyReply = nlu.scores.crisis || this.guard.isActive();
    if (this.llm && !localSafetyReply) this.#replyWithLLM(reply, playerText, historySnapshot);
    else {
      this.#appendHistoricLine("Player", playerText);
      this.#deliverReply(reply);
    }
  }

  #deliverReply(reply) {
    const texts = [].concat(reply.text);
    texts.forEach((text, i) => {
      const isLast = i === texts.length - 1;
      this.#send(text, reply.priority || 2, isLast && reply.ask ? () => this.#markAsked(reply.ask) : null, false, true);
    });
    if (reply.followUp) {
      this.followUpTimer = setTimeout(() => this._askNext(), 4500 * this.pace);
    }
  }

  // --- optional real-LLM layer (through your own proxy) -------------------

  #remember(role, content) {
    this.history.push({ role, content: String(content).slice(0, 600) });
    if (this.history.length > 24) this.history.splice(0, this.history.length - 24);
  }

  #historicKey() {
    const personaKey = encodeURIComponent((this.persona?.firstName || this.name).toLowerCase());
    return `checkers_bot_historic_${personaKey}`;
  }

  #getHistoric() {
    const historic = (this.memory.storage?.get(this.#historicKey(), "") || "").slice(0, 200);
    // Older versions could save automatic bot greetings without any player turn.
    if (/^Bot:\s*/i.test(historic) && !/(?:^|\|\s*)Player:\s*/i.test(historic)) {
      this.memory.storage?.remove(this.#historicKey());
      return "";
    }
    return historic;
  }

  #appendHistoricLine(role, content) {
    const cleanContent = String(content).replace(/\s+/g, " ").trim();
    const line = `${role}: ${cleanContent.slice(-(200 - role.length - 2))}`;
    const prior = this.#getHistoric();
    const separator = prior ? " | " : "";
    const room = Math.max(0, 200 - line.length - separator.length);
    const keptPrior = prior.slice(-room);
    const historic = `${keptPrior}${keptPrior ? separator : ""}${line}`.slice(-200);
    this.memory.storage?.set(this.#historicKey(), historic);
  }

  /** What leaves the browser. Whitelisted, plain JSON. */
  _llmContext() {
    const s = this.state;
    const m = this.memory;
    const external = this.getContext() || {};
    const hour = new Date().getHours();
    const distress = this.guard.isActive();
    const historic = this.#getHistoric().trim();
    return {
      // Flat fields: kept for compatibility with the existing proxy
      botName: this.name,
      playerName: m.name,
      topics: m.topics.slice(),
      gameMood: s.botMood,
      playerMorale: s.playerMorale <= -3 ? "low" : s.playerMorale >= 3 ? "good" : "neutral",
      turn: s.turnCount,
      gamesPlayed: m.gamesPlayed,
      language: this.language,
      recentLosses: m.lossStreak,
      recentDistress: distress,
      hour,
      // Structured game context (what is actually happening on the board)
      game: external.game || null,
      historic,
      firstMeeting: historic.length === 0,
      persona: this.persona
        ? {
            firstName: this.persona.firstName,
            gender: this.persona.gender,
            city: this.persona.city,
            country: this.persona.country,
            preferredLanguage: this.persona.preferredLanguage,
            trait: this.persona.trait
          }
        : null
    };
  }

  #replyWithLLM(reply, playerText, historySnapshot) {
    const seq = this.llmSeq;
    this.llmPending = this.llmPending.catch(() => {}).then(async () => {
      const context = this._llmContext();
      const result = await this.llm.ask({
        message: playerText,
        history: historySnapshot,
        context,
        reject: this.pack.llmReject
      });
      if (!result?.reply) {
        this.#appendHistoricLine("Player", playerText);
        if (seq === this.llmSeq) this.#deliverReply(reply);
        return;
      }

      const current = seq === this.llmSeq;
      if (current) {
        this.#send(result.reply, 3, /\?\s*$/.test(result.reply) ? () => this.#markAsked("open") : null, true, false);
      }

      const historic = await this.llm.summarize({
        history: historySnapshot,
        context,
        playerMessage: playerText,
        reply: current ? result.reply : ""
      });
      if (historic) this.memory.storage?.set(this.#historicKey(), historic.slice(0, 200));
      else {
        this.#appendHistoricLine("Player", playerText);
        if (current) this.#appendHistoricLine("Bot", result.reply);
      }
    });
  }

  #markAsked(id) {
    this.state.pendingQuestion = { id, at: Date.now() };
    this.state.lastQuestionTime = Date.now();
  }

  // --- reply engine -------------------------------------------------------

  _buildReply(raw, nlu) {
    const s = this.state;
    const m = this.memory;
    const P = this.pack.text;
    const now = Date.now();
    const tone = () => this._getEffectiveTone();
    const say = (text, extra) => Object.assign({ text }, extra || {});

    const pending = s.pendingQuestion && now - s.pendingQuestion.at < 180000 ? s.pendingQuestion.id : null;
    s.pendingQuestion = null;

    // 1. Safety first: serious distress (always local)
    if (nlu.scores.crisis) {
      this.guard.trigger(now);
      return { priority: 9, text: this.pack.safety.first.slice() };
    }
    if (this.guard.takeFollowUp(now)) {
      return say(this._pickUnique(this.pack.safety.followUps), { priority: 9 });
    }

    // 2. First name
    const name = this.nlu.extractName(raw, pending === "name");
    if (name) {
      m.setName(name);
      return say(this._compose("chill", P.nameWelcome), { followUp: true });
    }
    if (pending === "name") {
      m.markAskedName();
      return say(P.nameDeclined);
    }

    const t = nlu.topIntent;

    // 3. Answers to a question we asked
    const answerable = ["fallback", "how_are_you", "high_morale", "greeting", "humor", "thanks", "question"];
    if (pending === "how" && answerable.includes(t)) {
      const good = nlu.scores.high_morale || this.pack.goodRe.test(nlu.clean);
      return say(
        good ? this._compose("chill", P.howGood) : this._compose("supportive", P.howBad),
        { followUp: true }
      );
    }
    if (pending && pending !== "how" && (t === "fallback" || t === "thanks")) {
      return say(this._compose("chill", P.thanksSharing), { followUp: true, llm: true });
    }

    // 4. Intents
    if (t === "lonely") {
      s.playerMorale = Math.max(-10, s.playerMorale - 2);
      return say(this._pickUnique(P.lonely), { ask: "open", llm: true });
    }
    if (t === "health" && (nlu.scores.pets || nlu.scores.family)) {
      m.addTopic(nlu.scores.pets ? "pets" : "family");
      return say(P.healthSorry, { ask: "open", llm: true });
    }
    if (t === "health") {
      const sensitive = nlu.matchedWords.some((w) => this.pack.sensitiveHealth.includes(w));
      return say(
        this._pickUnique(sensitive ? P.healthSensitive : P.healthGeneral),
        sensitive ? undefined : { llm: true }
      );
    }
    if (nlu.scores.low_morale && (nlu.scores.weather_bad || nlu.scores.weather_generic)) {
      s.discussedTopics.add("weather");
      return say(this._compose("supportive", P.lowMoraleWeather));
    }
    if (t === "low_morale") {
      return say(this._compose("supportive", P.lowMorale), { ask: "open", llm: true });
    }
    if (t === "who_are_you") return say(this._compose("chill", P.whoAreYou));
    if (t === "bot_check") return say(this._pickUnique(P.botCheck));
    if (t === "goodbye") return say(this._pickUnique(P.goodbye));
    if (t === "greeting") {
      if (nlu.scores.how_are_you) return say(this._compose("chill", P.greetHow), { ask: "how" });
      return say(this._compose("chill", s.turnCount > 3 ? P.greetAgain : P.greetFirst));
    }
    if (t === "how_are_you") return say(this._compose("chill", P.howAreYou), { ask: "how" });
    if (t === "weather_bad") {
      s.discussedTopics.add("weather");
      const word = nlu.matchedWords.find((w) => this.pack.weatherBadWords.includes(w));
      const hook = this.pack.weatherHook(word);
      return say(this._compose(tone(), P.weatherBad).replace("{hook}", hook));
    }
    if (t === "weather_good") {
      s.discussedTopics.add("weather");
      return say(this._compose(tone(), P.weatherGood));
    }
    if (t === "weather_generic") return say(this._buildWeatherPrompt(), { ask: "weather" });
    if (this.pack.topics[t]) {
      m.addTopic(t);
      s.discussedTopics.add("topic:" + t);
      return say(this._compose(tone(), this.pack.topics[t].replies), { ask: "open", llm: true });
    }
    if (t === "compliment") return say(this._compose(tone(), P.compliment));
    if (t === "luck") return say(this._compose(tone(), P.luck));
    if (t === "thanks") return say(this._compose("chill", P.thanks));
    if (t === "rematch") return say(this._compose("chill", P.rematch));
    if (t === "humor") return say(this._compose("chill", P.humor));
    if (t === "high_morale") return say(this._compose("chill", P.highMorale), { followUp: true });
    if (t === "question") {
      return s.lastBotTopic === "weather"
        ? say(this._compose("chill", P.questionWeather))
        : say(this._compose(tone(), P.questionGeneral), { llm: true });
    }

    // 5. Fallback: listen, and keep the conversation gently alive
    const words = nlu.clean.split(/\s+/).filter(Boolean).length;
    const pool = words >= 12 ? P.fallbackLong : words <= 2 ? P.fallbackShort : P.fallbackMid;
    return say(this._compose("chill", pool), { followUp: Math.random() < 0.35, llm: true });
  }

  /** Ask one gentle question (at most one every ~90 s, never while waiting for an answer). */
  _askNext() {
    const s = this.state;
    const m = this.memory;
    if (s.pendingQuestion || Date.now() - s.lastQuestionTime < 90000) return;

    let q;
    if (!m.name && !m.askedName) {
      q = { id: "name", text: this.pack.text.askName };
    } else {
      const options = [];
      const fresh = m.topics.filter((tp) => this.pack.topics[tp] && !s.discussedTopics.has("topic:" + tp));
      if (fresh.length) {
        const tp = fresh[Math.floor(Math.random() * fresh.length)];
        s.discussedTopics.add("topic:" + tp);
        options.push({ id: "open", text: this.pack.topics[tp].followUp }, { id: "open", text: this.pack.topics[tp].followUp });
      }
      if (!s.discussedTopics.has("how")) options.push({ id: "how", text: this.pack.text.askHow });
      if (!s.discussedTopics.has("weather")) options.push({ id: "weather", text: null });
      options.push({ id: "open", text: this._pickUnique(this.pack.openQuestions) });
      q = options[Math.floor(Math.random() * options.length)];
      if (q.id === "how") s.discussedTopics.add("how");
      if (q.id === "weather") q.text = this._buildWeatherPrompt();
    }
    this.#scheduleOptionalReply(q.text, 0.5, () => this.#markAsked(q.id));
  }

  // --- sentence builders --------------------------------------------------

  _compose(tone, coreList) {
    const core = this._pickUnique(coreList);
    const openers = this.pack.openers[tone] || this.pack.openers.chill;
    const canOpen = this.pack.canOpen.test(core);
    const opener = canOpen && Math.random() < 0.35 ? openers[Math.floor(Math.random() * openers.length)] : "";
    return opener ? opener + core.charAt(0).toLowerCase() + core.slice(1) : core;
  }

  _buildStartGreeting() {
    const P = this.pack.text;
    const m = this.memory;
    if (!this.#getHistoric().trim()) return P.startFirst.slice();
    if (m.lossStreak >= 2) return P.startAfterLosses;
    return this._compose("chill", P.startAgain);
  }

  _buildWeatherPrompt() {
    this.state.lastBotTopic = "weather";
    this.state.discussedTopics.add("weather");
    return this._compose("chill", this.pack.text.weatherPrompt);
  }

  _generateEventLine(eventName) {
    const tone = this._getEffectiveTone();
    const group = this.pack.events[eventName];
    const pool = group && (group[tone] || group[tone === "tilted" ? "nervous" : "chill"] || group.chill);
    return pool ? this._compose(tone, pool) : null;
  }

  _pickUnique(list) {
    const unused = list.filter((item) => !this.usedSignatures.has(item));
    const source = unused.length > 0 ? unused : list;
    if (unused.length === 0) list.forEach((item) => this.usedSignatures.delete(item));
    const chosen = source[Math.floor(Math.random() * source.length)];
    this.usedSignatures.add(chosen);
    return chosen;
  }

  // Fills {nom} (", Marie" or nothing), {bot}, {hello}, {wish}, then capitalizes
  _finalize(text) {
    if (!text) return "";
    const name = this.memory.name;
    const hour = new Date().getHours();
    const out = text
      .replace(/,?\s*\{nom\}/g, name ? `, ${name}` : "")
      .replace(/\{bot\}/g, this.name)
      .replace(/\{hello\}/g, this.pack.greetingWord(hour))
      .replace(/\{wish\}/g, this.pack.dayWish(hour))
      .replace(/\s{2,}/g, " ")
      .trim();
    return out.charAt(0).toUpperCase() + out.slice(1);
  }

  #send(textOrList, priority = 1, after = null, immediate = false, persistHistoric = null) {
    const list = [].concat(textOrList).filter(Boolean);
    const items = [];
    list.forEach((raw, i) => {
      const text = this._finalize(raw);
      if (!text) return;
      items.push({
        text,
        priority,
        after: i === list.length - 1 ? after : null,
        immediate,
        persistHistoric: persistHistoric ?? Boolean(this.#getHistoric().trim())
      });
    });
    if (items.length > 0) this.queue.push(items);
  }

  #deliver(item) {
    this.onMessage({
      sender: this.name,
      text: item.text,
      tone: this._getEffectiveTone(),
      timestamp: Date.now()
    });
    if (item.persistHistoric !== false) this.#appendHistoricLine("Bot", item.text);
    this.#remember("assistant", item.text);
    if (item.after) item.after();
  }
}

export default CompanionBot;
