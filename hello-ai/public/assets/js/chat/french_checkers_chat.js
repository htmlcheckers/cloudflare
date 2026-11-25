/**
 * SmartFrenchCheckersBot (v4 - "Compagnon" edition)
 * Drop-in replacement: same constructor options, same public methods
 * (triggerEvent, updateBoardState, receivePlayerMessage, startPlayerTurnTimer, resetIdleTimer).
 *
 * Goals of this version:
 *  - Warm, plain, easy-to-read French (no slang, no emoticons).
 *  - Honest: the bot never pretends to be a human or to have a body, a bus, or a window.
 *  - Never rushes the player: slow pace, gentle idle nudges, nothing mocking.
 *  - Real conversation: remembers her first name and what she likes (stored locally only),
 *    asks one gentle question at a time, answers what she says, and responds with care to
 *    loneliness, pain, or serious distress.
 *
 * New optional constructor options:
 *   pace        (default 1.25)  multiplier on typing/reading delays; higher = calmer
 *   minGapMs    (default 2200)  minimum pause between two bot messages
 *   idleMs      (default 60000) wait before a gentle "take your time" nudge
 *   cooldownMs  (default 9000)  minimum pause between spontaneous game comments
 *   llm         (optional)      { endpoint, timeoutMs = 9000, maxHistory = 10 }
 *                               URL of the small proxy (see llm_proxy_worker.js) that talks to a real LLM.
 *                               Only open-ended chat uses it; crisis detection, name capture, honesty
 *                               answers ("are you a robot?") and game commentary stay local.
 *                               If the proxy is slow, down, or rate-limited, the bot silently falls back
 *                               to its built-in replies. NEVER put an API key in this file.
 */
