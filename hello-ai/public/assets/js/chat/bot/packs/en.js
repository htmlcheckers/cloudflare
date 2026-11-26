/** English language pack for the companion bot. Lexicon entries are matched on normalized text (lowercase, apostrophes → spaces: "don t"). */
export const en = {
  lang: "en",
  idioms: [[/dying of laughter|dying laughing/g, "laughing"]],
  negation: /(?:\b(?:not|never|no)|n t)(?:\s+[a-z]+){0,2}\s*$/,
  goodRe: /\b(?:good|fine|great|well)\b/,
  nameRegex: /(?:my\s+name\s+is|my\s+name\s*['’]?\s*s|i\s+am\s+called|i\s*['’]?\s*m\s+called|call\s+me|people\s+call\s+me)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]{1,19})/i,
  nameStop: ["yes", "no", "hello", "hi", "hey", "me", "i", "well", "not", "nothing", "thanks", "thank", "you", "ok", "okay", "um", "uh", "my", "name", "is", "it", "s", "and", "why", "none", "secret", "call", "am", "the", "a"],
  llmReject: /\bi(?:\s+am|['’]m)\s+(?:a\s+)?(?:real\s+)?(?:human|person|man|woman)\b/i,
  sensitiveHealth: ["disabled", "disability", "wheelchair", "cane"],
  greetingWord: (hour) => (hour >= 18 || hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : "Hello"),
  dayWish: (hour) => (hour >= 18 || hour < 5 ? "Have a lovely evening" : "Have a lovely day"),
  weatherHook(word) {
    return word === "snow"
      ? "Snow! That must look lovely."
      : word === "cold"
        ? "Getting chilly, then."
        : "A good day to stay indoors.";
  },
  weatherBadWords: ["rain", "cold", "snow", "wind"],

  lexicon: {
    crisis: { weight: 10, words: ["suicide", "kill myself", "end my life", "want to die", "wanna die", "end it all", "hurt myself", "harm myself", "don t want to live", "do not want to live", "no reason to live", "better off dead"] },
    lonely: { weight: 5, words: ["lonely", "alone", "loneliness", "isolated", "no one", "nobody", "bored", "nothing to do", "days are long", "day is long"] },
    who_are_you: { weight: 4.5, words: ["what s your name", "your name", "who are you", "what are you called"] },
    bot_check: { weight: 4, words: ["bot", "robot", "computer", "human", "algorithm", "machine", "ai", "real person", "artificial intelligence"] },
    health: { weight: 3.5, words: ["pain", "hurts", "hurt", "sick", "ill", "illness", "doctor", "hospital", "physio", "disabled", "disability", "wheelchair", "cane", "ache", "aching"] },
    low_morale: { weight: 3, negatable: true, words: ["bad", "terrible", "awful", "tired", "sad", "depressed", "fed up", "exhausted", "stressed", "lost", "disaster", "discouraged", "anxious", "crying", "down", "hard day", "rough day"] },
    greeting: { weight: 3, words: ["hello", "hi", "hey", "good morning", "good evening", "good afternoon", "howdy", "greetings"] },
    goodbye: { weight: 3.5, words: ["goodbye", "bye", "see you", "see you later", "see you tomorrow", "good night", "have to go", "got to go", "gotta go", "talk later"] },
    how_are_you: { weight: 3, words: ["how are you", "how are you doing", "how s it going", "and you", "how do you do"] },
    rematch: { weight: 3, words: ["rematch", "play again", "another game", "one more", "go again"] },
    weather_bad: { weight: 2.5, words: ["rain", "raining", "cold", "grey", "gray", "cloud", "cloudy", "snow", "snowing", "wind", "windy", "storm", "miserable"] },
    weather_good: { weight: 2.5, words: ["sun", "sunny", "warm", "hot", "nice weather", "beautiful day", "blue sky", "spring", "summer"] },
    weather_generic: { weight: 2, words: ["weather", "season", "outside"] },
    compliment: { weight: 2.5, words: ["gg", "well played", "nice move", "good move", "bravo", "clever", "smart", "good game", "great game"] },
    luck: { weight: 2.5, words: ["luck", "lucky", "fluke"] },
    thanks: { weight: 2.5, words: ["thanks", "thank you", "kind", "nice of you", "sweet"] },
    high_morale: { weight: 2, words: ["great", "good", "fine", "happy", "wonderful", "excellent", "perfect", "cool", "in good shape", "doing well", "very well"] },
    humor: { weight: 1.5, words: ["lol", "haha", "hehe", "lmao", "funny", "rofl", "hilarious"] },
    question: { weight: 2, words: ["why", "how", "what", "which", "who", "do you", "are you"] },
    family: { weight: 2.5, words: ["son", "daughter", "children", "kids", "grandchildren", "grandson", "granddaughter", "husband", "wife", "sister", "brother", "nephew", "niece", "family", "mum", "mom", "dad", "cousin", "friend", "friends", "neighbor", "neighbour"] },
    pets: { weight: 2.5, words: ["cat", "dog", "kitten", "puppy", "bird", "parrot", "pet", "pets"] },
    garden: { weight: 2.5, words: ["garden", "flower", "plant", "vegetable", "tomato", "balcony"] },
    music: { weight: 2.5, words: ["music", "song", "sing", "radio", "piano", "listen"] },
    cooking: { weight: 2.5, words: ["cooking", "cook", "cake", "recipe", "meal", "soup", "pie", "dinner", "lunch"] },
    reading: { weight: 2.5, words: ["read", "reading", "book", "novel", "crossword", "sudoku"] },
    tv: { weight: 2.5, words: ["tv", "television", "film", "movie", "series", "show"] },
    crafts: { weight: 2.5, words: ["knitting", "knit", "sewing", "embroidery", "painting", "drawing"] }
  },

  openers: {
    chill: ["", "Well, ", "So, ", "Alright, "],
    confident: ["Ah, ", "There we go, ", "Well, "],
    supportive: ["You know, ", "Honestly, ", "Chin up, "],
    nervous: ["Oh dear, ", "Oh, ", "Hmm, "],
    tilted: ["Oh, ", "Ouch, "]
  },
  canOpen: /^(?:It|That|The|This|You|Your|We|There|Take|Let)(?=[\s'’])/,

  topics: {
    family: { replies: ["Family is precious. Do you see them often?", "It's nice to think of them. Tell me a little, if you like.", "Thank you for telling me about them, I enjoy that."], followUp: "How are your loved ones?" },
    pets: { replies: ["A pet is wonderful company. What's their name?", "What lovely company! Are they cuddly or playful?", "I like it when we talk about animals. Tell me more."], followUp: "And your pet, how are they doing?" },
    garden: { replies: ["A garden is a lovely pastime. What do you enjoy doing there?", "Flowers are so restful. Do you have a favourite?", "Looking after plants takes patience, just like checkers."], followUp: "And your garden, anything new?" },
    music: { replies: ["Music does wonders for the mood. What kind do you prefer?", "Is there a song you particularly love?"], followUp: "Have you listened to some nice music lately?" },
    cooking: { replies: ["That makes me hungry! What's your best dish?", "Nothing beats a good home-cooked meal. Do you cook often?"], followUp: "Did you make anything good this week?" },
    reading: { replies: ["Reading or word puzzles are a lovely way to pass the time. Which do you prefer?", "It keeps the mind sharp, just like checkers!"], followUp: "Found a good book or puzzle lately?" },
    tv: { replies: ["A good film or show makes time fly. Do you have a favourite?", "Have you seen anything good lately?"], followUp: "Seen anything good on TV?" },
    crafts: { replies: ["Making things by hand is so satisfying. What are you working on at the moment?", "That takes patience and talent, well done."], followUp: "Is your project coming along well?" }
  },

  openQuestions: [
    "What was the best part of your day so far?",
    "Do you prefer mornings or evenings?",
    "Do you have a hobby besides checkers?",
    "Did you play checkers when you were younger?",
    "What's your favourite dish?"
  ],

  text: {
    askName: "By the way, what should I call you?",
    askHow: "How are you feeling today?",
    nameWelcome: ["Nice to meet you{nom}! I'm happy to play with you.", "What a lovely name! Nice to meet you{nom}."],
    nameDeclined: "No problem, we can play without introductions. Take your time.",
    howGood: ["Glad to hear it!", "I'm happy you're doing well. Let's enjoy this game."],
    howBad: ["Thank you for telling me. If you feel like talking about it, I'm listening.", "All right. We'll play gently, with no pressure at all."],
    thanksSharing: ["Thank you for telling me that, it's nice chatting with you.", "I like getting to know you.", "That's interesting, thank you for sharing it with me."],
    lonely: ["It's hard to feel alone, and I'm grateful you told me. I'm here to chat and play as long as you like.", "The days can feel long sometimes. I'm glad you're here. If you'd like to tell me about your day, I'm listening.", "Thank you for trusting me with that. If there's someone you can call, a short phone call can help too. In the meantime, I'm here."],
    healthSorry: "I'm sorry to hear that, I hope it improves soon. If you'd like to talk about it, I'm listening.",
    healthSensitive: ["Thank you for explaining. Here you play at your own pace, there's no rush.", "Understood. Here we take all the time we need, that's what it's for."],
    healthGeneral: ["I'm sorry it's hurting. We'll play gently, at your pace, and stop whenever you like.", "Thank you for telling me. No rush here. If the pain is strong or worries you, please talk to your doctor or someone close."],
    lowMoraleWeather: ["With this weather as well, it doesn't lift the spirits. Settle in, we'll play with no pressure.", "A hard day and grey weather is a bad combination. Let this game clear your head."],
    lowMorale: ["We all have off days, it's okay. Here we only play to relax.", "I'm sorry it hasn't been a good day. We can play gently, or just chat.", "Take a deep breath. In checkers, a single move can turn everything around. If you want to talk about it, I'm listening."],
    whoAreYou: ["My name is {bot}. I'm a little program made to play checkers with you, and I'm really glad of your company."],
    botCheck: ["You guessed it: I'm a program, not a real person. But that doesn't stop me from enjoying our games and keeping you company.", "Yes, I'm a computer program made to play checkers. I never get tired of chatting, though!", "Good question. I'm a program, not a human, but I do my best to be good company."],
    goodbye: ["Goodbye{nom}, thank you for this moment. {wish}, and see you soon for another game!", "Take care{nom}. I'll be here when you want to play again.", "Thank you for the game{nom}. {wish}!"],
    greetHow: ["{hello}{nom}! I'm well, thank you for asking. And you, how are you feeling today?"],
    greetAgain: ["Hello again{nom}! Still focused on the board?", "Hi{nom}! I was thinking about my next move."],
    greetFirst: ["{hello}{nom}! Nice to see you. Your move, take your time.", "{hello}{nom}! Enjoy the game."],
    howAreYou: ["I'm well, thank you for asking! Especially when we play together. And you, how are you feeling?", "Very well, thank you! And how is your day going?"],
    weatherBad: ["{hook} Settle in somewhere warm, a game of checkers suits it well.", "{hook} Perfect for a quiet game under a blanket."],
    weatherGood: ["What a pleasure, the sun! It lifts the mood.", "It's good to have a little light. It makes me want to play!"],
    weatherPrompt: ["I can't see the sky from here! What's the weather like where you are today?", "Tell me, what's the weather like at your place? Describe what you see.", "Is it nice where you are today?"],
    compliment: ["Thank you, that's kind! You play very well too.", "Thanks! A bit of luck too, I admit."],
    luck: ["A little luck, perhaps, but not only: thinking matters a lot, and yours is good.", "It's true a bit of luck helps sometimes. But you play well, don't forget it."],
    thanks: ["My pleasure!", "I'm the one who should thank you for the game.", "I'm really glad."],
    rematch: ["Gladly! Start a new game whenever you like.", "Of course, I'm up for another game, no rush."],
    humor: ["I'm glad to make you smile!", "Haha, it's good to laugh a little."],
    highMorale: ["Glad to hear it!", "Great, good spirits are the best game of all."],
    questionWeather: ["I can't see the sky from here! And where you are, what's the weather like?"],
    questionGeneral: ["Good question! I play a bit by feel, it's hard to explain.", "I can't always explain it, but I try to protect my pieces well."],
    fallbackLong: ["Thank you for telling me all that, I like listening to you.", "I understand. Thank you for taking the time to write that.", "It's nice chatting with you. Carry on if you like, I'm listening."],
    fallbackShort: ["All right. Take your time with the game.", "Very well. I'm here if you feel like chatting.", "Understood."],
    fallbackMid: ["I see. Tell me more, I'm interested.", "Oh yes? Tell me a little more, if you like.", "I understand. Thank you for telling me."],
    startFirst: ["{hello}! My name is {bot}, I'm the checkers companion of this app. I'm happy to play with you.", "I'm a program, but I really enjoy chatting while we play. Take your time, there's no rush."],
    startAfterLosses: "{hello}{nom}! Shall we play another game? Anything is possible today.",
    startAgain: ["{hello}{nom}! Good to see you again.", "{hello}{nom}! I'm glad to play with you again.", "{hello}{nom}! A quiet little game?"]
  },

  safety: {
    first: [
      "What you're telling me is important, and I don't want to miss it. I'm only a program, so I can't help you the way a real person can.",
      "If you're thinking about harming yourself, please contact a crisis line or emergency services where you live. If you're in immediate danger, call your local emergency number (112 in Europe, 911 in the US). In the US you can call or text 988; in the UK and Ireland, Samaritans are on 116 123. And if you can, tell someone close to you how you feel, right now."
    ],
    followUps: [
      "I'm here. A crisis line or someone close to you can help right now. If you're in immediate danger, please call your local emergency number.",
      "Thank you for staying. You deserve real support: please reach out to a crisis line or someone you trust."
    ]
  },

  events: {
    botCapture: {
      chill: ["I'll take that piece.", "That one's mine, but the game is still long."],
      confident: ["One for me, but you still have good chances.", "I'm taking that one. Your move!"],
      supportive: ["I took a piece, but nothing is decided. You can easily come back.", "A single move can change everything in checkers. Keep faith."],
      nervous: ["Phew, I needed that one.", "Thanks, that puts me back in the game."]
    },
    botMultiCapture: {
      chill: ["Oh, a nice multi-capture! I was lucky on that one.", "A multi-capture for me, but the game goes on."],
      confident: ["Nice multi-capture for me, but you can still catch up.", "A multi-capture! But you still have good moves to play."],
      supportive: ["Sorry about the multi-capture! But it's far from over.", "A big capture, yes, but a good reply can change everything."],
      nervous: ["What luck, that capture saves me!", "Phew, that capture does me good."]
    },
    playerCapture: {
      chill: ["Well spotted!", "Nice move, I didn't see that coming."],
      confident: ["Well played, you took one of my pieces!", "Nice, I'll have to be more careful."],
      supportive: ["There you go! Nice move, you see you play very well.", "Bravo, well spotted."],
      nervous: ["Ouch, you're putting me in trouble!", "Well played, that's starting to sting."]
    },
    playerMultiCapture: {
      chill: ["Magnificent, what a multi-capture!", "Bravo, I saw nothing coming."],
      confident: ["Bravo, nice multi-capture! I didn't see it coming."],
      supportive: ["Superb multi-capture! You've just reopened everything.", "Bravo, what a move!"],
      nervous: ["What a multi-capture! Now I'm in trouble.", "Bravo, you got me!"]
    },
    botKing: {
      chill: ["I'm crowning a king.", "I have a king now."],
      confident: ["I have a king, but you can still block it."],
      supportive: ["I have a king, but you still have ways to block it.", "A king for me, but nothing is decided."],
      nervous: ["Finally a king! What a relief."]
    },
    playerKing: {
      chill: ["Congratulations on your king!", "Nice king, well played."],
      confident: ["Bravo, a king! That will make the game interesting."],
      supportive: ["Great, a king! That livens everything up.", "Bravo on your king, well played."],
      nervous: ["Oh, a king... this is getting complicated for me."]
    },
    playerIdle: {
      chill: ["Take your time, there's no rush.", "Think it over calmly, I'm not going anywhere."],
      supportive: ["Take your time, no pressure. We play to relax.", "No worries, I'm happy to wait."]
    },
    botWin: {
      chill: ["Good game! It was a pleasure playing with you. Shall we play another?", "Well played, it was tight at times. A rematch?"],
      confident: ["Good game, thank you. A rematch whenever you like?"],
      supportive: ["Thank you for this good game, you held on until the end. A rematch whenever you like?", "A really good game. I'd be delighted to play another whenever you want."],
      nervous: ["Phew, that was close! Good game."]
    },
    botLose: {
      chill: ["Congratulations, you won! Good game.", "You got me, bravo! A rematch?"],
      confident: ["Bravo, you beat me. I didn't expect that!"],
      supportive: ["Congratulations, you won! You played really well.", "Superb game, well done!"],
      nervous: ["Bravo, you fully deserve it."]
    }
  }
};
