const SOURCES = Object.freeze({
  move: "assets/audio/move.mp3",
  take: "assets/audio/capture.mp3",
  menu: "assets/audio/menu.mp3"
});

export class SoundService {
  constructor({ storage, createAudio = (src) => new Audio(src) }) {
    this.storage = storage;
    this.createAudio = createAudio;
    this.audio = new Map();
    this.enabled = storage.get("soundEnabled") === "true";
    this.listeners = new Set();
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  toggle() {
    this.enabled = !this.enabled;
    this.storage.set("soundEnabled", this.enabled);
    this.listeners.forEach((listener) => listener(this.enabled));
    this.play("menu");
  }

  play(type) {
    if (!this.enabled || !SOURCES[type]) return;
    try {
      if (!this.audio.has(type)) this.audio.set(type, this.createAudio(SOURCES[type]));
      const playPromise = this.audio.get(type).play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((error) => console.debug("Audio playback was blocked:", error));
      }
    } catch (error) {
      console.debug("Audio unavailable:", error);
    }
  }
}