class SmartFrenchCheckersBot {
    constructor(options = {}) {
        this.name = options.name || 'Lucas';
        this.language = options.language || 'fr';
        this.onTypingChange = options.onTypingChange || (() => { });
        this.onMessage = options.onMessage || (() => { });
        this.pace = options.pace || 1.25;
        this.minGapMs = options.minGapMs === undefined ? 2200 : options.minGapMs;
        this.idleMs = options.idleMs || 60000;
        this.cooldownMs = options.cooldownMs || 9000;

        const llm = options.llm;
        this.llm = llm && llm.endpoint
            ? { endpoint: llm.endpoint, timeoutMs: llm.timeoutMs || 9000, maxHistory: llm.maxHistory || 10 }
            : null;
        this.history = [];        // [{ role: 'user' | 'assistant', content }] - sent to the LLM as context
        this.llmSeq = 0;          // invalidates an LLM answer if she writes again while we wait

        this.state = {
            botMood: 'chill',         // 'chill' | 'confident' | 'nervous' | 'tilted'
            playerMorale: 0,          // -10 (very down) to +10 (happy)
            turnCount: 0,
            consecutivePlayerLosses: this._loadStat('losses', 0),
            gamesPlayed: this._loadStat('games', 0),
            playerName: this._loadText('name', null),
            knownTopics: this._loadList('topics'),   // things she told us she likes
            discussedTopics: new Set(),
            lastBotTopic: null,
            pendingQuestion: null,     // { id, at } - the question we are waiting an answer to
            lastQuestionTime: 0,
            lastPlayerMessageTime: 0,
            idleNudges: 0,
            crisisUntil: 0,
            crisisFollowUps: 0
        };

        this.lastMessageTime = 0;
        this.lastDeliveredAt = 0;
        this.usedSignatures = new Set();
        this.idleTimer = null;
        this.followUpTimer = null;
        this.isTyping = false;
        this.queue = [];
        this.optionalReplyTimers = new Set();

        // Intent lexicon (matched on whole words/phrases, accents removed, lowercase).
        // A trailing "s" is tolerated automatically; list feminine/other forms explicitly.
        this.lexicon = {
            crisis: { weight: 10, words: ['suicide', 'me suicider', 'me tuer', 'envie de mourir', 'veux mourir', 'veux plus vivre', 'plus envie de vivre', 'pas envie de vivre', 'mettre fin a mes jours', 'en finir avec la vie', 'envie d en finir', 'envie de disparaitre', 'me faire du mal'] },
            lonely: { weight: 5, words: ['seul', 'seule', 'solitude', 'isole', 'isolee', 'personne ne', 'plus personne', 'ennui', 'ennuie', 'm ennuie', 'rien a faire', 'journees sont longues', 'journee est longue'] },
            who_are_you: { weight: 4.5, words: ['comment tu t appelles', 'tu t appelles', 'ton nom', 'ton prenom', 'qui es tu', 'tu es qui', 'qui tu es'] },
            bot_check: { weight: 4, words: ['bot', 'robot', 'ordi', 'ordinateur', 'humain', 'humaine', 'algorithme', 'machine', 'ia', 'vraie personne', 'intelligence artificielle', 'une personne reelle'] },
            health: { weight: 3.5, words: ['douleur', 'mal au', 'mal aux', 'mal a', 'j ai mal', 'souffre', 'malade', 'maladie', 'medecin', 'hopital', 'kine', 'handicap', 'handicape', 'handicapee', 'fauteuil', 'canne'] },
            low_morale: { weight: 3, negatable: true, words: ['nul', 'nulle', 'mauvais', 'mauvaise', 'marre', 'fatigue', 'fatiguee', 'triste', 'deprime', 'deprimee', 'pas le moral', 'galere', 'impossible', 'creve', 'crevee', 'stresse', 'stressee', 'perdu', 'catastrophe', 'decourage', 'decouragee', 'angoisse', 'pleure', 'cafard', 'c est dur'] },
            greeting: { weight: 3, words: ['salut', 'bonjour', 'coucou', 'hello', 'slt', 'bjr', 'hey', 'bonsoir', 'allo'] },
            goodbye: { weight: 3.5, words: ['au revoir', 'a bientot', 'a demain', 'bonne nuit', 'bonne soiree', 'je dois y aller', 'je vais y aller', 'bye', 'ciao', 'a plus tard'] },
            how_are_you: { weight: 3, words: ['ca va', 'comment vas tu', 'comment tu vas', 'tu vas bien', 'et toi', 'comment allez vous'] },
            rematch: { weight: 3, words: ['revanche', 'rejouer', 'refaire', 'autre partie', 'encore une', 'on recommence'] },
            weather_bad: { weight: 2.5, words: ['pluie', 'pleut', 'froid', 'gris', 'nuage', 'neige', 'vent', 'orage', 'moche', 'pourri'] },
            weather_good: { weight: 2.5, words: ['soleil', 'ensoleille', 'chaud', 'il fait beau', 'beau temps', 'ciel bleu', 'canicule', 'printemps', 'ete'] },
            weather_generic: { weight: 2, words: ['meteo', 'quel temps', 'saison', 'dehors'] },
            compliment: { weight: 2.5, words: ['gg', 'bien joue', 'joli', 'beau coup', 'bravo', 'malin', 'bien vu', 'fort', 'forte', 'bonne partie', 'belle partie'] },
            luck: { weight: 2.5, words: ['chance', 'bol', 'veine', 'hasard', 'coup de bol'] },
            thanks: { weight: 2.5, words: ['merci', 'sympa', 'gentil', 'gentille'] },
            high_morale: { weight: 2, words: ['super', 'genial', 'top', 'content', 'contente', 'tranquille', 'parfait', 'cool', 'en forme', 'heureux', 'heureuse', 'je vais bien', 'ca va bien', 'tres bien'] },
            humor: { weight: 1.5, words: ['mdr', 'lol', 'ptdr', 'haha', 'hihi', 'xd', 'mort de rire', 'rigole', 'drole'] },
            question: { weight: 2, words: ['pourquoi', 'comment', 'quoi', 'quel', 'quelle', 'tu fais', 'tu joues'] },
            // Everyday topics she may bring up (the bot remembers them for next time)
            family: { weight: 2.5, words: ['fils', 'fille', 'enfants', 'petits enfants', 'petit fils', 'petite fille', 'mari', 'soeur', 'frere', 'neveu', 'niece', 'famille', 'maman', 'papa', 'cousin', 'cousine', 'amie', 'ami', 'amis', 'voisine', 'voisin'] },
            pets: { weight: 2.5, words: ['chat', 'chien', 'chaton', 'chiot', 'oiseau', 'perruche', 'animal', 'animaux'] },
            garden: { weight: 2.5, words: ['jardin', 'fleur', 'plante', 'potager', 'tomate', 'balcon'] },
            music: { weight: 2.5, words: ['musique', 'chanson', 'chanter', 'chante', 'radio', 'piano', 'ecouter'] },
            cooking: { weight: 2.5, words: ['cuisine', 'cuisiner', 'gateau', 'recette', 'repas', 'soupe', 'tarte', 'diner', 'dejeuner'] },
            reading: { weight: 2.5, words: ['lire', 'lecture', 'livre', 'roman', 'mots croises', 'mots fleches', 'sudoku'] },
            tv: { weight: 2.5, words: ['tele', 'television', 'film', 'serie', 'emission', 'feuilleton'] },
            crafts: { weight: 2.5, words: ['tricot', 'tricoter', 'couture', 'broderie', 'peinture', 'dessin'] }
        };
        this._matchers = {};
        for (const [intent, data] of Object.entries(this.lexicon)) {
            this._matchers[intent] = data.words.map(word => ({
                word,
                re: new RegExp('(?:^|[^a-z0-9])' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?(?![a-z0-9])')
            }));
        }

        // Light variety for statements (only applied to sentences that read well after it)
        this.blocks = {
            openers: {
                chill: ['', 'Eh bien, ', 'Tiens, ', 'Alors, '],
                confident: ['Ah, ', 'Voilà, ', 'Eh bien, '],
                supportive: ['Tu sais, ', 'Franchement, ', 'Courage, '],
                nervous: ['Oh là là, ', 'Aïe, ', 'Hmm, '],
                tilted: ['Oh, ', 'Aïe, ']
            }
        };

        // Everyday topics: answers, and a follow-up question for the next visit
        this.topics = {
            family: {
                replies: ["Les proches, c'est précieux. Tu les vois souvent ?", "Ça fait du bien de penser à eux. Raconte-moi un peu, si tu veux.", "Merci de me parler d'eux, ça me fait plaisir."],
                followUp: "Comment vont tes proches ?"
            },
            pets: {
                replies: ["Un animal, c'est une belle compagnie. Comment s'appelle-t-il ?", "Quelle bonne compagnie ! Il est plutôt câlin ou joueur ?", "J'aime bien quand on parle d'animaux. Raconte-moi."],
                followUp: "Et ton animal, comment va-t-il ?"
            },
            garden: {
                replies: ["Un jardin, c'est un beau passe-temps. Qu'est-ce que tu aimes y faire ?", "Les fleurs, c'est reposant. Tu as une préférée ?", "Prendre soin des plantes demande de la patience, comme aux dames."],
                followUp: "Et ton jardin, il y a du nouveau ?"
            },
            music: {
                replies: ["La musique, ça fait du bien au moral. Quel genre tu préfères ?", "Tu as une chanson que tu aimes particulièrement ?"],
                followUp: "Tu as écouté de la belle musique dernièrement ?"
            },
            cooking: {
                replies: ["Ça donne faim ! Quel est ton meilleur plat ?", "Un bon petit plat maison, il n'y a rien de mieux. Tu cuisines souvent ?"],
                followUp: "Tu as préparé quelque chose de bon cette semaine ?"
            },
            reading: {
                replies: ["Lire ou faire des jeux de mots, c'est une belle façon de passer le temps. Qu'est-ce que tu préfères ?", "Ça travaille bien la tête, comme les dames !"],
                followUp: "Tu as trouvé une bonne lecture ou un bon jeu dernièrement ?"
            },
            tv: {
                replies: ["Un bon film ou une bonne émission, ça fait passer le temps. Tu en as une préférée ?", "Tu as vu quelque chose de bien dernièrement ?"],
                followUp: "Tu as vu quelque chose de bien à la télé ?"
            },
            crafts: {
                replies: ["Faire des choses de ses mains, c'est très agréable. Qu'est-ce que tu fabriques en ce moment ?", "Ça demande de la patience et du talent, bravo."],
                followUp: "Ton ouvrage avance bien ?"
            }
        };

        this.openQuestions = [
            "Quelle a été la meilleure chose de ta journée jusqu'ici ?",
            "Tu préfères le matin ou le soir ?",
            "Est-ce que tu as un petit passe-temps en dehors des dames ?",
            "Tu jouais déjà aux dames quand tu étais plus jeune ?",
            "Quel est ton plat préféré ?"
        ];
    }

    // --- TEXT NORMALIZATION & NLU ENGINE ---

    _normalize(text) {
        return text
            .toLowerCase()
            .replace(/œ/g, 'oe')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/['’]/g, ' ')
            .trim();
    }

    _analyzeInput(rawText) {
        const clean = this._normalize(rawText);
        const scan = clean.replace(/mourir de rire/g, 'rire'); // idiom, not distress
        const scores = {};
        const matchedWords = [];

        for (const [intent, data] of Object.entries(this.lexicon)) {
            let score = 0;
            for (const m of this._matchers[intent]) {
                const hit = m.re.exec(scan);
                if (!hit) continue;
                // "je ne suis pas triste" must not count as sadness
                if (data.negatable && /\b(?:pas|jamais|aucun|aucune)(?:\s+[a-z]+){0,2}\s*$/.test(clean.slice(0, hit.index))) continue;
                score += data.weight;
                matchedWords.push(m.word);
            }
            if (score > 0) scores[intent] = score;
        }
        if (rawText.includes('?')) scores.question = (scores.question || 0) + 1.5;

        const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        return {
            clean,
            scores,
            topIntent: ranked[0] ? ranked[0][0] : 'fallback',
            secondIntent: ranked[1] ? ranked[1][0] : null,
            matchedWords
        };
    }

    _extractName(raw, expecting) {
        const stop = new Set(['oui', 'non', 'bonjour', 'bonsoir', 'salut', 'coucou', 'hello', 'moi', 'je', 'ben', 'alors', 'pas', 'rien', 'merci', 'ok', 'bof', 'euh', 'tu', 'le', 'la', 'un', 'une', 'c', 'est', 'cest', 'appelle', 'mon', 'prenom', 'nom', 'et', 'toi', 'voila', 'secret', 'pourquoi', 'aucun']);
        const strip = w => this._normalize(w).replace(/[^a-z]/g, '');
        let candidate = null;
        const m = raw.match(/(?:je\s+m\s*['’]?\s*appelle|moi\s+c\s*['’]?\s*est|mon\s+pr[ée]nom\s+(?:est|c\s*['’]?\s*est)|appelle[zr]?[-\s]moi|on\s+m\s*['’]?\s*appelle)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]{1,19})/i);
        if (m) {
            candidate = m[1];
        } else if (expecting && !raw.includes('?')) {
            const words = raw.replace(/[.,!;:]/g, ' ').split(/\s+/).filter(Boolean);
            if (words.length > 0 && words.length <= 3) {
                candidate = words.filter(w => !stop.has(strip(w))).pop() || null;
            }
        }
        if (!candidate || !/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]{1,19}$/.test(candidate) || stop.has(strip(candidate))) return null;
        return candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
    }

