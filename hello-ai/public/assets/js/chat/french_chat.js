import SmartFrenchCheckersBot from "./french_checkers_chat.js";

export function createSmartFrenchCheckersConversation(options) {
  const bot = new SmartFrenchCheckersBot(options);
  return {
    name: bot.name,
    start: () => bot.triggerEvent("start", true),
    sendMessage: message => bot.receivePlayerMessage(message),
    updateBoardState: (botScore, playerScore) =>
      bot.updateBoardState(botScore, playerScore),
    setLanguage: language => bot.setLanguage(language),
    triggerEvent: (eventName, force) => bot.triggerEvent(eventName, force)
  };
}

export class FrenchChat {
  constructor({
    toggleButton,
    panel,
    log,
    personaLabel,
    form,
    input,
    sendButton,
    conversationFactory = createSmartFrenchCheckersConversation
  }) {
    if (typeof conversationFactory !== "function") {
      throw new TypeError("conversationFactory must be a function");
    }

    this.toggleButton = toggleButton;
    this.panel = panel;
    this.log = log;
    this.personaLabel = personaLabel;
    this.form = form;
    this.input = input;
    this.sendButton = sendButton;
    this.conversationFactory = conversationFactory;
    this.playerCaptures = 0;
    this.computerCaptures = 0;
    this.active = false;
    this.pending = false;
    this.conversationGeneration = 0;
    this.thinkingMessage = null;
    this.compactScreen = window.matchMedia(
      "(max-width: 900px), (max-height: 720px)"
    );

    this.toggleButton.addEventListener("click", () => this.toggle());
    this.form.addEventListener("submit", event => {
      event.preventDefault();
      this.send();
    });
    this.input.addEventListener("input", () => this.updateSendButton());
    document.addEventListener("checkers:move", event => this.recordMove(event.detail));
    document.addEventListener("checkers:gameover", event => {
      const playerColor = window.checkersBoard.playerColor.slice(6);
      const eventName =
        event.detail.winner === playerColor ? "botLose" : "botWin";
      if (this.conversation && typeof this.conversation.triggerEvent === "function") {
        this.conversation.triggerEvent(eventName, true);
      }
    });
    this.compactScreen.addEventListener("change", () => {
      if (this.active) this.setOpen(!this.compactScreen.matches);
    });
    this.updateSendButton();
  }

  start() {
    this.active = true;
    document.getElementById("center").classList.add("chat-active");
    this.conversationGeneration++;
    const generation = this.conversationGeneration;
    if (this.conversation && typeof this.conversation.stop === "function") {
      this.conversation.stop();
    }

    this.pending = true;
    this.updateSendButton();
    this.playerCaptures = 0;
    this.computerCaptures = 0;
    this.log.replaceChildren();
    this.toggleButton.hidden = false;
    this.setOpen(!this.compactScreen.matches);
    this.thinkingMessage = null;
    this.conversation = this.conversationFactory({
      name: "Lucas",
      language: window.checkersBoard ? window.checkersBoard.language : "fr",
      onTypingChange: typing => this.handleTypingChange(typing, generation),
      onMessage: message => this.handleMessage(message, generation),
      llm: { endpoint: window.llm_url } ,
    });

    if (
      !this.conversation ||
      typeof this.conversation.start !== "function" ||
      typeof this.conversation.sendMessage !== "function"
    ) {
      throw new TypeError(
        "A conversation must implement start() and sendMessage(message)"
      );
    }

    this.personaLabel.textContent = this.conversation.name || "Adversaire";
    this.conversation.start();
  }

  toggle() {
    if (!this.active) return;
    this.setOpen(this.panel.hidden);
  }

  setLanguage(language) {
    if (this.conversation && typeof this.conversation.setLanguage === "function") {
      this.conversation.setLanguage(language);
    }
  }

  setOpen(open) {
    this.panel.hidden = !open;
    this.toggleButton.setAttribute("aria-expanded", String(open));
    this.toggleButton.setAttribute(
      "aria-label",
      open ? "Masquer la conversation" : "Afficher la conversation"
    );
    if (open && !this.pending) this.input.focus();
  }

  recordMove(move) {
    if (!this.active) return;
    const playerColor = window.checkersBoard.playerColor.slice(6);
    if (move.mover === playerColor) {
      this.playerCaptures += move.captures.length;
    } else {
      this.computerCaptures += move.captures.length;
    }

    if (
      this.conversation &&
      typeof this.conversation.updateBoardState === "function"
    ) {
      this.conversation.updateBoardState(
        this.computerCaptures,
        this.playerCaptures
      );
    }
  }

  send() {
    const message = this.input.value.trim();
    if (!message || this.pending) return;
    const playerMessage = this.appendMessage(message, "player");
    this.input.value = "";
    this.pending = true;
    this.updateSendButton();
    try {
      this.conversation.sendMessage(message);
    } catch (error) {
      this.pending = false;
      this.input.value = message;
      playerMessage.remove();
      this.updateSendButton();
      throw error;
    }
  }

  handleTypingChange(typing, generation) {
    if (!this.active || generation !== this.conversationGeneration) return;
    if (typing) {
      if (!this.thinkingMessage) {
        this.thinkingMessage = this.appendMessage("Je réfléchis…", "thinking");
      }
    } else if (this.thinkingMessage) {
      this.thinkingMessage.remove();
      this.thinkingMessage = null;
    }
  }

  handleMessage(message, generation) {
    if (!this.active || generation !== this.conversationGeneration) return;
    if (this.thinkingMessage) {
      this.thinkingMessage.remove();
      this.thinkingMessage = null;
    }
    const text = typeof message === "string" ? message : message.text;
    if (typeof text !== "string") {
      throw new TypeError("Conversation messages must contain text");
    }
    this.appendMessage(text, "computer");
    this.pending = false;
    this.updateSendButton();
    if (!this.panel.hidden) this.input.focus();
  }

  updateSendButton() {
    this.sendButton.disabled = this.pending || !this.input.value.trim();
  }

  appendMessage(message, author) {
    const element = document.createElement("div");
    element.className = `chat-message chat-message-${author}`;
    if (author === "thinking") element.classList.add("chat-thinking");
    element.textContent = message;
    this.log.appendChild(element);
    this.log.scrollTop = this.log.scrollHeight;
    return element;
  }
}
