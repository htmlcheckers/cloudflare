import { en } from "../locales/en.js";
import { fr } from "../locales/fr.js";

const LOCALES = Object.freeze({ en, fr });
export const SUPPORTED_LANGUAGES = Object.freeze(Object.keys(LOCALES));

export function isLanguage(value) {
  return typeof value === "string" && Object.hasOwn(LOCALES, value);
}

export function detectLanguage(nav = globalThis.navigator) {
  const preferred = nav && nav.languages && nav.languages.length > 0
    ? nav.languages[0]
    : nav && nav.language;
  return preferred && /^fr(?:-|$)/i.test(preferred) ? "fr" : "en";
}

/** One translation service for the whole app (game UI and chat). */
export class I18n {
  constructor({ storage, navigatorRef = globalThis.navigator } = {}) {
    this.storage = storage;
    const saved = storage ? storage.get("language") : null;
    this.language = isLanguage(saved) ? saved : detectLanguage(navigatorRef);
    this.listeners = new Set();
  }

  t(key, params) {
    const text = LOCALES[this.language][key] ?? LOCALES.en[key] ?? key;
    return params
      ? text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
      : text;
  }

  setLanguage(language) {
    if (!isLanguage(language)) throw new RangeError(`Unsupported language: ${language}`);
    if (this.storage) this.storage.set("language", language);
    if (language === this.language) return;
    this.language = language;
    this.listeners.forEach((listener) => listener(language));
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Keep <html lang>, <title> and the meta description in sync. */
  applyToDocument(doc = globalThis.document) {
    if (!doc) return;
    doc.documentElement.lang = this.language;
    doc.title = this.t("title");
    const meta = doc.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", this.t("description"));
  }
}
