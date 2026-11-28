const arr = (s) => [s];
const pack = {
  lexicon: {}, negation: /\bnot\b/, nameRegex: /my name is (\w+)/i, nameStop: [], idioms: [],
  openers: { chill: ["well, "], supportive: ["hey, "] }, canOpen: /^$/,
  llmReject: /i am human/i, goodRe: /good/, sensitiveHealth: [], weatherBadWords: [], weatherHook: () => "",
  topics: {}, openQuestions: ["what's up?"], events: { playerCapture: { chill: ["nice!"] } },
  safety: { first: ["are you ok?"], followUps: ["still here"] },
  greetingWord: () => "hello", dayWish: () => "have fun",
  text: {
    startFirst: arr("hello {nom}"), startAgain: arr("welcome back{nom}"), startAfterLosses: arr("sorry"),
    askName: "name?", askHow: "how?", weatherPrompt: arr("weather?"), nameWelcome: arr("hi"), nameDeclined: "ok",
    fallbackLong: arr("local long"), fallbackMid: arr("local mid"), fallbackShort: arr("local short"),
    thanksSharing: arr("thx"), howGood: arr("g"), howBad: arr("b"), questionGeneral: arr("q"), questionWeather: arr("qw"),
    lonely: arr("l"), healthSorry: "hs", healthSensitive: arr("hs"), healthGeneral: arr("hg"), lowMoraleWeather: arr("lw"), lowMorale: arr("lm"),
    whoAreYou: arr("w"), botCheck: arr("bc"), goodbye: arr("gb"), greetHow: arr("gh"), greetAgain: arr("ga"), greetFirst: arr("gf"),
    howAreYou: arr("ha"), weatherBad: arr("wb"), weatherGood: arr("wg"), compliment: arr("c"), luck: arr("lu"), thanks: arr("t"),
    rematch: arr("r"), humor: arr("h"), highMorale: arr("hm")
  }
};
export const getPack = () => pack;
