/** DOM side of the chat: panel, message log, input form. No bot logic here. */
export class ChatPanel {
  constructor({ center, toggleButton, panel, log, personaLabel, form, input, sendButton, i18n, matchMedia = globalThis.matchMedia }) {
    this.center = center;
    this.toggleButton = toggleButton;
    this.panel = panel;
    this.log = log;
    this.personaLabel = personaLabel;
    this.form = form;
    this.input = input;
    this.sendButton = sendButton;
    this.i18n = i18n;
    this.active = false;
    this.pending = false;
    this.thinking = null;
    this.submitHandler = null;
    this.compact = typeof matchMedia === "function"
      ? matchMedia.call(globalThis, "(max-width: 900px), (max-height: 720px)")
      : { matches: false, addEventListener() {} };

    toggleButton.addEventListener("click", () => this.toggle());
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = this.input.value.trim();
      if (!text || this.pending || !this.submitHandler) return;
      this.submitHandler(text);
    });
    input.addEventListener("input", () => this.#updateSend());
    this.compact.addEventListener("change", () => {
      if (this.active) this.setOpen(!this.compact.matches);
    });
    i18n.onChange(() => this.applyLanguage());
    this.applyLanguage();
  }

  onSubmit(handler) {
    this.submitHandler = handler;
  }

  /** Called when a game (and therefore a conversation) starts. */
  activate() {
    this.active = true;
    this.center.classList.add("chat-active");
    this.toggleButton.hidden = false;
    this.setOpen(!this.compact.matches);
  }

  clear() {
    this.log.replaceChildren();
    this.thinking = null;
  }

  setPersona(name) {
    this.personaLabel.textContent = name || this.i18n.t("chatPersonaFallback");
  }

  setPending(pending) {
    this.pending = pending;
    this.#updateSend();
  }

  toggle() {
    if (this.active) this.setOpen(this.panel.hidden);
  }

  setOpen(open) {
    this.panel.hidden = !open;
    this.toggleButton.setAttribute("aria-expanded", String(open));
    this.toggleButton.setAttribute("aria-label", this.i18n.t(open ? "chatHide" : "chatShow"));
    if (open && !this.pending) this.input.focus();
  }

  addMessage(text, author) {
    const element = globalThis.document.createElement("div");
    element.className = `chat-message chat-message-${author}`;
    if (author === "thinking") element.classList.add("chat-thinking");
    element.textContent = text;
    this.log.appendChild(element);
    this.log.scrollTop = this.log.scrollHeight;
    return element;
  }

  showThinking(show) {
    if (show && !this.thinking) {
      this.thinking = this.addMessage(this.i18n.t("chatThinking"), "thinking");
    } else if (!show && this.thinking) {
      this.thinking.remove();
      this.thinking = null;
    }
  }

  clearInput() {
    this.input.value = "";
    this.#updateSend();
  }

  restoreInput(text) {
    this.input.value = text;
    this.#updateSend();
  }

  focusIfOpen() {
    if (!this.panel.hidden) this.input.focus();
  }

  applyLanguage() {
    const t = (key) => this.i18n.t(key);
    this.panel.lang = this.i18n.language;
    this.panel.setAttribute("aria-label", t("chatRegionLabel"));
    const title = this.panel.querySelector(".chat-header h2");
    if (title) title.textContent = t("chatTitle");
    const label = this.panel.querySelector('label[for="chat-input"]');
    if (label) label.textContent = t("chatInputLabel");
    this.input.setAttribute("placeholder", t("chatPlaceholder"));
    this.sendButton.textContent = t("chatSend");
    this.toggleButton.setAttribute("aria-label", t(this.panel.hidden ? "chatShow" : "chatHide"));
    const thinking = this.thinking;
    if (thinking) thinking.textContent = t("chatThinking");
  }

  #updateSend() {
    this.sendButton.disabled = this.pending || !this.input.value.trim();
  }
}
