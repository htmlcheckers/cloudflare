import { fr } from "./fr.js";
import { en } from "./en.js";

export const PACKS = Object.freeze({ fr, en });

export function getPack(language) {
  return PACKS[language] || PACKS.fr;
}
