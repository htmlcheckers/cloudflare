/** Sound and fullscreen buttons. */
export class Toolbar {
  constructor({ soundButton, fullscreenButton, sound, i18n, doc = globalThis.document, messagesEl }) {
    this.soundButton = soundButton;
    this.fullscreenButton = fullscreenButton;
    this.sound = sound;
    this.i18n = i18n;
    this.doc = doc;
    this.messagesEl = messagesEl;

    soundButton.addEventListener("click", () => sound.toggle());
    fullscreenButton.addEventListener("click", () => this.#toggleFullscreen());
    doc.addEventListener("fullscreenchange", () => this.refresh());
    sound.onChange(() => this.refresh());
    i18n.onChange(() => this.refresh());
    this.refresh();
  }

  refresh() {
    const { sound, i18n } = this;
    this.soundButton.textContent = sound.enabled ? "\u{1f50a}" : "\u{1f507}";
    this.soundButton.setAttribute("aria-label", i18n.t(sound.enabled ? "soundOff" : "soundOn"));
    this.soundButton.setAttribute("aria-pressed", String(sound.enabled));

    const isFullscreen = Boolean(this.doc.fullscreenElement);
    this.fullscreenButton.textContent = isFullscreen ? "\u25a3" : "\u26f6";
    const label = i18n.t(isFullscreen ? "exitFullscreen" : "enterFullscreen");
    this.fullscreenButton.setAttribute("aria-label", label);
    this.fullscreenButton.setAttribute("title", label);
  }

  async #toggleFullscreen() {
    try {
      if (this.doc.fullscreenElement) await this.doc.exitFullscreen();
      else await this.doc.documentElement.requestFullscreen();
    } catch (error) {
      console.error("Could not change fullscreen mode:", error);
      const previous = this.messagesEl.textContent;
      const message = this.i18n.t("fullscreenError");
      this.messagesEl.textContent = message;
      setTimeout(() => {
        if (this.messagesEl.textContent === message) this.messagesEl.textContent = previous;
      }, 3000);
    }
  }
}
