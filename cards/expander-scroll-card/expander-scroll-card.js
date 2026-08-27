/*
 * Expander Scroll Card
 *
 * Derived from lovelace-expander-card by Peter Repukat / FlatspotSoftware.
 * Upstream: https://github.com/Alia5/lovelace-expander-card
 * Licensed under the Apache License, Version 2.0.
 *
 * Modifications add a bounded collapsed viewport, optional collapsed-state
 * scrolling, a dependency-free runtime, and updated Home Assistant editor
 * integration.
 */

const CARD_TAG = "expander-scroll-card";
const EDITOR_TAG = "expander-scroll-card-editor";
const VERSION = "1.0.0";

const DEFAULT_CONFIG = Object.freeze({
  title: "Expander",
  clear: false,
  "clear-children": false,
  expanded: false,
  "button-background": "transparent",
  gap: "0.6em",
  padding: "1em",
  "child-padding": "0.5em",
  "title-card-padding": "0px",
  "title-card-button-overlay": false,
  "overlay-margin": "2em",
  "collapsed-min-height": "0px",
  "collapsed-scroll": false,
  "transition-duration": "0.5s",
  "card-width": "100%",
  "max-width": "none",
});

function cloneConfig(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function cssLength(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) return `${Math.max(0, value)}px`;
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function parseBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeConfig(config) {
  const collapsedMinHeight =
    config["collapsed-min-height"] ?? config.collapsed_min_height ?? config["collapsed-height"];
  const collapsedScroll = config["collapsed-scroll"] ?? config.collapsed_scroll;
  const cardWidth = config["card-width"] ?? config.card_width ?? config.width;
  const maxWidth = config["max-width"] ?? config.max_width;

  return {
    ...DEFAULT_CONFIG,
    ...config,
    clear: parseBoolean(config.clear, false),
    "clear-children": parseBoolean(config["clear-children"], false),
    expanded: parseBoolean(config.expanded, false),
    "title-card-button-overlay": parseBoolean(config["title-card-button-overlay"], false),
    "collapsed-scroll": parseBoolean(collapsedScroll, false),
    "collapsed-min-height": cssLength(collapsedMinHeight, DEFAULT_CONFIG["collapsed-min-height"]),
    "transition-duration": cssLength(config["transition-duration"], DEFAULT_CONFIG["transition-duration"]),
    "card-width": cssLength(cardWidth, DEFAULT_CONFIG["card-width"]),
    "max-width": cssLength(maxWidth, DEFAULT_CONFIG["max-width"]),
    gap: cssLength(config.gap, DEFAULT_CONFIG.gap),
    padding: cssLength(config.padding, DEFAULT_CONFIG.padding),
    "child-padding": cssLength(config["child-padding"], DEFAULT_CONFIG["child-padding"]),
    "title-card-padding": cssLength(config["title-card-padding"], DEFAULT_CONFIG["title-card-padding"]),
    "overlay-margin": cssLength(config["overlay-margin"], DEFAULT_CONFIG["overlay-margin"]),
    cards: Array.isArray(config.cards) ? config.cards : [],
  };
}

class ExpanderScrollCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig({});
    this._hass = null;
    this._expanded = false;
    this._storageKey = null;
    this._buildGeneration = 0;
    this._childCards = [];
    this._titleCard = null;
    this._resizeObserver = null;
    this._transitionTimer = null;
  }

  static getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig() {
    return {
      title: "Expander",
      "collapsed-min-height": "0px",
      "collapsed-scroll": false,
      cards: [{ type: "entities", entities: [] }],
    };
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Expander Scroll Card requires a configuration object.");
    const previousStorageKey = this._storageKey;
    this._config = normalizeConfig(cloneConfig(config));
    this._storageKey = this._config["expand-id"]
      ? `expander-scroll-${this._config["expand-id"]}`
      : null;

    if (!this.shadowRoot.querySelector("ha-card") || previousStorageKey !== this._storageKey) {
      this._expanded = this._readExpandedState();
    }

    this._renderShell();
    this._buildNestedCards();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._titleCard) this._titleCard.hass = hass;
    this._childCards.forEach((card) => {
      card.hass = hass;
    });
  }

  connectedCallback() {
    if (!this.shadowRoot.querySelector("ha-card")) {
      this._expanded = this._readExpandedState();
      this._renderShell();
      this._buildNestedCards();
    }
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
    clearTimeout(this._transitionTimer);
  }

  getCardSize() {
    if (!this._expanded) {
      const pixels = Number.parseFloat(this._config["collapsed-min-height"]);
      return Math.max(1, Math.ceil((Number.isFinite(pixels) ? pixels : 0) / 50) + 1);
    }
    return Math.max(2, this._config.cards.length * 2 + 1);
  }

  getGridOptions() {
    return { columns: 12, rows: "auto", min_columns: 2, min_rows: 1 };
  }

  _readExpandedState() {
    if (this._storageKey) {
      try {
        const stored = localStorage.getItem(this._storageKey);
        if (stored !== null) return stored === "true";
      } catch (error) {
        console.warn("Expander Scroll Card could not read LocalStorage", error);
      }
    }
    return this._config.expanded === true;
  }

  _writeExpandedState() {
    if (!this._storageKey) return;
    try {
      localStorage.setItem(this._storageKey, String(this._expanded));
    } catch (error) {
      console.warn("Expander Scroll Card could not write LocalStorage", error);
    }
  }

  _renderShell() {
    const config = this._config;
    const hasTitleCard = Boolean(config["title-card"]);
    const overlay = hasTitleCard && config["title-card-button-overlay"];
    const titleMarkup = hasTitleCard
      ? `<div class="title-card-container" id="title-card-container" style="--title-padding:${escapeHtml(
          config["title-card-padding"],
        )}"><div class="loading-title">Loading title card…</div></div>`
      : `<span class="title">${escapeHtml(config.title)}</span>`;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: var(--expander-card-width, 100%);
          max-width: min(100%, var(--expander-max-width, none));
          margin-inline: auto;
          container-type: inline-size;
        }
        * { box-sizing: border-box; }
        ha-card {
          position: relative;
          display: block;
          width: 100%;
          padding: var(--expander-padding);
          overflow: visible;
          transition: background var(--expander-duration) ease, border-color var(--expander-duration) ease;
        }
        ha-card.clear { background: transparent; border-style: none; box-shadow: none; }
        .header-row {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }
        .header-row.title-card-mode { justify-content: space-between; }
        .title-card-container { width: 100%; min-width: 0; padding: var(--title-padding); }
        .loading-title { padding: 0.65em; color: var(--secondary-text-color); font-size: 12px; }
        button.toggle {
          display: flex;
          align-items: center;
          gap: 0.7em;
          width: 100%;
          min-height: 42px;
          margin: 2px;
          padding: 0.8em;
          border: 0;
          border-radius: 1em;
          outline: none;
          color: var(--primary-text-color);
          background: var(--expander-button-background);
          font: inherit;
          cursor: pointer;
          transition: background 180ms ease, box-shadow 180ms ease;
        }
        button.toggle:hover { background: color-mix(in srgb, var(--primary-text-color) 7%, var(--expander-button-background)); }
        button.toggle:focus-visible { box-shadow: inset 0 0 0 2px var(--primary-color); }
        button.toggle.overlay {
          position: absolute;
          z-index: 3;
          top: var(--overlay-margin);
          right: var(--overlay-margin);
          width: 42px;
          min-height: 42px;
          justify-content: center;
          padding: 0;
        }
        .title-card-mode button.toggle {
          flex: 0 0 42px;
          width: 42px;
          min-height: 42px;
          justify-content: center;
          padding: 0;
        }
        .title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
        .chevron { --mdc-icon-size: 24px; flex: 0 0 auto; transition: transform 350ms ease; }
        .chevron.flipped { transform: rotate(180deg); }
        .viewport {
          display: grid;
          min-height: 0;
          transition: grid-template-rows var(--expander-duration) ease-in-out;
        }
        .viewport.expanded { grid-template-rows: 1fr; }
        .viewport.collapsed { grid-template-rows: 0fr; }
        .viewport-inner {
          min-width: 0;
          min-height: 0;
          overscroll-behavior: contain;
          scrollbar-gutter: stable;
        }
        .viewport.expanded .viewport-inner { overflow: visible; }
        .viewport.collapsed .viewport-inner {
          height: var(--collapsed-min-height);
          min-height: var(--collapsed-min-height);
          overflow: hidden;
        }
        .viewport.collapsed.scrollable .viewport-inner {
          overflow-x: hidden;
          overflow-y: auto;
          touch-action: pan-y;
        }
        .viewport.collapsed.scrollable .viewport-inner:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: -2px;
          border-radius: var(--ha-card-border-radius, 12px);
        }
        .children-container {
          display: grid;
          gap: var(--expander-gap);
          min-width: 0;
          padding: var(--child-padding);
        }
        .children-container > :first-child { margin-top: var(--expander-gap); }
        .child-error {
          padding: 12px;
          border: 1px solid color-mix(in srgb, var(--error-color) 35%, transparent);
          border-radius: 10px;
          color: var(--error-color);
          font-size: 13px;
        }
        .collapsed-hint {
          position: absolute;
          right: calc(var(--expander-padding) + 5px);
          bottom: calc(var(--expander-padding) + 4px);
          z-index: 2;
          display: none;
          align-items: center;
          gap: 3px;
          padding: 3px 6px;
          border-radius: 999px;
          color: var(--secondary-text-color);
          background: color-mix(in srgb, var(--card-background-color) 86%, transparent);
          font-size: 10px;
          pointer-events: none;
        }
        .collapsed-hint ha-icon { --mdc-icon-size: 12px; }
        ha-card.is-collapsed.can-scroll .collapsed-hint { display: inline-flex; }
        @container (max-width: 360px) {
          ha-card { padding: min(var(--expander-padding), 10px); }
          button.toggle { padding-inline: 0.65em; }
        }
        @media (prefers-reduced-motion: reduce) {
          ha-card, .viewport, .chevron { transition: none !important; }
        }
      </style>
      <ha-card class="${config.clear ? "clear" : ""}">
        <div class="header-row ${hasTitleCard ? "title-card-mode" : ""}">
          ${hasTitleCard ? titleMarkup : ""}
          <button class="toggle ${overlay ? "overlay" : ""}" type="button" aria-controls="expander-viewport">
            ${hasTitleCard ? "" : titleMarkup}
            <ha-icon class="chevron" icon="mdi:chevron-down"></ha-icon>
          </button>
        </div>
        <div id="expander-viewport" class="viewport">
          <div class="viewport-inner" tabindex="-1" aria-label="Collapsed card content">
            <div class="children-container" id="children-container"></div>
          </div>
        </div>
        <span class="collapsed-hint"><ha-icon icon="mdi:mouse-move-down"></ha-icon>Scroll</span>
      </ha-card>`;

    this.style.setProperty("--expander-card-width", config["card-width"]);
    this.style.setProperty("--expander-max-width", config["max-width"]);
    this.style.setProperty("--expander-padding", config.padding);
    this.style.setProperty("--expander-gap", config.gap);
    this.style.setProperty("--child-padding", config["child-padding"]);
    this.style.setProperty("--collapsed-min-height", config["collapsed-min-height"]);
    this.style.setProperty("--expander-duration", config["transition-duration"]);
    this.style.setProperty("--expander-button-background", config["button-background"] || "transparent");
    this.style.setProperty("--overlay-margin", config["overlay-margin"]);

    this.shadowRoot.querySelector("button.toggle").addEventListener("click", () => this._toggle());
    this._applyExpandedState(false);
  }

  async _buildNestedCards() {
    const generation = ++this._buildGeneration;
    const childrenContainer = this.shadowRoot.querySelector("#children-container");
    if (!childrenContainer) return;
    this._childCards = [];
    this._titleCard = null;

    let helpers;
    try {
      if (typeof window.loadCardHelpers !== "function") throw new Error("Home Assistant card helpers are unavailable");
      helpers = await window.loadCardHelpers();
    } catch (error) {
      if (generation === this._buildGeneration) {
        childrenContainer.innerHTML = `<div class="child-error">${escapeHtml(error.message || error)}</div>`;
      }
      return;
    }
    if (generation !== this._buildGeneration) return;

    if (this._config["title-card"]) {
      const titleContainer = this.shadowRoot.querySelector("#title-card-container");
      if (titleContainer) {
        try {
          const titleCard = helpers.createCardElement(this._config["title-card"]);
          titleCard.hass = this._hass;
          titleContainer.replaceChildren(titleCard);
          this._titleCard = titleCard;
          this._applyClearStyle(titleCard);
        } catch (error) {
          titleContainer.innerHTML = `<div class="child-error">Title card: ${escapeHtml(error.message || error)}</div>`;
        }
      }
    }

    for (const cardConfig of this._config.cards) {
      try {
        const card = helpers.createCardElement(cardConfig);
        card.hass = this._hass;
        childrenContainer.append(card);
        this._childCards.push(card);
        this._applyClearStyle(card);
      } catch (error) {
        const message = document.createElement("div");
        message.className = "child-error";
        message.textContent = `Child card: ${error.message || error}`;
        childrenContainer.append(message);
      }
    }

    this._resizeObserver?.disconnect();
    this._resizeObserver = new ResizeObserver(() => this._updateScrollableHint());
    this._resizeObserver.observe(childrenContainer);
    requestAnimationFrame(() => this._updateScrollableHint());
  }

  _applyClearStyle(card) {
    if (!this._config["clear-children"]) return;
    const install = () => {
      if (!card.shadowRoot || card.shadowRoot.querySelector("style[data-expander-scroll-clear]")) return;
      const style = document.createElement("style");
      style.dataset.expanderScrollClear = "";
      style.textContent = "ha-card{background:transparent!important;border-style:none!important;box-shadow:none!important}";
      card.shadowRoot.append(style);
    };
    install();
    requestAnimationFrame(install);
  }

  _toggle() {
    this._expanded = !this._expanded;
    this._writeExpandedState();
    this._applyExpandedState(true);
  }

  _applyExpandedState(announce) {
    const card = this.shadowRoot.querySelector("ha-card");
    const viewport = this.shadowRoot.querySelector(".viewport");
    const viewportInner = this.shadowRoot.querySelector(".viewport-inner");
    const button = this.shadowRoot.querySelector("button.toggle");
    const chevron = this.shadowRoot.querySelector(".chevron");
    if (!card || !viewport || !button || !chevron) return;

    const scrollable = this._config["collapsed-scroll"] === true;
    card.classList.toggle("is-collapsed", !this._expanded);
    viewport.classList.toggle("expanded", this._expanded);
    viewport.classList.toggle("collapsed", !this._expanded);
    viewport.classList.toggle("scrollable", !this._expanded && scrollable);
    chevron.classList.toggle("flipped", this._expanded);
    button.setAttribute("aria-expanded", String(this._expanded));
    viewportInner.tabIndex = !this._expanded && scrollable ? 0 : -1;
    this._updateScrollableHint();

    clearTimeout(this._transitionTimer);
    this._transitionTimer = setTimeout(() => {
      this.dispatchEvent(new Event("ll-rebuild", { bubbles: true, composed: true }));
    }, announce ? 520 : 0);
  }

  _updateScrollableHint() {
    const card = this.shadowRoot.querySelector("ha-card");
    const inner = this.shadowRoot.querySelector(".viewport-inner");
    if (!card || !inner) return;
    const canScroll =
      !this._expanded && this._config["collapsed-scroll"] && inner.scrollHeight > inner.clientHeight + 2;
    card.classList.toggle("can-scroll", canScroll);
  }
}

class ExpanderScrollCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._lovelace = null;
    this._tab = "settings";
    this.shadowRoot.addEventListener("input", (event) => this._handleField(event));
    this.shadowRoot.addEventListener("change", (event) => this._handleField(event));
    this.shadowRoot.addEventListener("click", (event) => this._handleAction(event));
  }

  set hass(hass) {
    this._hass = hass;
    this._mountNestedEditors();
  }

  set lovelace(lovelace) {
    this._lovelace = lovelace;
    this._mountNestedEditors();
  }

  setConfig(config) {
    const active = Boolean(this.shadowRoot.activeElement);
    this._config = cloneConfig(config || ExpanderScrollCard.getStubConfig());
    if (!Array.isArray(this._config.cards)) this._config.cards = [];
    if (!active) this._render();
  }

  _emit() {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: cloneConfig(this._config) },
        bubbles: true,
        composed: true,
      }),
    );
  }

  _handleField(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (!target.dataset.field) return;
    if (event.type === "input" && (target.type === "checkbox" || target.tagName === "SELECT")) return;
    if (event.type === "change" && target.type !== "checkbox" && target.tagName !== "SELECT") return;
    const value = target.type === "checkbox" ? target.checked : target.value;
    if (value === "" && !["title", "expand-id"].includes(target.dataset.field)) delete this._config[target.dataset.field];
    else this._config[target.dataset.field] = value;
    this._emit();
  }

  _handleAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const index = Number(button.dataset.index);
    if (action === "tab-settings" || action === "tab-cards") {
      this._tab = action === "tab-settings" ? "settings" : "cards";
      this._render();
      return;
    }
    if (action === "add-card") this._config.cards.push({ type: "entities", entities: [] });
    if (action === "remove-card") this._config.cards.splice(index, 1);
    if (action === "move-up" && index > 0) {
      [this._config.cards[index - 1], this._config.cards[index]] = [this._config.cards[index], this._config.cards[index - 1]];
    }
    if (action === "move-down" && index < this._config.cards.length - 1) {
      [this._config.cards[index + 1], this._config.cards[index]] = [this._config.cards[index], this._config.cards[index + 1]];
    }
    if (action === "add-title-card") this._config["title-card"] = { type: "markdown", content: "### Expander" };
    if (action === "remove-title-card") delete this._config["title-card"];
    this._emit();
    this._render();
  }

  _render() {
    const config = normalizeConfig(this._config);
    const checkbox = (field, label) => `<label class="check"><input type="checkbox" data-field="${field}" ${
      config[field] ? "checked" : ""
    }><span>${label}</span></label>`;
    const text = (field, label, helper = "") => `<label><span>${label}</span><input data-field="${field}" value="${escapeHtml(
      this._config[field] ?? config[field] ?? "",
    )}">${helper ? `<small>${helper}</small>` : ""}</label>`;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; color: var(--primary-text-color); font-family: Roboto, sans-serif; }
        * { box-sizing: border-box; }
        .tabs { display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 14px; border-bottom: 1px solid var(--divider-color); }
        .tabs button { padding: 11px; border: 0; color: var(--secondary-text-color); background: transparent; font: inherit; cursor: pointer; }
        .tabs button.active { color: var(--primary-color); border-bottom: 2px solid var(--primary-color); font-weight: 700; }
        .note { margin: 0 0 14px; padding: 11px; border-radius: 9px; color: var(--secondary-text-color); background: color-mix(in srgb, var(--primary-color) 7%, transparent); font-size: 12px; line-height: 1.45; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        label { display: grid; gap: 5px; color: var(--secondary-text-color); font-size: 12px; font-weight: 500; }
        label.wide { grid-column: 1 / -1; }
        label.check { display: flex; align-items: center; gap: 8px; min-height: 38px; color: var(--primary-text-color); font-size: 14px; font-weight: 400; }
        input:not([type="checkbox"]) { width: 100%; min-height: 42px; padding: 8px 10px; border: 1px solid var(--divider-color); border-radius: 8px; outline: none; color: var(--primary-text-color); background: var(--card-background-color); font: inherit; font-size: 14px; }
        input:focus { border-color: var(--primary-color); }
        input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--primary-color); }
        small { color: var(--secondary-text-color); font-size: 11px; font-weight: 400; line-height: 1.3; }
        h3 { margin: 18px 0 9px; font-size: 15px; }
        .nested { margin-bottom: 12px; padding: 12px; border: 1px solid var(--divider-color); border-radius: 11px; }
        .nested-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 9px; font-size: 13px; font-weight: 700; }
        .buttons { display: flex; gap: 4px; }
        button.icon, button.primary { display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 8px; cursor: pointer; }
        button.icon { width: 32px; height: 32px; color: var(--secondary-text-color); background: transparent; }
        button.icon:disabled { opacity: .3; cursor: default; }
        button.icon ha-icon { --mdc-icon-size: 18px; }
        button.primary { min-height: 38px; padding: 0 13px; color: white; background: var(--primary-color); font: inherit; font-weight: 700; }
        .add-row { display: flex; justify-content: flex-end; margin-top: 10px; }
        .empty { padding: 22px; color: var(--secondary-text-color); text-align: center; }
        @media (max-width: 440px) { .grid { grid-template-columns: 1fr; } label.wide { grid-column: auto; } }
      </style>
      <div class="tabs">
        <button data-action="tab-settings" class="${this._tab === "settings" ? "active" : ""}">Settings</button>
        <button data-action="tab-cards" class="${this._tab === "cards" ? "active" : ""}">Cards</button>
      </div>
      ${
        this._tab === "settings"
          ? `<p class="note"><strong>Collapsed preview:</strong> set a non-zero minimum height to leave part of the child area visible. Enable scrolling to make that collapsed preview independently scrollable.</p>
             <div class="grid">
               <div class="wide">${text("title", "Title")}</div>
               ${text("collapsed-min-height", "Collapsed minimum height", "Examples: 0px, 120px, 30vh")}
               ${text("transition-duration", "Animation duration", "Example: 0.5s")}
               ${checkbox("collapsed-scroll", "Scroll content while collapsed")}
               ${checkbox("expanded", "Start expanded")}
               ${checkbox("clear", "Remove card background")}
               ${checkbox("clear-children", "Remove child backgrounds")}
               ${text("expand-id", "Saved-state ID", "Persists expanded/collapsed state locally")}
               ${text("button-background", "Button background")}
               ${text("gap", "Gap between cards")}
               ${text("padding", "Card padding")}
               ${text("child-padding", "Child area padding")}
               ${text("title-card-padding", "Title card padding")}
               ${checkbox("title-card-button-overlay", "Overlay toggle on title card")}
               ${text("overlay-margin", "Overlay toggle margin")}
               ${text("card-width", "Card width")}
               ${text("max-width", "Maximum width")}
             </div>`
          : `<h3>Title card</h3>
             ${
               this._config["title-card"]
                 ? `<div class="nested"><div class="nested-head"><span>Custom title card</span><button class="icon" data-action="remove-title-card"><ha-icon icon="mdi:delete-outline"></ha-icon></button></div><div id="title-card-editor"></div></div>`
                 : `<div class="add-row"><button class="primary" data-action="add-title-card">Add title card</button></div>`
             }
             <h3>Child cards</h3>
             ${
               this._config.cards.length
                 ? this._config.cards
                     .map(
                       (card, index) => `<div class="nested"><div class="nested-head"><span>Card ${index + 1}: ${escapeHtml(
                         card.type || "unknown",
                       )}</span><div class="buttons"><button class="icon" data-action="move-up" data-index="${index}" ${
                         index === 0 ? "disabled" : ""
                       }><ha-icon icon="mdi:arrow-up"></ha-icon></button><button class="icon" data-action="move-down" data-index="${index}" ${
                         index === this._config.cards.length - 1 ? "disabled" : ""
                       }><ha-icon icon="mdi:arrow-down"></ha-icon></button><button class="icon" data-action="remove-card" data-index="${index}"><ha-icon icon="mdi:delete-outline"></ha-icon></button></div></div><div class="card-editor" data-index="${index}"></div></div>`,
                     )
                     .join("")
                 : `<div class="empty">No child cards configured.</div>`
             }
             <div class="add-row"><button class="primary" data-action="add-card">Add card</button></div>`
      }`;

    this._mountNestedEditors();
  }

  _mountNestedEditors() {
    if (this._tab !== "cards" || !this.shadowRoot.querySelector(".card-editor, #title-card-editor")) return;
    const mount = (container, value, onChange) => {
      if (!container || container.childElementCount) return;
      const editor = document.createElement("hui-card-element-editor");
      editor.hass = this._hass;
      editor.lovelace = this._lovelace;
      editor.value = value;
      editor.addEventListener("config-changed", (event) => {
        event.stopPropagation();
        onChange(event.detail.config);
        this._emit();
      });
      container.append(editor);
    };
    if (this._config["title-card"]) {
      mount(this.shadowRoot.querySelector("#title-card-editor"), this._config["title-card"], (value) => {
        this._config["title-card"] = value;
      });
    }
    this.shadowRoot.querySelectorAll(".card-editor").forEach((container) => {
      const index = Number(container.dataset.index);
      mount(container, this._config.cards[index], (value) => {
        this._config.cards[index] = value;
      });
    });
  }
}

if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, ExpanderScrollCardEditor);
if (!customElements.get(CARD_TAG)) customElements.define(CARD_TAG, ExpanderScrollCard);

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: "Expander Scroll Card",
    description: "Collapsible child-card container with a configurable, scrollable collapsed preview.",
    preview: true,
  });
}

console.info(
  `%c EXPANDER-SCROLL-CARD %c ${VERSION} `,
  "color:white;background:#455a64;font-weight:700",
  "color:#455a64;background:white",
);
