/**
 * Single place where deployment settings enter the app.
 * index.html may still define window.APP_VERSION / window.llm_url; they are read
 * here once and nowhere else.
 */
export function readConfig(source = globalThis) {
  return Object.freeze({
    version: String(source.APP_VERSION || "0.29"),
    llmEndpoint: source.llm_url || "/chat"
  });
}