    // --- BOARD & PSYCHOLOGICAL STATE TRACKING ---

    updateBoardState(botScore, playerScore) {
        this.state.turnCount++;
        const diff = botScore - playerScore;

        if (diff >= 5) {
            this.state.playerMorale = Math.max(-10, this.state.playerMorale - 2);
        } else if (diff <= -2) {
            this.state.playerMorale = Math.min(10, this.state.playerMorale + 2);
        }

        if (diff >= 4) this.state.botMood = 'confident';
        else if (diff <= -5) this.state.botMood = 'tilted';
        else if (diff <= -2) this.state.botMood = 'nervous';
        else this.state.botMood = 'chill';
    }

    _getEffectiveTone() {
        if (Date.now() < this.state.crisisUntil) return 'supportive';
        if (this.state.playerMorale <= -3 || this.state.consecutivePlayerLosses >= 2) {
            return 'supportive';
        }
        return this.state.botMood;
    }

    // --- GAME EVENT TRIGGERS ---

    triggerEvent(eventName, force = false) {
        this.resetIdleTimer();
        const s = this.state;

        if (eventName === 'start') {
            this._cancelOptionalReplies();
            s.gamesPlayed++;
            this._saveStat('games', s.gamesPlayed);
            s.turnCount = 0;
            s.botMood = 'chill';
            s.idleNudges = 0;

            this._sendHumanLike(this._buildStartGreeting(), 1);

            clearTimeout(this.followUpTimer);
            this.followUpTimer = setTimeout(() => {
                if (Date.now() - s.lastPlayerMessageTime > 8000) this._askNext();
            }, s.gamesPlayed <= 1 ? 11000 : 7000);
            return;
        }

        if (eventName === 'botWin') {
            s.consecutivePlayerLosses++;
            this._saveStat('losses', s.consecutivePlayerLosses);
        } else if (eventName === 'botLose') {
            s.consecutivePlayerLosses = 0;
            this._saveStat('losses', 0);
        }

        const now = Date.now();
        const isCritical = ['botWin', 'botLose', 'botMultiCapture', 'playerMultiCapture'].includes(eventName);
        if (isCritical) this._cancelOptionalReplies();

        if (!force && !isCritical) {
            if (now - this.lastMessageTime < this.cooldownMs) return;
            if (this.isTyping || this.queue.length > 0) return;
            // Cheer her good moves more often than we comment on ours
            const chance = { botCapture: 0.25, botKing: 0.4, playerCapture: 0.55, playerKing: 0.7 }[eventName] || 0.4;
            if (Math.random() > chance) return;
        }

        const reply = this._generateEventLine(eventName);
        if (reply) {
            if (isCritical) this._sendHumanLike(reply, 1.5);
            else this._scheduleOptionalReply(reply, 1);
        }
    }

