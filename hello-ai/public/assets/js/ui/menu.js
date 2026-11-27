import { el } from "./dom.js";

/**
 * Menu screens (main / computer setup / options / rules / results / in-game).
 * Element ids and classes are the ones the existing stylesheet expects.
 */
export class Menu {
  constructor({ gameEl, session, i18n, sound, scores, presenter, getPersona = () => null, setNextPersona = () => {}, onRestart, doc = globalThis.document }) {
    this.gameEl = gameEl;
    this.session = session;
    this.i18n = i18n;
    this.sound = sound;
    this.scores = scores;
    this.getPersona = getPersona;
    this.setNextPersona = setNextPersona;
    this.presenter = presenter;
    this.onRestart = onRestart;
    this.doc = doc;
    this.isOpen = true;

    // Clicking outside an open in-game menu closes it.
    doc.addEventListener(
      "click",
      (event) => {
        if (!this.#isPlaying() || !this.isOpen) return;
        const openMenu = doc.getElementById("menu");
        if (
          !openMenu ||
          openMenu.contains(event.target) ||
          event.target.closest(".menu-hidden") ||
          event.target.closest("#sound-toggle") ||
          event.target.closest("#fullscreen-toggle")
        ) return;
        this.closeMenu();
      },
      true
    );
  }

  #isPlaying() {
    return this.session.status !== "idle";
  }

