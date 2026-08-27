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
const VERSION = "1.2.2";

const DEFAULT_CONFIG = Object.freeze({
  title: "Expander",
  icon: "mdi:chevron-down",
  "icon-rotate-degree": "180deg",
  clear: false,
  "clear-children": false,
  expanded: false,
  "button-background": "transparent",
  gap: "0.6em",
  padding: "1em",
  "top-padding": "0px",
  "child-padding": "0.5em",
  "title-card-padding": "0px",
  "title-card-button-overlay": false,
  "overlay-margin": "2em",
  "collapsed-min-height": "0px",
  "collapsed-scroll": false,
  "transition-duration": "0.5s",
  "card-width": "100%",
  "max-width": "100%",
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
  const hasSpecifiedIcon = typeof config.icon === "string" && Boolean(config.icon.trim());
  const collapsedMinHeight =
    config["collapsed-min-height"] ?? config.collapsed_min_height ?? config["collapsed-height"];
  const collapsedScroll = config["collapsed-scroll"] ?? config.collapsed_scroll;
  const cardWidth = config["card-width"] ?? config.card_width ?? config.width;
  const maxWidth = config["max-width"] ?? config.max_width;
  const topPadding = config["top-padding"] ?? config.top_padding ?? config["header-top-padding"];

  return {
    ...DEFAULT_CONFIG,
    ...config,
    icon:
      hasSpecifiedIcon
        ? config.icon.trim()
        : DEFAULT_CONFIG.icon,
    "uses-default-icon": !hasSpecifiedIcon,
    "icon-rotate-degree":
      typeof config["icon-rotate-degree"] === "string" && config["icon-rotate-degree"].trim()
        ? config["icon-rotate-degree"].trim()
        : DEFAULT_CONFIG["icon-rotate-degree"],
    clear: parseBoolean(config.clear, false),
    "clear-children": parseBoolean(config["clear-children"], false),
    expanded: parseBoolean(config.expanded, false),
    "title-card-button-overlay": parseBoolean(config["title-card-button-overlay"], false),
    "collapsed-scroll": parseBoolean(collapsedScroll, false),
    "collapsed-min-height": cssLength(collapsedMinHeight, DEFAULT_CONFIG["collapsed-min-height"]),
    "transition-duration": cssLength(config["transition-duration"], DEFAULT_CONFIG["transition-duration"]),
    "card-width": cssLength(cardWidth, DEFAULT_CONFIG["card-width"]),
    "max-width":
      typeof maxWidth === "string" && maxWidth.trim().toLowerCase() === "none"
        ? DEFAULT_CONFIG["max-width"]
        : cssLength(maxWidth, DEFAULT_CONFIG["max-width"]),
    gap: cssLength(config.gap, DEFAULT_CONFIG.gap),
    padding: cssLength(config.padding, DEFAULT_CONFIG.padding),
    "top-padding": cssLength(topPadding, DEFAULT_CONFIG["top-padding"]),
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
    this._lastObservedWidth = null;
    this._resizeFrame = null;
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
    cancelAnimationFrame(this._resizeFrame);
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
          width: min(100%, var(--expander-card-width, 100%));
          max-width: min(100%, var(--expander-max-width, 100%));
          margin-inline: auto;
          container-type: inline-size;
        }
        * { box-sizing: border-box; }
        ha-card {
          position: relative;
          display: block;
          width: 100%;
          padding: var(--expander-padding);
          padding-top: var(--expander-top-padding);
          overflow: visible;
          transition: background var(--expander-duration) ease, border-color var(--expander-duration) ease;
        }
        ha-card.clear {
          padding-inline: 0;
          background: transparent;
          border-style: none;
          box-shadow: none;
        }
        ha-card.clear button.toggle { margin-inline: 0; }
        ha-card.clear .children-container { padding-inline: 0; }
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
        .chevron.flipped { transform: rotate(var(--expander-icon-rotate-degree, 180deg)); }
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
          grid-template-columns: minmax(0, 1fr);
          gap: var(--expander-gap);
          min-width: 0;
          width: 100%;
          max-width: 100%;
          padding: var(--child-padding);
        }
        .children-container > * {
          display: block;
          min-width: 0;
          width: 100%;
          max-width: 100%;
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
            <ha-icon class="chevron" icon="${escapeHtml(config.icon)}"></ha-icon>
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
    this.style.setProperty("--expander-top-padding", config["top-padding"]);
    this.style.setProperty("--expander-gap", config.gap);
    this.style.setProperty("--child-padding", config["child-padding"]);
    this.style.setProperty("--collapsed-min-height", config["collapsed-min-height"]);
    this.style.setProperty("--expander-duration", config["transition-duration"]);
    this.style.setProperty("--expander-button-background", config["button-background"] || "transparent");
    this.style.setProperty("--expander-icon-rotate-degree", config["icon-rotate-degree"]);
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
    this._resizeObserver = new ResizeObserver((entries) => {
      this._updateScrollableHint();
      const hostEntry = entries.find((entry) => entry.target === this);
      if (!hostEntry) return;
      const width = hostEntry.contentRect.width;
      if (this._lastObservedWidth !== null && Math.abs(width - this._lastObservedWidth) < 0.5) return;
      this._lastObservedWidth = width;
      cancelAnimationFrame(this._resizeFrame);
      this._resizeFrame = requestAnimationFrame(() => this._notifyChildrenResized());
    });
    this._resizeObserver.observe(this);
    this._resizeObserver.observe(childrenContainer);
    requestAnimationFrame(() => {
      this._updateScrollableHint();
      this._notifyChildrenResized();
    });
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

  _notifyChildrenResized() {
    const cards = this._titleCard ? [this._titleCard, ...this._childCards] : this._childCards;
    cards.forEach((card) => {
      card.dispatchEvent(new Event("iron-resize", { bubbles: true, composed: true }));
    });
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
    chevron.classList.toggle("flipped", this._expanded && this._config["uses-default-icon"]);
    button.setAttribute("aria-expanded", String(this._expanded));
    viewportInner.tabIndex = !this._expanded && scrollable ? 0 : -1;
    this._updateScrollableHint();

    clearTimeout(this._transitionTimer);
    this._transitionTimer = setTimeout(() => {
      this._notifyChildrenResized();
      this.dispatchEvent(new Event("iron-resize", { bubbles: true, composed: true }));
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
               ${text("icon", "Toggle icon", "Example: mdi:chevron-down or mdi:lightbulb")}
               ${text("icon-rotate-degree", "Default chevron rotation", "Applied only when no custom icon is specified")}
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

class ExpanderScrollCardNativeEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = ExpanderScrollCard.getStubConfig();
    this._hass = null;
    this._lovelace = null;
    this._selectedTab = 0;
    this._selectedCard = 0;
    this._showTitleCardPicker = false;
    this._showAddCardPicker = false;

    this.shadowRoot.addEventListener("input", (event) => this._handleField(event));
    this.shadowRoot.addEventListener("change", (event) => this._handleField(event));
    this.shadowRoot.addEventListener("click", (event) => this._handleAction(event));
  }

  set hass(hass) {
    this._hass = hass;
    this._syncHomeAssistantElements();
  }

  set lovelace(lovelace) {
    this._lovelace = lovelace;
    this._syncHomeAssistantElements();
  }

  setConfig(config) {
    const hasActiveElement = Boolean(this.shadowRoot.activeElement);
    this._config = cloneConfig(config || ExpanderScrollCard.getStubConfig());
    if (!Array.isArray(this._config.cards)) this._config.cards = [];
    this._selectedCard = Math.max(0, Math.min(this._selectedCard, this._config.cards.length - 1));

    if (!hasActiveElement) {
      this._render();
    } else {
      this._syncHomeAssistantElements();
    }
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
    const target = event.composedPath().find((element) => element?.dataset?.field);
    if (!target) return;

    const field = target.dataset.field;
    const isSwitch = target.localName === "ha-switch";
    if (isSwitch && event.type !== "change" && event.type !== "input") return;
    if (!isSwitch && event.type !== "input" && event.type !== "change") return;

    const value = isSwitch ? Boolean(target.checked) : target.value;
    const current = this._config[field];
    if (current === value) return;

    if (!isSwitch && value === "" && field !== "title") {
      delete this._config[field];
    } else {
      this._config[field] = value;
    }
    this._emit();
    if (field === "title-card-button-overlay") {
      this._render();
    }
  }

  _handleAction(event) {
    const control = event.composedPath().find((element) => element?.dataset?.action);
    if (!control) return;
    const action = control.dataset.action;

    if (action === "open-title-picker") {
      this._showTitleCardPicker = true;
      this._render();
      return;
    }
    if (action === "cancel-title-picker") {
      this._showTitleCardPicker = false;
      this._render();
      return;
    }
    if (action === "remove-title-card") {
      delete this._config["title-card"];
      delete this._config["title-card-padding"];
      delete this._config["title-card-button-overlay"];
      delete this._config["overlay-margin"];
      this._showTitleCardPicker = false;
      this._emit();
      this._render();
      return;
    }
    if (action === "open-card-picker") {
      this._showAddCardPicker = true;
      this._render();
      return;
    }
    if (action === "cancel-card-picker") {
      this._showAddCardPicker = false;
      this._render();
      return;
    }
    if (action === "remove-card") {
      this._config.cards.splice(this._selectedCard, 1);
      this._selectedCard = Math.max(0, Math.min(this._selectedCard, this._config.cards.length - 1));
      this._emit();
      this._render();
      return;
    }
    if (action === "move-card-up" && this._selectedCard > 0) {
      const index = this._selectedCard;
      [this._config.cards[index - 1], this._config.cards[index]] = [
        this._config.cards[index],
        this._config.cards[index - 1],
      ];
      this._selectedCard -= 1;
      this._emit();
      this._render();
      return;
    }
    if (action === "move-card-down" && this._selectedCard < this._config.cards.length - 1) {
      const index = this._selectedCard;
      [this._config.cards[index + 1], this._config.cards[index]] = [
        this._config.cards[index],
        this._config.cards[index + 1],
      ];
      this._selectedCard += 1;
      this._emit();
      this._render();
    }
  }

  _render() {
    const config = normalizeConfig(this._config);
    const textField = (field, label, helper = "") => {
      const value = this._config[field] ?? config[field] ?? "";
      return `<div class="field">
        <ha-textfield data-field="${field}" label="${escapeHtml(label)}" value="${escapeHtml(value)}"></ha-textfield>
        ${helper ? `<div class="helper">${escapeHtml(helper)}</div>` : ""}
      </div>`;
    };
    const switchField = (field, label) => `
      <ha-formfield label="${escapeHtml(label)}">
        <ha-switch data-field="${field}" ${config[field] ? "checked" : ""}></ha-switch>
      </ha-formfield>`;

    const titleCardType = this._config["title-card"]?.type || "";
    const childTabs = this._config.cards
      .map(
        (card, index) =>
          `<paper-tab class="${index === this._selectedCard ? "tab-selected" : ""}" title="${escapeHtml(
            card.type || `Card ${index + 1}`,
          )}">${index + 1}</paper-tab>`,
      )
      .join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          color: var(--primary-text-color);
          font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
        }
        * { box-sizing: border-box; }
        paper-tabs {
          width: 100%;
          color: var(--primary-text-color);
          border-bottom: 1px solid var(--divider-color);
          --paper-tabs-selection-bar-color: var(--primary-color);
        }
        paper-tab { min-width: 54px; }
        .tab-selected { color: var(--primary-color); background: color-mix(in srgb, var(--primary-color) 7%, transparent); }
        .content {
          display: grid;
          gap: 16px;
          width: 100%;
          padding-top: 16px;
        }
        .section {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .section-title {
          grid-column: 1 / -1;
          margin: 4px 0 -2px;
          color: var(--primary-text-color);
          font-size: 14px;
          font-weight: 600;
        }
        .wide { grid-column: 1 / -1; }
        .field { display: grid; gap: 4px; min-width: 0; }
        ha-textfield { width: 100%; }
        ha-formfield {
          min-height: 48px;
          color: var(--primary-text-color);
          --mdc-theme-text-primary-on-background: var(--primary-text-color);
        }
        .helper {
          padding-inline: 4px;
          color: var(--secondary-text-color);
          font-size: 11px;
          line-height: 1.35;
        }
        .native-note {
          grid-column: 1 / -1;
          padding: 10px 12px;
          border-radius: 9px;
          color: var(--secondary-text-color);
          background: color-mix(in srgb, var(--primary-color) 7%, transparent);
          font-size: 12px;
          line-height: 1.45;
        }
        .row {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          min-width: 0;
        }
        .row ha-textfield { flex: 1 1 auto; min-width: 0; }
        ha-icon-button { flex: 0 0 auto; color: var(--secondary-text-color); }
        .sub-panel {
          grid-column: 1 / -1;
          min-width: 0;
          padding: 14px;
          border: 1px solid var(--divider-color);
          border-radius: var(--ha-card-border-radius, 12px);
          background: color-mix(in srgb, var(--card-background-color) 96%, var(--primary-text-color));
        }
        .panel-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 12px;
        }
        .panel-title {
          min-width: 0;
          overflow: hidden;
          font-size: 13px;
          font-weight: 600;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .toolbar-actions { display: flex; align-items: center; gap: 2px; }
        .card-tab-row { display: flex; align-items: stretch; width: 100%; min-width: 0; }
        .card-tab-row paper-tabs { flex: 1 1 auto; min-width: 0; }
        .card-tab-row ha-icon-button { align-self: center; margin-inline-start: 4px; }
        .empty {
          padding: 28px 14px;
          color: var(--secondary-text-color);
          text-align: center;
        }
        mwc-button[destructive] { --mdc-theme-primary: var(--error-color); }
        @media (max-width: 520px) {
          .section { grid-template-columns: 1fr; }
          .section-title, .wide, .native-note, .sub-panel { grid-column: auto; }
        }
      </style>

      <paper-tabs id="main-tabs" scrollable selected="${this._selectedTab}">
        <paper-tab class="${this._selectedTab === 0 ? "tab-selected" : ""}">Layout</paper-tab>
        <paper-tab class="${this._selectedTab === 1 ? "tab-selected" : ""}">Cards</paper-tab>
      </paper-tabs>

      ${this._selectedTab === 0 ? `
        <div class="content">
          <div class="section">
            <div class="section-title">Header and behavior</div>
            <div class="wide">${textField("title", "Title", "Not displayed when a title card is configured.")}</div>
            ${textField("icon", "Toggle icon", "Leave blank to use the rotating mdi:chevron-down icon.")}
            ${textField("icon-rotate-degree", "Default chevron rotation", "Applied only when no custom icon is specified.")}
            ${switchField("expanded", "Start expanded")}
            ${textField("expand-id", "LocalStorage ID", "Saves expanded/collapsed state in this browser.")}
          </div>

          <div class="section">
            <div class="section-title">Collapsed preview</div>
            ${textField("collapsed-min-height", "Collapsed minimum height", "Examples: 0px, 120px, 30vh.")}
            ${textField("transition-duration", "Animation duration", "Example: 0.5s.")}
            ${switchField("collapsed-scroll", "Scroll content while collapsed")}
          </div>

          <div class="section">
            <div class="section-title">Appearance and sizing</div>
            ${switchField("clear", "Remove card background")}
            ${switchField("clear-children", "Remove child card backgrounds/borders")}
            ${textField("button-background", "Button background", "Any CSS color.")}
            ${textField("gap", "Gap between cards")}
            ${textField("padding", "Padding of all card content")}
            ${textField("top-padding", "Space above title", "Use 0px to remove the top inset.")}
            ${textField("child-padding", "Padding of child cards")}
            ${textField("card-width", "Card width", "Capped to the available mobile width.")}
            ${textField("max-width", "Maximum width")}
            <div class="native-note">Visibility and Sections layout are configured with Home Assistant's native Visibility and Layout controls in the card dialog.</div>
          </div>

          <div class="section">
            <div class="section-title">Title card</div>
            <div class="row wide">
              <ha-textfield label="Title card" value="${escapeHtml(titleCardType)}" readonly></ha-textfield>
              <ha-icon-button data-action="open-title-picker" title="${titleCardType ? "Replace title card" : "Add title card"}" aria-label="${titleCardType ? "Replace title card" : "Add title card"}">
                <ha-icon icon="${titleCardType ? "mdi:refresh" : "mdi:plus"}"></ha-icon>
              </ha-icon-button>
              ${titleCardType ? `<ha-icon-button data-action="remove-title-card" title="Remove title card" aria-label="Remove title card"><ha-icon icon="mdi:close"></ha-icon></ha-icon-button>` : ""}
            </div>
            ${this._showTitleCardPicker ? `
              <div class="sub-panel">
                <div class="panel-toolbar"><span class="panel-title">Choose title card</span><mwc-button data-action="cancel-title-picker">Cancel</mwc-button></div>
                <hui-card-picker id="title-card-picker"></hui-card-picker>
              </div>`
              : titleCardType ? `
              <div class="sub-panel">
                <hui-card-element-editor id="title-card-editor"></hui-card-element-editor>
              </div>
              ${textField("title-card-padding", "Title card padding")}
              ${switchField("title-card-button-overlay", "Expand button as overlay on title card")}
              ${config["title-card-button-overlay"] ? textField("overlay-margin", "Overlay button margin") : ""}
              ` : ""}
          </div>
        </div>
      ` : `
        <div class="content">
          <div class="card-tab-row">
            <paper-tabs id="card-tabs" scrollable selected="${this._selectedCard}">${childTabs}</paper-tabs>
            <ha-icon-button data-action="open-card-picker" title="Add card" aria-label="Add card"><ha-icon icon="mdi:plus"></ha-icon></ha-icon-button>
          </div>
          ${this._showAddCardPicker ? `
            <div class="sub-panel">
              <div class="panel-toolbar"><span class="panel-title">Choose a card</span><mwc-button data-action="cancel-card-picker">Cancel</mwc-button></div>
              <hui-card-picker id="child-card-picker"></hui-card-picker>
            </div>
          ` : this._config.cards.length ? `
            <div class="sub-panel">
              <div class="panel-toolbar">
                <span class="panel-title">Card ${this._selectedCard + 1}: ${escapeHtml(this._config.cards[this._selectedCard]?.type || "unknown")}</span>
                <div class="toolbar-actions">
                  <ha-icon-button data-action="move-card-up" title="Move card up" aria-label="Move card up" ${this._selectedCard === 0 ? "disabled" : ""}><ha-icon icon="mdi:arrow-up"></ha-icon></ha-icon-button>
                  <ha-icon-button data-action="move-card-down" title="Move card down" aria-label="Move card down" ${this._selectedCard === this._config.cards.length - 1 ? "disabled" : ""}><ha-icon icon="mdi:arrow-down"></ha-icon></ha-icon-button>
                  <mwc-button destructive data-action="remove-card">Remove</mwc-button>
                </div>
              </div>
              <hui-card-element-editor id="child-card-editor"></hui-card-element-editor>
            </div>
          ` : `<div class="empty">No child cards configured. Use + to add one.</div>`}
        </div>
      `}
    `;

    this.shadowRoot.querySelectorAll("ha-textfield[data-field]").forEach((field) => {
      field.value = this._config[field.dataset.field] ?? config[field.dataset.field] ?? "";
    });
    this.shadowRoot.querySelectorAll("ha-switch[data-field]").forEach((field) => {
      field.checked = config[field.dataset.field] === true;
    });

    this._bindTabs();
    this._mountCardTools();
  }

  _bindTabs() {
    const mainTabs = this.shadowRoot.querySelector("#main-tabs");
    if (mainTabs) mainTabs.selected = this._selectedTab;
    mainTabs?.addEventListener("iron-activate", (event) => {
      const selected = Number(event.detail?.selected ?? 0);
      if (selected === this._selectedTab) return;
      this._selectedTab = selected;
      this._showTitleCardPicker = false;
      this._showAddCardPicker = false;
      this._render();
    });

    const cardTabs = this.shadowRoot.querySelector("#card-tabs");
    if (cardTabs) cardTabs.selected = this._selectedCard;
    cardTabs?.addEventListener("iron-activate", (event) => {
      const selected = Number(event.detail?.selected ?? 0);
      if (!Number.isFinite(selected) || selected === this._selectedCard) return;
      this._selectedCard = Math.max(0, Math.min(selected, this._config.cards.length - 1));
      this._render();
    });
  }

  _mountCardTools() {
    const bindCommon = (element) => {
      if (!element) return;
      element.hass = this._hass;
      element.lovelace = this._lovelace;
    };

    const titlePicker = this.shadowRoot.querySelector("#title-card-picker");
    bindCommon(titlePicker);
    titlePicker?.addEventListener("config-changed", (event) => {
      event.stopPropagation();
      this._config["title-card"] = cloneConfig(event.detail.config);
      this._showTitleCardPicker = false;
      this._emit();
      this._render();
    });

    const childPicker = this.shadowRoot.querySelector("#child-card-picker");
    bindCommon(childPicker);
    childPicker?.addEventListener("config-changed", (event) => {
      event.stopPropagation();
      this._config.cards.push(cloneConfig(event.detail.config));
      this._selectedCard = this._config.cards.length - 1;
      this._showAddCardPicker = false;
      this._emit();
      this._render();
    });

    const titleEditor = this.shadowRoot.querySelector("#title-card-editor");
    bindCommon(titleEditor);
    if (titleEditor) {
      titleEditor.value = this._config["title-card"];
      titleEditor.addEventListener("config-changed", (event) => {
        event.stopPropagation();
        this._config["title-card"] = cloneConfig(event.detail.config);
        this._emit();
      });
    }

    const childEditor = this.shadowRoot.querySelector("#child-card-editor");
    bindCommon(childEditor);
    if (childEditor && this._config.cards[this._selectedCard]) {
      childEditor.value = this._config.cards[this._selectedCard];
      childEditor.addEventListener("config-changed", (event) => {
        event.stopPropagation();
        this._config.cards[this._selectedCard] = cloneConfig(event.detail.config);
        this._emit();
      });
    }
  }

  _syncHomeAssistantElements() {
    this.shadowRoot.querySelectorAll("hui-card-picker, hui-card-element-editor").forEach((element) => {
      element.hass = this._hass;
      element.lovelace = this._lovelace;
    });
  }
}

const EXPANDER_SCROLL_EDITOR_SCHEMA = [
  {
    type: "expandable",
    label: "Expander Card Settings",
    icon: "mdi:arrow-down-bold-box-outline",
    schema: [
      {
        name: "title",
        label: "Title",
        selector: { text: {} },
      },
      {
        name: "icon",
        label: "Icon",
        selector: { icon: {} },
      },
      {
        type: "expandable",
        label: "Expander control",
        icon: "mdi:cog-outline",
        schema: [
          {
            type: "grid",
            schema: [
              {
                name: "expanded",
                label: "Start expanded",
                selector: { boolean: {} },
              },
              {
                name: "collapsed-scroll",
                label: "Scroll while collapsed",
                selector: { boolean: {} },
              },
              {
                name: "collapsed-min-height",
                label: "Collapsed minimum height",
                selector: { text: {} },
              },
              {
                name: "transition-duration",
                label: "Animation duration",
                selector: { text: {} },
              },
              {
                name: "expand-id",
                label: "LocalStorage ID",
                selector: { text: {} },
              },
            ],
          },
        ],
      },
      {
        type: "expandable",
        label: "Expander styling",
        icon: "mdi:palette-swatch",
        schema: [
          {
            type: "grid",
            schema: [
              {
                name: "icon-rotate-degree",
                label: "Default chevron rotation",
                selector: { text: {} },
              },
              {
                name: "button-background",
                label: "Button background color",
                selector: { text: {} },
              },
              {
                name: "clear",
                label: "Clear border and background",
                selector: { boolean: {} },
              },
              {
                name: "gap",
                label: "Gap",
                selector: { text: {} },
              },
              {
                name: "padding",
                label: "Padding",
                selector: { text: {} },
              },
              {
                name: "top-padding",
                label: "Space above title",
                selector: { text: {} },
              },
              {
                name: "card-width",
                label: "Card width",
                selector: { text: {} },
              },
              {
                name: "max-width",
                label: "Maximum width",
                selector: { text: {} },
              },
            ],
          },
        ],
      },
      {
        type: "expandable",
        label: "Card styling",
        icon: "mdi:palette-swatch-outline",
        schema: [
          {
            type: "grid",
            schema: [
              {
                name: "child-padding",
                label: "Card padding",
                selector: { text: {} },
              },
              {
                name: "clear-children",
                label: "Clear card borders and backgrounds",
                selector: { boolean: {} },
              },
            ],
          },
        ],
      },
      {
        type: "expandable",
        label: "Title card",
        icon: "mdi:subtitles-outline",
        schema: [
          {
            name: "title-card",
            label: "Title card configuration",
            selector: { object: {} },
          },
          {
            type: "grid",
            schema: [
              {
                name: "title-card-button-overlay",
                label: "Overlay expand button on title card",
                selector: { boolean: {} },
              },
              {
                name: "title-card-padding",
                label: "Title card padding",
                selector: { text: {} },
              },
              {
                name: "overlay-margin",
                label: "Overlay margin",
                selector: { text: {} },
              },
            ],
          },
        ],
      },
    ],
  },
];

async function defineExpanderScrollCardEditor() {
  if (customElements.get(EDITOR_TAG)) return;
  for (let attempt = 0; attempt < 50 && typeof window.loadCardHelpers !== "function"; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  if (typeof window.loadCardHelpers !== "function") {
    throw new Error("Home Assistant card helpers are unavailable");
  }

  const helpers = await window.loadCardHelpers();
  const verticalStackCard = helpers.createCardElement({ type: "vertical-stack", cards: [] });
  await customElements.whenDefined("hui-vertical-stack-card");
  const verticalStackEditor = await verticalStackCard.constructor.getConfigElement();
  const VerticalStackEditor = verticalStackEditor.constructor;

  class ExpanderScrollCardSchemaEditor extends VerticalStackEditor {
    constructor() {
      super();
      this._computeLabelCallback = (item) => item.label ?? item.name ?? "";
      this._valueChanged = this._schemaValueChanged.bind(this);
    }

    setConfig(config) {
      this._config = cloneConfig(config || ExpanderScrollCard.getStubConfig());
      if (!Array.isArray(this._config.cards)) this._config.cards = [];
    }

    get _schema() {
      return EXPANDER_SCROLL_EDITOR_SCHEMA;
    }

    set _schema(_value) {
      // The vertical-stack editor may assign its own schema; this card always
      // uses the Expander Scroll Card schema above.
    }

    _schemaValueChanged(event) {
      const formValue = event.detail?.value || {};
      const config = { ...this._config, ...cloneConfig(formValue) };
      for (const [key, value] of Object.entries(config)) {
        if ((value === "" || value === null || value === undefined) && key !== "title") {
          delete config[key];
        }
      }
      if (!Array.isArray(config.cards)) config.cards = [];
      this._config = config;
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: cloneConfig(this._config) },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  customElements.define(EDITOR_TAG, ExpanderScrollCardSchemaEditor);
}

defineExpanderScrollCardEditor().catch((error) => {
  console.warn("Expander Scroll Card could not load the native schema editor; using fallback editor.", error);
  if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, ExpanderScrollCardNativeEditor);
});
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