    startPlayerTurnTimer() {
        this.resetIdleTimer();
        this.idleTimer = setTimeout(() => {
            if (this.state.idleNudges < 2 && Math.random() < 0.6) {
                this.state.idleNudges++;
                this.triggerEvent('playerIdle', true);
            }
        }, this.idleMs);
    }

    resetIdleTimer() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }

    _scheduleOptionalReply(text, priority = 1, after = null) {
        if (
            this.optionalReplyTimers.size > 0 ||
            this.isTyping ||
            this.queue.length > 0 ||
            Math.random() < 0.2
        ) return;
        const delay = (800 + Math.random() * 1800) * this.pace;
        const timer = setTimeout(() => {
            this.optionalReplyTimers.delete(timer);
            this._sendHumanLike(text, priority, after);
        }, delay);
        this.optionalReplyTimers.add(timer);
    }

    _cancelOptionalReplies() {
        for (const timer of this.optionalReplyTimers) clearTimeout(timer);
        this.optionalReplyTimers.clear();
    }

    /** Stop every pending timer (call when leaving the page / closing the game). */
    destroy() {
        this.resetIdleTimer();
        clearTimeout(this.followUpTimer);
        this._cancelOptionalReplies();
        this.llmSeq++;
        this.queue = [];
    }

    /** Erase everything the bot remembered about the player (name, topics, stats). */
    forgetPlayer() {
        ['name', 'topics', 'losses', 'games', 'askedname'].forEach(k => {
            try { localStorage.removeItem(`checkers_bot_${k}`); } catch { /* ignore */ }
        });
        this.state.playerName = null;
        this.state.knownTopics = [];
    }

    // --- CONVERSATION ---

    receivePlayerMessage(playerText) {
        if (!playerText || !playerText.trim()) return;
        const s = this.state;
        this.resetIdleTimer();
        clearTimeout(this.followUpTimer);
        this._cancelOptionalReplies();
        s.lastPlayerMessageTime = Date.now();
        this.llmSeq++;
        this._remember('user', playerText);
        // Anything casual we were about to say is stale now: answer her first
        this.queue = this.queue.filter(m => m.priority >= 2);

        const nlu = this._analyzeInput(playerText);

        if (nlu.scores.low_morale) {
            s.playerMorale = Math.max(-10, s.playerMorale - 4);
        } else if (nlu.scores.high_morale || nlu.scores.humor) {
            s.playerMorale = Math.min(10, s.playerMorale + 2);
        }

        const reply = this._buildReply(playerText, nlu);
        if (reply.llm && this.llm) {
            this._replyWithLLM(reply);
        } else {
            this._deliverReply(reply);
        }
    }

    _deliverReply(reply) {
        const texts = [].concat(reply.text);
        texts.forEach((t, i) => {
            const isLast = i === texts.length - 1;
            this._sendHumanLike(t, reply.priority || 2, isLast && reply.ask ? () => this._markAsked(reply.ask) : null);
        });
        if (reply.followUp) {
            this.followUpTimer = setTimeout(() => this._askNext(), 4500 * this.pace);
        }
    }

    // --- OPTIONAL REAL-LLM LAYER (through your own proxy) ---

    _remember(role, content) {
        this.history.push({ role, content: String(content).slice(0, 600) });
        if (this.history.length > 24) this.history.splice(0, this.history.length - 24);
    }

    _llmContext() {
        const s = this.state;
        return {
            botName: this.name,
            playerName: s.playerName || null,
            topics: s.knownTopics.slice(),
            gameMood: s.botMood,
            playerMorale: s.playerMorale <= -3 ? 'low' : s.playerMorale >= 3 ? 'good' : 'neutral',
            turn: s.turnCount,
            gamesPlayed: s.gamesPlayed,
            language: this.language || 'fr',
            recentLosses: s.consecutivePlayerLosses,
            recentDistress: Date.now() < s.crisisUntil,
            hour: new Date().getHours()
        };
    }

    setLanguage(language) {
        if (language !== 'en' && language !== 'fr') {
            throw new RangeError('Unsupported language: ' + language);
        }
        this.language = language;
    }

    async _askLLM() {
        if (!this.llm || typeof fetch !== 'function') return null;
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, this.llm.timeoutMs);
        try {
            const res = await fetch(this.llm.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: this.history.slice(-this.llm.maxHistory), context: this._llmContext() }),
                signal: ctrl ? ctrl.signal : undefined
            });
            if (!res.ok) throw new Error('http ' + res.status);
            const data = await res.json();
            const text = typeof data.reply === 'string' ? data.reply.trim().slice(0, 400) : '';
            // Safety net: never let the model claim to be a person
            if (!text || /je suis (?:un |une )?(?:vrai |vraie )?(?:humain|personne|homme|femme)\b/i.test(text)) throw new Error('rejected');
            return text;
        } catch {
            return null;
        } finally {
            clearTimeout(timer);
        }
    }

    _replyWithLLM(reply) {
        const seq = this.llmSeq;
        this._askLLM().then(text => {
            if (seq !== this.llmSeq) return;      // she wrote again: that newer message gets its own answer
            if (text) {
                this._sendHumanLike(
                    text,
                    3,
                    /\?\s*$/.test(text) ? () => this._markAsked('open') : null,
                    true
                );
            } else {
                this._deliverReply(reply);        // fallback to the built-in reply
            }
        });
    }

    _markAsked(id) {
        this.state.pendingQuestion = { id, at: Date.now() };
        this.state.lastQuestionTime = Date.now();
    }

    _buildReply(raw, nlu) {
        const s = this.state;
        const now = Date.now();
        const tone = () => this._getEffectiveTone();
        const say = (text, extra) => Object.assign({ text }, extra || {});

        const pending = s.pendingQuestion && now - s.pendingQuestion.at < 180000 ? s.pendingQuestion.id : null;
        s.pendingQuestion = null;

        // 1. Safety first: serious distress
        if (nlu.scores.crisis) {
            s.crisisUntil = now + 15 * 60 * 1000;
            s.crisisFollowUps = 0;
            return {
                priority: 9,
                text: [
                    "Ce que tu me dis est important, et je ne veux pas passer à côté. Je suis seulement un programme : je ne peux pas t'aider comme une vraie personne.",
                    "Si tu penses à te faire du mal, appelle le 3114, le numéro national de prévention du suicide en France. Il est gratuit et joignable à toute heure. En cas de danger immédiat, appelle le 15 ou le 112. Et si tu peux, dis à un proche comment tu te sens, dès maintenant."
                ]
            };
        }
        if (now < s.crisisUntil && s.crisisFollowUps < 2) {
            s.crisisFollowUps++;
            return say(this._pickUnique([
                "Je suis là. Le 3114 est joignable à toute heure, et un proche peut aussi t'aider si tu peux le contacter maintenant.",
                "Merci de rester là. Tu mérites un vrai soutien : le 3114 est là à toute heure, et n'hésite pas à appeler quelqu'un de proche."
            ]), { priority: 9 });
        }

        // 2. Her first name
        const name = this._extractName(raw, pending === 'name');
        if (name) {
            s.playerName = name;
            this._saveText('name', name);
            this._saveStat('askedname', 1);
            return say(this._compose('chill', ["Enchanté {nom} ! Je suis content de jouer avec toi.", "Quel joli prénom ! Enchanté {nom}."]), { followUp: true });
        }
        if (pending === 'name') {
            this._saveStat('askedname', 1);
            return say("Pas de souci, on peut jouer sans les présentations. Prends ton temps.");
        }

        const t = nlu.topIntent;

        // 3. Answers to a question we asked
        const answerable = ['fallback', 'how_are_you', 'high_morale', 'greeting', 'humor', 'thanks', 'question'];
        if (pending === 'how' && answerable.includes(t)) {
            const good = nlu.scores.high_morale || /\bbien\b/.test(nlu.clean);
            return say(good
                ? this._compose('chill', ["Tant mieux, ça me fait plaisir de l'entendre !", "Je suis content que ça aille bien. Profitons de cette partie."])
                : this._compose('supportive', ["Merci de me l'avoir dit. Si tu as envie d'en parler, je t'écoute.", "D'accord. On joue tranquillement, sans aucune pression."]), { followUp: true });
        }
        if (pending && pending !== 'how' && (t === 'fallback' || t === 'thanks')) {
            return say(this._compose('chill', [
                "Merci de me raconter ça, c'est agréable de discuter avec toi.",
                "J'aime bien apprendre à te connaître.",
                "C'est intéressant, merci de partager ça avec moi."
            ]), { followUp: true, llm: true });
        }

        // 4. Intents
        if (t === 'lonely') {
            s.playerMorale = Math.max(-10, s.playerMorale - 2);
            return say(this._pickUnique([
                "C'est dur de se sentir seul, et je te remercie de me le dire. Je suis là pour discuter et jouer autant que tu veux.",
                "Les journées peuvent être longues, parfois. Je suis content que tu sois là. Si tu as envie de me raconter ta journée, je t'écoute.",
                "Merci de me faire confiance avec ça. Si tu as un proche à appeler, un petit coup de fil peut aussi faire du bien. En attendant, je suis là."
            ]), { ask: 'open', llm: true });
        }
        if (t === 'health' && (nlu.scores.pets || nlu.scores.family)) {
            const tp = nlu.scores.pets ? 'pets' : 'family';
            if (!s.knownTopics.includes(tp)) {
                s.knownTopics = s.knownTopics.concat(tp).slice(-8);
                this._saveList('topics', s.knownTopics);
            }
            return say("Je suis désolé d'apprendre ça, j'espère que ça va vite s'arranger. Si tu as envie d'en parler, je t'écoute.", { ask: 'open', llm: true });
        }
        if (t === 'health') {
            const sensitive = nlu.matchedWords.some(w => ['handicap', 'handicape', 'handicapee', 'fauteuil', 'canne'].includes(w));
            return say(sensitive
                ? this._pickUnique(["Merci de me l'expliquer. Ici, tu joues à ton rythme, il n'y a aucune urgence.", "D'accord. Ici, on prend tout le temps qu'il faut, c'est fait pour ça."])
                : this._pickUnique([
                    "Je suis désolé que ça te fasse souffrir. On joue doucement, à ton rythme, et on s'arrête quand tu veux.",
                    "Merci de me le dire. Aucune urgence ici. Si la douleur est forte ou t'inquiète, parles-en à ton médecin ou à un proche."
                ]), sensitive ? undefined : { llm: true });
        }
        if (nlu.scores.low_morale && (nlu.scores.weather_bad || nlu.scores.weather_generic)) {
            s.discussedTopics.add('weather');
            return say(this._compose('supportive', [
                "Avec ce temps en plus, ça ne remonte pas le moral. Installe-toi bien, on joue sans pression.",
                "Une journée difficile et un temps gris, c'est le mauvais combo. Prends cette partie pour te vider la tête."
            ]));
        }
        if (t === 'low_morale') {
            return say(this._compose('supportive', [
                "On a tous des jours sans, ce n'est pas grave. Ici, on joue juste pour se détendre.",
                "Je suis désolé que ce ne soit pas une bonne journée. On peut jouer doucement, ou simplement discuter.",
                "Respire un grand coup. Aux dames, un seul coup peut tout retourner. Si tu as envie d'en parler, je t'écoute."
            ]), { ask: 'open', llm: true });
        }
        if (t === 'who_are_you') {
            return say(this._compose('chill', [
                "Je m'appelle {bot}. Je suis un petit programme créé pour jouer aux dames avec toi, et je suis vraiment content de ta compagnie."
            ]));
        }
        if (t === 'bot_check') {
            return say(this._pickUnique([
                "Tu as deviné : je suis un programme, pas une vraie personne. Mais ça ne m'empêche pas d'aimer nos parties et de te tenir compagnie.",
                "Oui, je suis un programme informatique créé pour jouer aux dames. En revanche, je ne me lasse jamais de discuter !",
                "Bonne question. Je suis un programme, pas un humain, mais je fais de mon mieux pour être une bonne compagnie."
            ]));
        }
        if (t === 'goodbye') {
            return say(this._pickUnique([
                `Au revoir{nom}, merci pour ce moment. ${this._dayWish()} et à très bientôt pour une autre partie !`,
                "Prends soin de toi{nom}. Je serai là quand tu voudras rejouer.",
                `Merci pour cette partie{nom}. ${this._dayWish()} !`
            ]));
        }
        if (t === 'greeting') {
            if (nlu.scores.how_are_you) {
                return say(this._compose('chill', ["{hello}{nom} ! Ça va bien, merci de demander. Et toi, comment tu te sens aujourd'hui ?"]), { ask: 'how' });
            }
            return say(s.turnCount > 3
                ? this._compose('chill', ["Re-bonjour{nom} ! Toujours concentré sur le plateau ?", "Coucou{nom} ! Je réfléchissais à mon prochain coup."])
                : this._compose('chill', ["{hello}{nom} ! Content de te voir. À toi de jouer, prends ton temps.", "{hello}{nom} ! Bonne partie à nous deux."]));
        }
        if (t === 'how_are_you') {
            return say(this._compose('chill', [
                "Ça va bien, merci de demander ! Surtout quand on joue ensemble. Et toi, comment tu te sens ?",
                "Très bien, merci ! Et toi, comment se passe ta journée ?"
            ]), { ask: 'how' });
        }
        if (t === 'weather_bad') {
            s.discussedTopics.add('weather');
            const word = nlu.matchedWords.find(w => ['pluie', 'pleut', 'froid', 'neige', 'vent'].includes(w));
            const hook = word === 'neige' ? "De la neige ! Ça doit être joli à regarder." : word === 'froid' ? "Ça se rafraîchit, alors." : "Un temps à rester à l'intérieur.";
            return say(this._compose(tone(), [
                `${hook} Installe-toi bien au chaud, on est bien devant une partie de dames.`,
                `${hook} Parfait pour une partie tranquille sous un plaid.`
            ]));
        }
        if (t === 'weather_good') {
            s.discussedTopics.add('weather');
            return say(this._compose(tone(), [
                "Quel plaisir, le soleil ! Ça met de bonne humeur.",
                "Ça fait du bien d'avoir un peu de lumière. Ça donne la pêche pour jouer !"
            ]));
        }
        if (t === 'weather_generic') {
            return say(this._buildWeatherPrompt(), { ask: 'weather' });
        }
        if (this.topics[t]) {
            if (!s.knownTopics.includes(t)) {
                s.knownTopics = s.knownTopics.concat(t).slice(-8);
                this._saveList('topics', s.knownTopics);
            }
            s.discussedTopics.add('topic:' + t);
            return say(this._compose(tone(), this.topics[t].replies), { ask: 'open', llm: true });
        }
        if (t === 'compliment') {
            return say(this._compose(tone(), ["Merci, c'est gentil ! Toi aussi, tu joues très bien.", "Merci ! Un peu de chance aussi, je l'avoue."]));
        }
        if (t === 'luck') {
            return say(this._compose(tone(), [
                "Un peu de chance, peut-être, mais pas seulement : la réflexion compte beaucoup, et la tienne est bonne.",
                "C'est vrai qu'un peu de chance aide parfois. Mais tu joues bien, ne l'oublie pas."
            ]));
        }
        if (t === 'thanks') {
            return say(this._compose('chill', ["Avec plaisir !", "C'est moi qui te remercie pour la partie.", "Ça me fait plaisir, vraiment."]));
        }
        if (t === 'rematch') {
            return say(this._compose('chill', ["Avec plaisir ! Lance une nouvelle partie quand tu veux.", "Bien sûr, je suis partant pour une autre partie, sans te presser."]));
        }
        if (t === 'humor') {
            return say(this._compose('chill', ["Ça me fait plaisir de te faire sourire !", "Haha, ça fait du bien de rire un peu."]));
        }
        if (t === 'high_morale') {
            return say(this._compose('chill', ["Tant mieux, ça me fait plaisir de l'entendre !", "Super, la bonne humeur, c'est le meilleur des jeux."]), { followUp: true });
        }
        if (t === 'question') {
            return say(s.lastBotTopic === 'weather'
                ? this._compose('chill', ["Moi, je ne vois pas le ciel d'ici ! Et chez toi, quel temps fait-il ?"])
                : this._compose(tone(), ["Bonne question ! Je joue un peu au feeling, c'est difficile à expliquer.", "Je ne sais pas toujours l'expliquer, mais j'essaie de bien protéger mes pions."]), s.lastBotTopic === 'weather' ? undefined : { llm: true });
        }

        // 5. Fallback: listen, and keep the conversation gently alive
        const words = nlu.clean.split(/\s+/).filter(Boolean).length;
        const pool = words >= 12
            ? ["Merci de me raconter tout ça, j'aime bien t'écouter.", "Je comprends. Merci d'avoir pris le temps de m'écrire ça.", "C'est agréable de discuter avec toi. Continue si tu veux, je t'écoute."]
            : words <= 2
                ? ["D'accord. Prends ton temps pour jouer.", "Très bien. Je suis là si tu as envie de discuter.", "Entendu."]
                : ["Je vois. Raconte-moi, ça m'intéresse.", "Ah oui ? Dis-m'en un peu plus, si tu veux.", "Je comprends. Merci de me le dire."];
        return say(this._compose('chill', pool), { followUp: Math.random() < 0.35, llm: true });
    }

    // Ask one gentle question (never more than one every ~90 seconds, never while waiting for an answer)
    _askNext() {
        const s = this.state;
        if (s.pendingQuestion || Date.now() - s.lastQuestionTime < 90000) return;

        let q;
        if (!s.playerName && !this._loadStat('askedname', 0)) {
            q = { id: 'name', text: "Au fait, comment dois-je t'appeler ?" };
        } else {
            const options = [];
            const fresh = s.knownTopics.filter(tp => !s.discussedTopics.has('topic:' + tp));
            if (fresh.length) {
                const tp = fresh[Math.floor(Math.random() * fresh.length)];
                s.discussedTopics.add('topic:' + tp);
                options.push({ id: 'open', text: this.topics[tp].followUp }, { id: 'open', text: this.topics[tp].followUp });
            }
            if (!s.discussedTopics.has('how')) options.push({ id: 'how', text: "Comment tu te sens aujourd'hui ?" });
            if (!s.discussedTopics.has('weather')) options.push({ id: 'weather', text: null });
            options.push({ id: 'open', text: this._pickUnique(this.openQuestions) });
            q = options[Math.floor(Math.random() * options.length)];
            if (q.id === 'how') s.discussedTopics.add('how');
            if (q.id === 'weather') q.text = this._buildWeatherPrompt();
        }
        this._scheduleOptionalReply(q.text, 0.5, () => this._markAsked(q.id));
    }

    // --- COMPOSITIONAL SENTENCE BUILDERS ---

    _compose(tone, coreList) {
        const core = this._pickUnique(coreList);
        const openers = this.blocks.openers[tone] || this.blocks.openers.chill;
        const canOpen = /^(?:Je|On|Il|Ça|C'est|Les|La|Le|Un|Une|Tu|Ton|Ta|Chez|Prends)(?=[\s'’])/.test(core);
        const opener = canOpen && Math.random() < 0.35 ? openers[Math.floor(Math.random() * openers.length)] : '';
        return opener ? opener + core.charAt(0).toLowerCase() + core.slice(1) : core;
    }

    _greetingWord() {
        const h = new Date().getHours();
        return h >= 18 || h < 5 ? 'Bonsoir' : 'Bonjour';
    }

    _dayWish() {
        const h = new Date().getHours();
        return h >= 18 || h < 5 ? 'Bonne soirée' : 'Bonne journée';
    }

    _buildStartGreeting() {
        const s = this.state;
        const hello = this._greetingWord();
        if (s.gamesPlayed <= 1) {
            return [
                `${hello} ! Je m'appelle {bot}, je suis le compagnon de jeu de dames de cette application. Je suis content de jouer avec toi.`,
                "Je suis un programme, mais j'aime beaucoup discuter en jouant. Prends ton temps, il n'y a aucune urgence."
            ];
        }
        if (s.consecutivePlayerLosses >= 2) {
            return `${hello}{nom} ! On se refait une partie ? Aujourd'hui, tout est possible.`;
        }
        return this._compose('chill', [
            `${hello}{nom} ! Content de te retrouver.`,
            `${hello}{nom} ! Ça me fait plaisir de rejouer avec toi.`,
            `${hello}{nom} ! Une petite partie tranquille ?`
        ]);
    }

    _buildWeatherPrompt() {
        this.state.lastBotTopic = 'weather';
        this.state.discussedTopics.add('weather');
        return this._compose('chill', [
            "Moi, je ne vois pas le ciel d'ici ! Quel temps fait-il chez toi aujourd'hui ?",
            "Dis-moi, quel temps fait-il chez toi ? Raconte-moi un peu ce que tu vois.",
            "Il fait beau chez toi aujourd'hui ?"
        ]);
    }

    _generateEventLine(eventName) {
        const tone = this._getEffectiveTone();
        const bank = {
            botCapture: {
                chill: ["Je prends ce pion.", "Celui-là est pour moi, mais la partie est encore longue."],
                confident: ["Un pion pour moi, mais il y a encore de belles occasions pour toi.", "Je prends celui-là. À toi de me répondre !"],
                supportive: ["J'ai pris un pion, mais rien n'est joué. Tu peux très bien revenir.", "Un seul coup peut tout changer aux dames. Garde confiance."],
                nervous: ["Ouf, j'avais besoin de celui-là.", "Merci, ça me remet dans la partie."]
            },
            botMultiCapture: {
                chill: ["Oh, une belle rafle ! J'ai eu de la chance sur ce coup.", "Une rafle pour moi, mais la partie continue."],
                confident: ["Belle rafle pour moi, mais tu peux encore te rattraper.", "Une rafle ! Mais tu as encore de beaux coups à jouer."],
                supportive: ["Désolé pour la rafle ! Mais ce n'est pas fini du tout.", "Une grosse rafle, oui, mais une bonne réponse peut tout changer."],
                nervous: ["Quelle chance, cette rafle me sauve !", "Ouf, cette rafle me fait du bien."]
            },
            playerCapture: {
                chill: ["Bien vu !", "Joli coup, je ne l'avais pas vu venir."],
                confident: ["Bien joué, tu m'as pris un pion !", "Joli, je vais devoir faire plus attention."],
                supportive: ["Voilà ! Joli coup, tu vois que tu joues très bien.", "Bravo, très bien vu."],
                nervous: ["Aïe, tu me mets en difficulté !", "Bien joué, ça commence à piquer."]
            },
            playerMultiCapture: {
                chill: ["Magnifique, quelle belle rafle !", "Bravo, je n'avais rien vu venir."],
                confident: ["Bravo, belle rafle ! Je ne l'avais pas vue venir."],
                supportive: ["Superbe rafle ! Tu viens de tout remettre en jeu.", "Bravo, quel beau coup !"],
                nervous: ["Quelle rafle ! Là, je suis en difficulté.", "Bravo, tu m'as bien eu !"]
            },
            botKing: {
                chill: ["Je passe dame.", "J'ai une dame maintenant."],
                confident: ["J'ai une dame, mais tu peux encore la bloquer."],
                supportive: ["J'ai une dame, mais tu as encore de quoi me bloquer.", "Une dame pour moi, mais rien n'est joué."],
                nervous: ["Enfin une dame ! Ça me soulage."]
            },
            playerKing: {
                chill: ["Bravo pour ta dame !", "Belle dame, bien joué."],
                confident: ["Bravo, une dame ! Ça va rendre la partie intéressante."],
                supportive: ["Super, une dame ! Ça relance tout.", "Bravo pour ta dame, bien joué."],
                nervous: ["Oh, une dame... ça se complique pour moi."]
            },
            playerIdle: {
                chill: ["Prends ton temps, il n'y a aucune urgence.", "Réfléchis tranquillement, je ne vais nulle part."],
                supportive: ["Prends ton temps, pas de pression. On joue pour se détendre.", "Pas de souci, je patiente avec plaisir."]
            },
            botWin: {
                chill: ["Belle partie ! C'était agréable de jouer avec toi. On en refait une ?", "Bien joué, c'était serré par moments. Une revanche ?"],
                confident: ["Belle partie, merci à toi. Une revanche quand tu veux ?"],
                supportive: ["Merci pour cette belle partie, tu as bien résisté jusqu'au bout. Une revanche, quand tu veux ?", "Belle partie, vraiment. Je serai ravi d'en refaire une quand tu voudras."],
                nervous: ["Ouf, j'ai eu chaud ! Belle partie."]
            },
            botLose: {
                chill: ["Bravo, tu as gagné ! Belle partie.", "Tu m'as bien eu, bravo ! Une revanche ?"],
                confident: ["Bravo, tu m'as battu. Je ne m'y attendais pas !"],
                supportive: ["Bravo, tu as gagné ! Tu as très bien joué, vraiment.", "Superbe partie, félicitations !"],
                nervous: ["Bravo, tu le mérites largement."]
            }
        };
        const group = bank[eventName];
        const pool = group && (group[tone] || group[tone === 'tilted' ? 'nervous' : 'chill'] || group.chill);
        return pool ? this._compose(tone, pool) : null;
    }

    // --- UTILITIES & STORAGE ---

    _pickUnique(list) {
        const unused = list.filter(item => !this.usedSignatures.has(item));
        const source = unused.length > 0 ? unused : list;
        if (unused.length === 0) list.forEach(item => this.usedSignatures.delete(item));
        const chosen = source[Math.floor(Math.random() * source.length)];
        this.usedSignatures.add(chosen);
        return chosen;
    }

    _loadStat(key, fallback) {
        try {
            const val = localStorage.getItem(`checkers_bot_${key}`);
            return val !== null ? parseInt(val, 10) : fallback;
        } catch {
            return fallback;
        }
    }

    _saveStat(key, val) {
        try {
            localStorage.setItem(`checkers_bot_${key}`, String(val));
        } catch { /* ignore private mode errors */ }
    }

    _loadText(key, fallback) {
        try {
            const val = localStorage.getItem(`checkers_bot_${key}`);
            return val !== null ? val : fallback;
        } catch {
            return fallback;
        }
    }

    _saveText(key, val) {
        this._saveStat(key, val);
    }

    _loadList(key) {
        try {
            const parsed = JSON.parse(localStorage.getItem(`checkers_bot_${key}`) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    _saveList(key, list) {
        this._saveStat(key, JSON.stringify(list));
    }

    // Fills {nom} (", Marie" or nothing), {bot} and {hello}, then capitalizes
    _finalize(text) {
        if (!text) return '';
        const name = this.state.playerName;
        const out = text
            .replace(/,?\s*\{nom\}/g, name ? `, ${name}` : '')
            .replace(/\{bot\}/g, this.name)
            .replace(/\{hello\}/g, this._greetingWord())
            .replace(/\s{2,}/g, ' ')
            .trim();
        return out.charAt(0).toUpperCase() + out.slice(1);
    }

    // Queue messages so none is ever lost, and keep a calm rhythm between them
    _sendHumanLike(textOrList, priority = 1, after = null, immediate = false) {
        const list = [].concat(textOrList).filter(Boolean);
        list.forEach((raw, i) => {
            const text = this._finalize(raw);
            if (!text) return;
            this.queue.push({
                text,
                priority,
                after: i === list.length - 1 ? after : null,
                immediate
            });
        });
        while (this.queue.length > 4) {
            let idx = 0;
            this.queue.forEach((m, i) => { if (m.priority < this.queue[idx].priority) idx = i; });
            this.queue.splice(idx, 1);
        }
        this._drainQueue();
    }

    _drainQueue() {
        if (this.isTyping || this.queue.length === 0) return;
        const nextIndex = this.queue.reduce(
            (best, item, index, queue) => item.priority > queue[best].priority ? index : best,
            0
        );
        const item = this.queue.splice(nextIndex, 1)[0];
        if (item.immediate) {
            this.onTypingChange(false, this.name);
            this._deliverQueuedItem(item);
            return;
        }
        this.isTyping = true;

        const wait = Math.max(0, this.minGapMs - (Date.now() - this.lastDeliveredAt));
        const readDelay = wait + (950 + Math.random() * 1200) * this.pace;
        setTimeout(() => {
            this.onTypingChange(true, this.name);
            const typeDuration = Math.min(4200, Math.max(900, item.text.length * 38 + Math.random() * 400)) * this.pace;
            setTimeout(() => {
                this.onTypingChange(false, this.name);
                this._deliverQueuedItem(item);
            }, typeDuration);
        }, readDelay);
    }

    _deliverQueuedItem(item) {
        this.isTyping = false;
        this.lastMessageTime = this.lastDeliveredAt = Date.now();
        this.onMessage({
            sender: this.name,
            text: item.text,
            tone: this._getEffectiveTone(),
            timestamp: Date.now()
        });
        this._remember('assistant', item.text);
        if (item.after) item.after();
        this._drainQueue();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartFrenchCheckersBot;
} else if (typeof window !== 'undefined') {
    window.SmartFrenchCheckersBot = SmartFrenchCheckersBot;
}

export default SmartFrenchCheckersBot;
