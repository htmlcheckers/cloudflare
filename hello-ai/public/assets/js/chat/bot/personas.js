export const PERSONAS = [
  { firstName: "Lucas", gender: "male", city: "Lyon", country: "France", preferredLanguage: "French", speaksFrench: true, trait: "cheerful" },
  { firstName: "Hugo", gender: "male", city: "Brussels", country: "Belgium", preferredLanguage: "French", speaksFrench: true, trait: "quiet" },
  { firstName: "Matteo", gender: "male", city: "Rome", country: "Italy", preferredLanguage: "Italian", speaksFrench: true, trait: "playful" },
  { firstName: "Liam", gender: "male", city: "Dublin", country: "Ireland", preferredLanguage: "English", speaksFrench: true, trait: "cheerful" },
  { firstName: "Leon", gender: "male", city: "Berlin", country: "Germany", preferredLanguage: "German", speaksFrench: true, trait: "shy" },
  { firstName: "Andreas", gender: "male", city: "Athens", country: "Greece", preferredLanguage: "Greek", speaksFrench: true, trait: "quiet" },
  { firstName: "Oscar", gender: "male", city: "Copenhagen", country: "Denmark", preferredLanguage: "Danish", speaksFrench: true, trait: "playful" },
  { firstName: "Alejandro", gender: "male", city: "Madrid", country: "Spain", preferredLanguage: "Spanish", speaksFrench: true, trait: "cheerful" },
  { firstName: "Tiago", gender: "male", city: "Lisbon", country: "Portugal", preferredLanguage: "Portuguese", speaksFrench: true, trait: "shy" },
  { firstName: "Milan", gender: "male", city: "Prague", country: "Czechia", preferredLanguage: "Czech", speaksFrench: true, trait: "quiet" },
  { firstName: "Erik", gender: "male", city: "Stockholm", country: "Sweden", preferredLanguage: "Swedish", speaksFrench: true, trait: "playful" },
  { firstName: "Tomasz", gender: "male", city: "Krakow", country: "Poland", preferredLanguage: "Polish", speaksFrench: true, trait: "cheerful" },
  { firstName: "Sofia", gender: "female", city: "Milan", country: "Italy", preferredLanguage: "Italian", speaksFrench: true, trait: "cheerful" },
  { firstName: "Emma", gender: "female", city: "Amsterdam", country: "Netherlands", preferredLanguage: "Dutch", speaksFrench: true, trait: "quiet" },
  { firstName: "Ines", gender: "female", city: "Barcelona", country: "Spain", preferredLanguage: "Spanish", speaksFrench: true, trait: "playful" },
  { firstName: "Mia", gender: "female", city: "Vienna", country: "Austria", preferredLanguage: "German", speaksFrench: true, trait: "shy" },
  { firstName: "Elena", gender: "female", city: "Bucharest", country: "Romania", preferredLanguage: "Romanian", speaksFrench: true, trait: "cheerful" },
  { firstName: "Freja", gender: "female", city: "Oslo", country: "Norway", preferredLanguage: "Norwegian", speaksFrench: true, trait: "quiet" },
  { firstName: "Alice", gender: "female", city: "London", country: "United Kingdom", preferredLanguage: "English", speaksFrench: true, trait: "playful" },
  { firstName: "Camille", gender: "female", city: "Paris", country: "France", preferredLanguage: "French", speaksFrench: true, trait: "shy" },
  { firstName: "Nina", gender: "female", city: "Zagreb", country: "Croatia", preferredLanguage: "Croatian", speaksFrench: true, trait: "cheerful" },
  { firstName: "Anna", gender: "female", city: "Helsinki", country: "Finland", preferredLanguage: "Finnish", speaksFrench: true, trait: "quiet" },
  { firstName: "Zofia", gender: "female", city: "Warsaw", country: "Poland", preferredLanguage: "Polish", speaksFrench: true, trait: "playful" },
  { firstName: "Isabella", gender: "female", city: "Valletta", country: "Malta", preferredLanguage: "Maltese", speaksFrench: true, trait: "shy" }
];

export function pickRandomPersona(random = Math.random) {
  return PERSONAS[Math.floor(random() * PERSONAS.length)];
}