  #t(key) {
    return this.i18n.t(key);
  }

  #click(handler) {
    return () => {
      this.sound.play("menu");
      handler();
    };
  }

  #closeButton() {
    return el(
      "div",
      { id: "close-menu", onclick: () => this.closeMenu() },
      el("i", { class: "far fa-times-circle" })
    );
  }

  #backToMenu() {
    this.clearMenu();
    this.createMenu();
  }

  createMenu() {
    this.doc.querySelectorAll(".menu-hidden").forEach((button) => button.remove());
    const playing = this.#isPlaying();
    const menu = el("div", { id: "menu", class: playing ? "menu is-playing" : "menu menu-main" });

    if (playing) {
      menu.append(
        this.#closeButton(),
        el("div", { class: "menu-title" }, this.#t("menu")),
        el("button", { class: "menu-item menu-action", id: "rematch-game", type: "button", onclick: this.#click(() => this.#rematch()) }, this.#t("rematchGame")),
        el("button", { class: "menu-item menu-action", id: "options", type: "button", onclick: this.#click(() => this.options()) }, this.#t("options")),
        el("button", { class: "menu-item menu-action", id: "rules", type: "button", onclick: this.#click(() => this.rules()) }, this.#t("rules")),
        el("button", { class: "menu-item menu-action", id: "results", type: "button", onclick: this.#click(() => this.results()) }, this.#t("results")),
        el("button", { class: "menu-item menu-action menu-restart", id: "restart-game", type: "button", onclick: () => this.onRestart() }, this.#t("restartGame"))
      );
    } else {
      menu.append(
        el("div", { class: "menu-title" }, this.#t("playMode")),
        el("button", { class: "menu-item menu-action", id: "vs-computer", type: "button", onclick: this.#click(() => this.setupComputerGame()) }, this.#t("vsComputer")),
        el("button", { class: "menu-item menu-action", id: "vs-local", type: "button", disabled: true }, this.#t("vsLocal")),
        el("button", { class: "menu-item menu-action", id: "vs-online", type: "button", disabled: true }, this.#t("vsOnline")),
        el("div", { class: "menu-divider" }),
        el(
          "div",
          { class: "menu-footer" },
          el("button", { class: "menu-footer-button", id: "options", type: "button", onclick: this.#click(() => this.options()) }, this.#t("options")),
          el("button", { class: "menu-footer-button", id: "rules", type: "button", onclick: this.#click(() => this.rules()) }, this.#t("rules")),
          el("button", { class: "menu-footer-button", id: "results", type: "button", onclick: this.#click(() => this.results()) }, this.#t("results"))
        )
      );
    }
    this.gameEl.appendChild(menu);
  }

  #select(id, value, choices, onChange) {
    const select = el("select", { id });
    choices.forEach(([optionValue, label]) => {
      const option = el("option", { value: optionValue, selected: optionValue === value }, label);
      select.append(option);
    });
    if (onChange) select.addEventListener("change", (event) => onChange(event.target.value));
    return select;
  }

  setupComputerGame() {
    const menu = this.doc.getElementById("menu");
    menu.classList.remove("menu-main");
    menu.classList.add("menu-setup");
    const session = this.session;

    const colorSelect = this.#select(
      "player-color-select",
      session.humanColor,
      [["white", this.#t("white")], ["black", this.#t("black")]]
    );
    const difficultySelect = this.#select(
      "difficulty-select",
      session.difficulty,
      [["easy", this.#t("easy")], ["medium", this.#t("medium")], ["hard", this.#t("hard")]],
      (value) => session.configure({ difficulty: value })
    );
    const rulesetSelect = this.#select(
      "ruleset-select",
      session.ruleset,
      [["international", this.#t("internationalDraughts")], ["british", this.#t("britishDraughts")]],
      (value) => session.configure({ ruleset: value })
    );

    menu.replaceChildren(
      el("div", { class: "menu-title" }, this.#t("computerSettings")),
      el("div", { class: "setup-control", id: "player-color-control" }, el("label", { class: "submenu", for: "player-color-select" }, this.#t("playerColor")), colorSelect),
      el("div", { class: "setup-control", id: "difficulty-control" }, el("label", { class: "submenu", for: "difficulty-select" }, this.#t("difficulty")), difficultySelect),
      el("div", { class: "setup-control", id: "ruleset-control" }, el("label", { class: "submenu", for: "ruleset-select" }, this.#t("ruleset")), rulesetSelect),
      el(
        "button",
        {
          class: "menu-item menu-action start-button",
          id: "start-computer",
          type: "button",
          onclick: this.#click(() => {
            session.configure({ humanColor: colorSelect.value });
            session.start();
            this.isOpen = false;
            this.hiddenMenu();
          })
        },
        this.#t("startGame")
      ),
      el("button", { class: "submenu setup-back", id: "setup-back", type: "button", onclick: this.#click(() => this.#backToMenu()) }, this.#t("back"))
    );
  }

  closeMenu() {
    if (!this.#isPlaying()) return;
    this.sound.play("menu");
    this.hiddenMenu();
    this.isOpen = false;
  }

  /** Collapse the menu into the small cog button. */
  hiddenMenu() {
    if (!this.#isPlaying()) return;
    const smallMenu = el(
      "button",
      {
        type: "button",
        class: "menu-hidden",
        "aria-label": this.#t("menu"),
        title: this.#t("menu"),
        onclick: () => {
          this.sound.play("menu");
          if (!this.isOpen) {
            this.createMenu();
            this.isOpen = true;
          } else {
            this.hiddenMenu();
            this.isOpen = false;
          }
        }
      },
      el("i", { class: "fa fa-cog", "aria-hidden": "true" })
    );
    this.gameEl.appendChild(smallMenu);
    const menu = this.doc.getElementById("menu");
    if (menu) menu.remove();
  }

  options() {
    const menu = this.doc.getElementById("menu");
    menu.classList.add("menu-options");
    const checkbox = el("input", { type: "checkbox", checked: this.presenter.forcedHighlight });
    const languageSelect = this.#select(
      "language-select",
      this.i18n.language,
      [["en", "English"], ["fr", "Français"]],
      (value) => {
        this.i18n.setLanguage(value);
        this.options();
      }
    );
    menu.replaceChildren(
      this.#closeButton(),
      el("div", { class: "menu-title" }, this.#t("options")),
      el(
        "div",
        { class: "submenu", id: "highlight" },
        el("span", {}, this.#t("forcedHighlight")),
        el(
          "label",
          {
            class: "switch",
            id: "highlight-switch",
            onchange: () => {
              this.presenter.setForcedHighlight(checkbox.checked);
              this.sound.play("menu");
            }
          },
          checkbox,
          el("span", { class: "slider round" })
        )
      ),
      el("div", { id: "language-control" }, el("label", { class: "submenu", for: "language-select" }, this.#t("language")), languageSelect),
      el("button", { class: "submenu setup-back", id: "back", type: "button", onclick: this.#click(() => this.#backToMenu()) }, this.#t("back"))
    );
  }

  #rematch() {
    this.setNextPersona(this.getPersona());
    this.gameEl.querySelector("#game-over")?.remove();
    this.doc.querySelectorAll(".menu-hidden").forEach((button) => button.remove());
    this.clearMenu();
    this.session.start();
    this.isOpen = false;
    this.hiddenMenu();
  }

  rules() {
    const menu = this.doc.getElementById("menu");
    menu.classList.add("menu-rules");
    const kingText = this.session.ruleset === "international" ? "internationalKingText" : "britishKingText";
    menu.replaceChildren(
      this.#closeButton(),
      el("div", { class: "menu-item new-page", id: "options" }, this.#t("rules")),
      el("p", { class: "text-g" }, this.#t("simpleMove")),
      el("p", {}, this.#t("simpleMoveText")),
      el("p", { class: "text-g" }, this.#t("jump")),
      el("p", {}, this.#t("jumpText")),
      el("p", { class: "text-g" }, this.#t("king")),
      el("p", {}, this.#t(kingText)),
      el("p", { class: "text-g" }, this.#t("endOfGame")),
      el("p", {}, this.#t("endOfGameText")),
      el(
        "div",
        { class: "submenu", id: "rules-back", onclick: this.#click(() => this.#backToMenu()) },
        el("i", { class: "fa fa-backward", "aria-hidden": "true" })
      )
    );
  }

  results() {
    const menu = this.doc.getElementById("menu");
    menu.classList.add("menu");
    const activePersona = this.#isPlaying() ? this.getPersona() : null;
    const personaScore = activePersona
      ? this.scores.getByPersona()[activePersona.firstName] || { player: 0, computer: 0 }
      : null;
    const score = this.scores.get();
    const playerLine = el("p", { class: "submenu results-menu", id: "player-score" }, `${this.#t("player")}  ${personaScore ? Number(personaScore.player) || 0 : score.player}`);
    const computerLine = el("p", { class: "submenu results-menu", id: "computer-score" }, `${this.#t("computer")}  ${personaScore ? Number(personaScore.computer) || 0 : score.computer}`);
    menu.replaceChildren(
      this.#closeButton(),
      el("div", { class: "menu-item new-page", id: "results" }, activePersona ? `${this.#t("results")} — ${activePersona.firstName}` : this.#t("results")),
      playerLine,
      computerLine,
      el(
        "div",
        {
          class: "submenu results-menu",
          id: "reset-score",
          onclick: this.#click(() => {
            this.scores.reset();
            playerLine.textContent = `${this.#t("player")} 0`;
            computerLine.textContent = `${this.#t("computer")} 0`;
          })
        },
        this.#t("resetScore")
      ),
      el(
        "div",
        { class: "submenu results-menu", id: "rules-back", onclick: this.#click(() => this.#backToMenu()) },
        el("i", { class: "fa fa-backward", "aria-hidden": "true" })
      )
    );
  }

  clearMenu() {
    const menu = this.doc.getElementById("menu");
    if (menu) menu.remove();
  }
}
