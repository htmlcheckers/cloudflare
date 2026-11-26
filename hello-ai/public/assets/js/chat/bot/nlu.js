/** Language-agnostic text analysis driven by a language pack. */

export function normalizeText(text) {
  return String(text)
    .toLowerCase()
    .replace(/œ/g, "oe")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, " ")
    .trim();
}

const escapeRegExp = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function createNlu(pack) {
  // Whole-word match; a trailing "s" is tolerated automatically.
  const matchers = {};
  for (const [intent, data] of Object.entries(pack.lexicon)) {
    matchers[intent] = data.words.map((word) => ({
      word,
      re: new RegExp("(?:^|[^a-z0-9])" + escapeRegExp(word) + "s?(?![a-z0-9])")
    }));
  }

  function analyze(rawText) {
    const clean = normalizeText(rawText);
    let scan = clean;
    (pack.idioms || []).forEach(([pattern, replacement]) => {
      scan = scan.replace(pattern, replacement);
    });
    const scores = {};
    const matchedWords = [];

    for (const [intent, data] of Object.entries(pack.lexicon)) {
      let score = 0;
      for (const matcher of matchers[intent]) {
        const hit = matcher.re.exec(scan);
        if (!hit) continue;
        // "I am not sad" must not count as sadness.
        if (data.negatable && pack.negation.test(clean.slice(0, hit.index))) continue;
        score += data.weight;
        matchedWords.push(matcher.word);
      }
      if (score > 0) scores[intent] = score;
    }
    if (rawText.includes("?")) scores.question = (scores.question || 0) + 1.5;

    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return {
      clean,
      scores,
      topIntent: ranked[0] ? ranked[0][0] : "fallback",
      secondIntent: ranked[1] ? ranked[1][0] : null,
      matchedWords
    };
  }

  function extractName(raw, expecting) {
    const stop = new Set(pack.nameStop);
    const strip = (word) => normalizeText(word).replace(/[^a-z]/g, "");
    let candidate = null;
    const match = raw.match(pack.nameRegex);
    if (match) {
      candidate = match[1];
    } else if (expecting && !raw.includes("?")) {
      const words = raw.replace(/[.,!;:]/g, " ").split(/\s+/).filter(Boolean);
      if (words.length > 0 && words.length <= 3) {
        candidate = words.filter((word) => !stop.has(strip(word))).pop() || null;
      }
    }
    if (
      !candidate ||
      !/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]{1,19}$/.test(candidate) ||
      stop.has(strip(candidate))
    ) {
      return null;
    }
    return candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
  }

  return { analyze, extractName };
}
