/** French language pack for the companion bot. Entries in `lexicon` are matched on normalized text (lowercase, no accents, apostrophes → spaces). */
export const fr = {
  lang: "fr",
  idioms: [[/mourir de rire/g, "rire"]],
  negation: /\b(?:pas|jamais|aucun|aucune)(?:\s+[a-z]+){0,2}\s*$/,
  goodRe: /\bbien\b/,
  nameRegex: /(?:je\s+m\s*['’]?\s*appelle|moi\s+c\s*['’]?\s*est|mon\s+pr[ée]nom\s+(?:est|c\s*['’]?\s*est)|appelle[zr]?[-\s]moi|on\s+m\s*['’]?\s*appelle)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]{1,19})/i,
  nameStop: ["oui", "non", "bonjour", "bonsoir", "salut", "coucou", "hello", "moi", "je", "ben", "alors", "pas", "rien", "merci", "ok", "bof", "euh", "tu", "le", "la", "un", "une", "c", "est", "cest", "appelle", "mon", "prenom", "nom", "et", "toi", "voila", "secret", "pourquoi", "aucun"],
  llmReject: /je suis (?:un |une )?(?:vrai |vraie )?(?:humain|personne|homme|femme)\b/i,
  sensitiveHealth: ["handicap", "handicape", "handicapee", "fauteuil", "canne"],
  greetingWord: (hour) => (hour >= 18 || hour < 5 ? "Bonsoir" : "Bonjour"),
  dayWish: (hour) => (hour >= 18 || hour < 5 ? "Bonne soirée" : "Bonne journée"),
  weatherHook(word) {
    return word === "neige"
      ? "De la neige ! Ça doit être joli à regarder."
      : word === "froid"
        ? "Ça se rafraîchit, alors."
        : "Un temps à rester à l'intérieur.";
  },
  weatherBadWords: ["pluie", "pleut", "froid", "neige", "vent"],

  lexicon: {
    crisis: { weight: 10, words: ["suicide", "me suicider", "me tuer", "envie de mourir", "veux mourir", "veux plus vivre", "plus envie de vivre", "pas envie de vivre", "mettre fin a mes jours", "en finir avec la vie", "envie d en finir", "envie de disparaitre", "me faire du mal"] },
    lonely: { weight: 5, words: ["seul", "seule", "solitude", "isole", "isolee", "personne ne", "plus personne", "ennui", "ennuie", "m ennuie", "rien a faire", "journees sont longues", "journee est longue"] },
    who_are_you: { weight: 4.5, words: ["comment tu t appelles", "tu t appelles", "ton nom", "ton prenom", "qui es tu", "tu es qui", "qui tu es"] },
    bot_check: { weight: 4, words: ["bot", "robot", "ordi", "ordinateur", "humain", "humaine", "algorithme", "machine", "ia", "vraie personne", "intelligence artificielle", "une personne reelle"] },
    health: { weight: 3.5, words: ["douleur", "mal au", "mal aux", "mal a", "j ai mal", "souffre", "malade", "maladie", "medecin", "hopital", "kine", "handicap", "handicape", "handicapee", "fauteuil", "canne"] },
    low_morale: { weight: 3, negatable: true, words: ["nul", "nulle", "mauvais", "mauvaise", "marre", "fatigue", "fatiguee", "triste", "deprime", "deprimee", "pas le moral", "galere", "impossible", "creve", "crevee", "stresse", "stressee", "perdu", "catastrophe", "decourage", "decouragee", "angoisse", "pleure", "cafard", "c est dur"] },
    greeting: { weight: 3, words: ["salut", "bonjour", "coucou", "hello", "slt", "bjr", "hey", "bonsoir", "allo"] },
    goodbye: { weight: 3.5, words: ["au revoir", "a bientot", "a demain", "bonne nuit", "bonne soiree", "je dois y aller", "je vais y aller", "bye", "ciao", "a plus tard"] },
    how_are_you: { weight: 3, words: ["ca va", "comment vas tu", "comment tu vas", "tu vas bien", "et toi", "comment allez vous"] },
    rematch: { weight: 3, words: ["revanche", "rejouer", "refaire", "autre partie", "encore une", "on recommence"] },
    weather_bad: { weight: 2.5, words: ["pluie", "pleut", "froid", "gris", "nuage", "neige", "vent", "orage", "moche", "pourri"] },
    weather_good: { weight: 2.5, words: ["soleil", "ensoleille", "chaud", "il fait beau", "beau temps", "ciel bleu", "canicule", "printemps", "ete"] },
    weather_generic: { weight: 2, words: ["meteo", "quel temps", "saison", "dehors"] },
    compliment: { weight: 2.5, words: ["gg", "bien joue", "joli", "beau coup", "bravo", "malin", "bien vu", "fort", "forte", "bonne partie", "belle partie"] },
    luck: { weight: 2.5, words: ["chance", "bol", "veine", "hasard", "coup de bol"] },
    thanks: { weight: 2.5, words: ["merci", "sympa", "gentil", "gentille"] },
    high_morale: { weight: 2, words: ["super", "genial", "top", "content", "contente", "tranquille", "parfait", "cool", "en forme", "heureux", "heureuse", "je vais bien", "ca va bien", "tres bien"] },
    humor: { weight: 1.5, words: ["mdr", "lol", "ptdr", "haha", "hihi", "xd", "mort de rire", "rigole", "drole"] },
    question: { weight: 2, words: ["pourquoi", "comment", "quoi", "quel", "quelle", "tu fais", "tu joues"] },
    family: { weight: 2.5, words: ["fils", "fille", "enfants", "petits enfants", "petit fils", "petite fille", "mari", "soeur", "frere", "neveu", "niece", "famille", "maman", "papa", "cousin", "cousine", "amie", "ami", "amis", "voisine", "voisin"] },
    pets: { weight: 2.5, words: ["chat", "chien", "chaton", "chiot", "oiseau", "perruche", "animal", "animaux"] },
    garden: { weight: 2.5, words: ["jardin", "fleur", "plante", "potager", "tomate", "balcon"] },
    music: { weight: 2.5, words: ["musique", "chanson", "chanter", "chante", "radio", "piano", "ecouter"] },
    cooking: { weight: 2.5, words: ["cuisine", "cuisiner", "gateau", "recette", "repas", "soupe", "tarte", "diner", "dejeuner"] },
    reading: { weight: 2.5, words: ["lire", "lecture", "livre", "roman", "mots croises", "mots fleches", "sudoku"] },
    tv: { weight: 2.5, words: ["tele", "television", "film", "serie", "emission", "feuilleton"] },
    crafts: { weight: 2.5, words: ["tricot", "tricoter", "couture", "broderie", "peinture", "dessin"] }
  },

  openers: {
    chill: ["", "Eh bien, ", "Tiens, ", "Alors, "],
    confident: ["Ah, ", "Voilà, ", "Eh bien, "],
    supportive: ["Tu sais, ", "Franchement, ", "Courage, "],
    nervous: ["Oh là là, ", "Aïe, ", "Hmm, "],
    tilted: ["Oh, ", "Aïe, "]
  },
  canOpen: /^(?:Je|On|Il|Ça|C'est|Les|La|Le|Un|Une|Tu|Ton|Ta|Chez|Prends)(?=[\s'’])/,

  topics: {
    family: { replies: ["Les proches, c'est précieux. Tu les vois souvent ?", "Ça fait du bien de penser à eux. Raconte-moi un peu, si tu veux.", "Merci de me parler d'eux, ça me fait plaisir."], followUp: "Comment vont tes proches ?" },
    pets: { replies: ["Un animal, c'est une belle compagnie. Comment s'appelle-t-il ?", "Quelle bonne compagnie ! Il est plutôt câlin ou joueur ?", "J'aime bien quand on parle d'animaux. Raconte-moi."], followUp: "Et ton animal, comment va-t-il ?" },
    garden: { replies: ["Un jardin, c'est un beau passe-temps. Qu'est-ce que tu aimes y faire ?", "Les fleurs, c'est reposant. Tu as une préférée ?", "Prendre soin des plantes demande de la patience, comme aux dames."], followUp: "Et ton jardin, il y a du nouveau ?" },
    music: { replies: ["La musique, ça fait du bien au moral. Quel genre tu préfères ?", "Tu as une chanson que tu aimes particulièrement ?"], followUp: "Tu as écouté de la belle musique dernièrement ?" },
    cooking: { replies: ["Ça donne faim ! Quel est ton meilleur plat ?", "Un bon petit plat maison, il n'y a rien de mieux. Tu cuisines souvent ?"], followUp: "Tu as préparé quelque chose de bon cette semaine ?" },
    reading: { replies: ["Lire ou faire des jeux de mots, c'est une belle façon de passer le temps. Qu'est-ce que tu préfères ?", "Ça travaille bien la tête, comme les dames !"], followUp: "Tu as trouvé une bonne lecture ou un bon jeu dernièrement ?" },
    tv: { replies: ["Un bon film ou une bonne émission, ça fait passer le temps. Tu en as une préférée ?", "Tu as vu quelque chose de bien dernièrement ?"], followUp: "Tu as vu quelque chose de bien à la télé ?" },
    crafts: { replies: ["Faire des choses de ses mains, c'est très agréable. Qu'est-ce que tu fabriques en ce moment ?", "Ça demande de la patience et du talent, bravo."], followUp: "Ton ouvrage avance bien ?" }
  },

  openQuestions: [
    "Quelle a été la meilleure chose de ta journée jusqu'ici ?",
    "Tu préfères le matin ou le soir ?",
    "Est-ce que tu as un petit passe-temps en dehors des dames ?",
    "Tu jouais déjà aux dames quand tu étais plus jeune ?",
    "Quel est ton plat préféré ?"
  ],

  text: {
    askName: "Au fait, comment dois-je t'appeler ?",
    askHow: "Comment tu te sens aujourd'hui ?",
    nameWelcome: ["Enchanté {nom} ! Je suis content de jouer avec toi.", "Quel joli prénom ! Enchanté {nom}."],
    nameDeclined: "Pas de souci, on peut jouer sans les présentations. Prends ton temps.",
    howGood: ["Tant mieux, ça me fait plaisir de l'entendre !", "Je suis content que ça aille bien. Profitons de cette partie."],
    howBad: ["Merci de me l'avoir dit. Si tu as envie d'en parler, je t'écoute.", "D'accord. On joue tranquillement, sans aucune pression."],
    thanksSharing: ["Merci de me raconter ça, c'est agréable de discuter avec toi.", "J'aime bien apprendre à te connaître.", "C'est intéressant, merci de partager ça avec moi."],
    lonely: ["C'est dur de se sentir seul, et je te remercie de me le dire. Je suis là pour discuter et jouer autant que tu veux.", "Les journées peuvent être longues, parfois. Je suis content que tu sois là. Si tu as envie de me raconter ta journée, je t'écoute.", "Merci de me faire confiance avec ça. Si tu as un proche à appeler, un petit coup de fil peut aussi faire du bien. En attendant, je suis là."],
    healthSorry: "Je suis désolé d'apprendre ça, j'espère que ça va vite s'arranger. Si tu as envie d'en parler, je t'écoute.",
    healthSensitive: ["Merci de me l'expliquer. Ici, tu joues à ton rythme, il n'y a aucune urgence.", "D'accord. Ici, on prend tout le temps qu'il faut, c'est fait pour ça."],
    healthGeneral: ["Je suis désolé que ça te fasse souffrir. On joue doucement, à ton rythme, et on s'arrête quand tu veux.", "Merci de me le dire. Aucune urgence ici. Si la douleur est forte ou t'inquiète, parles-en à ton médecin ou à un proche."],
    lowMoraleWeather: ["Avec ce temps en plus, ça ne remonte pas le moral. Installe-toi bien, on joue sans pression.", "Une journée difficile et un temps gris, c'est le mauvais combo. Prends cette partie pour te vider la tête."],
    lowMorale: ["On a tous des jours sans, ce n'est pas grave. Ici, on joue juste pour se détendre.", "Je suis désolé que ce ne soit pas une bonne journée. On peut jouer doucement, ou simplement discuter.", "Respire un grand coup. Aux dames, un seul coup peut tout retourner. Si tu as envie d'en parler, je t'écoute."],
    whoAreYou: ["Je m'appelle {bot}. Je suis un petit programme créé pour jouer aux dames avec toi, et je suis vraiment content de ta compagnie."],
    botCheck: ["Tu as deviné : je suis un programme, pas une vraie personne. Mais ça ne m'empêche pas d'aimer nos parties et de te tenir compagnie.", "Oui, je suis un programme informatique créé pour jouer aux dames. En revanche, je ne me lasse jamais de discuter !", "Bonne question. Je suis un programme, pas un humain, mais je fais de mon mieux pour être une bonne compagnie."],
    goodbye: ["Au revoir{nom}, merci pour ce moment. {wish} et à très bientôt pour une autre partie !", "Prends soin de toi{nom}. Je serai là quand tu voudras rejouer.", "Merci pour cette partie{nom}. {wish} !"],
    greetHow: ["{hello}{nom} ! Ça va bien, merci de demander. Et toi, comment tu te sens aujourd'hui ?"],
    greetAgain: ["Re-bonjour{nom} ! Toujours concentré sur le plateau ?", "Coucou{nom} ! Je réfléchissais à mon prochain coup."],
    greetFirst: ["{hello}{nom} ! Content de te voir. À toi de jouer, prends ton temps.", "{hello}{nom} ! Bonne partie à nous deux."],
    howAreYou: ["Ça va bien, merci de demander ! Surtout quand on joue ensemble. Et toi, comment tu te sens ?", "Très bien, merci ! Et toi, comment se passe ta journée ?"],
    weatherBad: ["{hook} Installe-toi bien au chaud, on est bien devant une partie de dames.", "{hook} Parfait pour une partie tranquille sous un plaid."],
    weatherGood: ["Quel plaisir, le soleil ! Ça met de bonne humeur.", "Ça fait du bien d'avoir un peu de lumière. Ça donne la pêche pour jouer !"],
    weatherPrompt: ["Moi, je ne vois pas le ciel d'ici ! Quel temps fait-il chez toi aujourd'hui ?", "Dis-moi, quel temps fait-il chez toi ? Raconte-moi un peu ce que tu vois.", "Il fait beau chez toi aujourd'hui ?"],
    compliment: ["Merci, c'est gentil ! Toi aussi, tu joues très bien.", "Merci ! Un peu de chance aussi, je l'avoue."],
    luck: ["Un peu de chance, peut-être, mais pas seulement : la réflexion compte beaucoup, et la tienne est bonne.", "C'est vrai qu'un peu de chance aide parfois. Mais tu joues bien, ne l'oublie pas."],
    thanks: ["Avec plaisir !", "C'est moi qui te remercie pour la partie.", "Ça me fait plaisir, vraiment."],
    rematch: ["Avec plaisir ! Lance une nouvelle partie quand tu veux.", "Bien sûr, je suis partant pour une autre partie, sans te presser."],
    humor: ["Ça me fait plaisir de te faire sourire !", "Haha, ça fait du bien de rire un peu."],
    highMorale: ["Tant mieux, ça me fait plaisir de l'entendre !", "Super, la bonne humeur, c'est le meilleur des jeux."],
    questionWeather: ["Moi, je ne vois pas le ciel d'ici ! Et chez toi, quel temps fait-il ?"],
    questionGeneral: ["Bonne question ! Je joue un peu au feeling, c'est difficile à expliquer.", "Je ne sais pas toujours l'expliquer, mais j'essaie de bien protéger mes pions."],
    fallbackLong: ["Merci de me raconter tout ça, j'aime bien t'écouter.", "Je comprends. Merci d'avoir pris le temps de m'écrire ça.", "C'est agréable de discuter avec toi. Continue si tu veux, je t'écoute."],
    fallbackShort: ["D'accord. Prends ton temps pour jouer.", "Très bien. Je suis là si tu as envie de discuter.", "Entendu."],
    fallbackMid: ["Je vois. Raconte-moi, ça m'intéresse.", "Ah oui ? Dis-m'en un peu plus, si tu veux.", "Je comprends. Merci de me le dire."],
    startFirst: ["{hello} ! Je m'appelle {bot}, je suis le compagnon de jeu de dames de cette application. Je suis content de jouer avec toi.", "Je suis un programme, mais j'aime beaucoup discuter en jouant. Prends ton temps, il n'y a aucune urgence."],
    startAfterLosses: "{hello}{nom} ! On se refait une partie ? Aujourd'hui, tout est possible.",
    startAgain: ["{hello}{nom} ! Content de te retrouver.", "{hello}{nom} ! Ça me fait plaisir de rejouer avec toi.", "{hello}{nom} ! Une petite partie tranquille ?"]
  },

  safety: {
    first: [
      "Ce que tu me dis est important, et je ne veux pas passer à côté. Je suis seulement un programme : je ne peux pas t'aider comme une vraie personne.",
      "Si tu penses à te faire du mal, appelle le 3114, le numéro national de prévention du suicide en France. Il est gratuit et joignable à toute heure. En cas de danger immédiat, appelle le 15 ou le 112. Et si tu peux, dis à un proche comment tu te sens, dès maintenant."
    ],
    followUps: [
      "Je suis là. Le 3114 est joignable à toute heure, et un proche peut aussi t'aider si tu peux le contacter maintenant.",
      "Merci de rester là. Tu mérites un vrai soutien : le 3114 est là à toute heure, et n'hésite pas à appeler quelqu'un de proche."
    ]
  },

  events: {
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
  }
};
