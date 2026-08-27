const CARD_TAG = "teamspeak3-card";
const CARD_VERSION = "1.0.0";

const DEFAULT_CONFIG = {
  show_header: true,
  show_count: true,
  show_icon: true,
  show_refresh: false,
  show_server: false,
  sort_clients: false,
  text_align: "left",
  text_size: "small",
  icon_size: "small",
  icon: "mdi:account-voice",
  empty_message: "Nobody's online!",
  unavailable_message: "TeamSpeak server unavailable",
  client_attribute: "clients",
  max_clients: 0,
  card_width: "100%",
  card_height: "160px",
};

function parseBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function cssLength(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) return `${value}px`;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function parseClients(raw) {
  let value = raw;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      value = JSON.parse(trimmed);
    } catch (_error) {
      value = trimmed.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(value)) return null;
  return value
    .map((client) => {
      if (typeof client === "string" || typeof client === "number") return String(client).trim();
      if (!client || typeof client !== "object") return "";
      return String(client.nickname ?? client.client_nickname ?? client.name ?? "").trim();
    })
    .filter(Boolean);
}

class TeamSpeak3Card extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._renderKey = "";
    this._renderSkeleton();
  }

  static getStubConfig() {
    return { entity: "sensor.teamspeak_3_online_clients" };
  }

  static getConfigForm() {
    const labels = {
      entity: "Online clients entity",
      name: "Card title",
      client_attribute: "Client-list attribute",
      show_header: "Show header",
      show_count: "Show online count",
      show_icon: "Show client icons",
      show_refresh: "Show refresh button",
      show_server: "Show server address",
      sort_clients: "Sort client names",
      text_align: "Text alignment",
      text_size: "Client text size",
      icon_size: "Client icon size",
      icon: "Client icon",
      empty_message: "Empty-server message",
      unavailable_message: "Unavailable message",
      max_clients: "Maximum displayed clients",
      card_width: "Card width",
      card_height: "Minimum card height",
    };
    const helpers = {
      entity: "Select the sensor created by TeamSpeak 3 Monitor, or another entity with a clients attribute.",
      client_attribute: "Attribute containing an array of names; defaults to clients.",
      max_clients: "Use 0 to display every connected client.",
      card_width: "Examples: 100%, 350px, or 24rem. Sections columns are configured on the Layout tab.",
      card_height: "The card grows with clients and can stretch to the rows selected on the Layout tab.",
    };
    const sizeOptions = ["xsmall", "small", "medium", "large", "xlarge"];
    return {
      schema: [
        {
          name: "entity",
          required: true,
          selector: { entity: { filter: { domain: "sensor" } } },
        },
        { name: "name", selector: { text: {} } },
        {
          type: "expandable",
          name: "content",
          title: "Content",
          flatten: true,
          schema: [
            { name: "client_attribute", selector: { text: {} } },
            { name: "empty_message", selector: { text: {} } },
            { name: "unavailable_message", selector: { text: {} } },
            {
              name: "max_clients",
              selector: { number: { min: 0, max: 500, step: 1, mode: "box" } },
            },
            { name: "show_header", selector: { boolean: {} } },
            { name: "show_count", selector: { boolean: {} } },
            { name: "show_server", selector: { boolean: {} } },
            { name: "show_refresh", selector: { boolean: {} } },
            { name: "sort_clients", selector: { boolean: {} } },
          ],
        },
        {
          type: "expandable",
          name: "appearance",
          title: "Appearance",
          flatten: true,
          schema: [
            { name: "show_icon", selector: { boolean: {} } },
            { name: "icon", selector: { icon: {} } },
            {
              name: "text_align",
              selector: {
                select: {
                  mode: "dropdown",
                  options: [
                    { value: "left", label: "Left" },
                    { value: "right", label: "Right" },
                  ],
                },
              },
            },
            {
              name: "text_size",
              selector: { select: { mode: "dropdown", options: sizeOptions } },
            },
            {
              name: "icon_size",
              selector: { select: { mode: "dropdown", options: sizeOptions } },
            },
            { name: "card_width", selector: { text: {} } },
            { name: "card_height", selector: { text: {} } },
          ],
        },
      ],
      computeLabel: (schema) => labels[schema.name],
      computeHelper: (schema) => helpers[schema.name],
    };
  }

  setConfig(config) {
    if (!config || typeof config.entity !== "string" || !config.entity.trim()) {
      throw new Error("TeamSpeak 3 Card requires an entity.");
    }
    const maxClients = Number(config.max_clients ?? DEFAULT_CONFIG.max_clients);
    this._config = {
      ...DEFAULT_CONFIG,
      ...config,
      entity: config.entity.trim(),
      show_header: parseBoolean(config.show_header, DEFAULT_CONFIG.show_header),
      show_count: parseBoolean(config.show_count, DEFAULT_CONFIG.show_count),
      show_icon: parseBoolean(config.show_icon, DEFAULT_CONFIG.show_icon),
      show_refresh: parseBoolean(config.show_refresh, DEFAULT_CONFIG.show_refresh),
      show_server: parseBoolean(config.show_server, DEFAULT_CONFIG.show_server),
      sort_clients: parseBoolean(config.sort_clients, DEFAULT_CONFIG.sort_clients),
      max_clients: Number.isFinite(maxClients) ? Math.max(0, Math.floor(maxClients)) : 0,
      card_width: cssLength(config.card_width ?? config.width, DEFAULT_CONFIG.card_width),
      card_height: cssLength(config.card_height, DEFAULT_CONFIG.card_height),
    };
    if (!["left", "right"].includes(this._config.text_align)) {
      throw new Error("text_align must be left or right.");
    }
    this._renderKey = "";
    this._applySizing();
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  getCardSize() {
    if (!this._config || !this._hass) return 3;
    const state = this._hass.states[this._config.entity];
    const clients = parseClients(state?.attributes?.[this._config.client_attribute]);
    return Math.max(2, Math.min(8, 2 + Math.ceil((clients?.length || 0) / 2)));
  }

  getGridOptions() {
    return { rows: 3, columns: 6, min_rows: 2, min_columns: 3 };
  }

  _renderSkeleton() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: var(--ts-card-width, 100%);
          max-width: 100%;
          height: 100%;
          min-height: var(--ts-card-height, 160px);
          margin-inline: auto;
        }
        ha-card {
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          width: 100%;
          height: 100%;
          min-height: var(--ts-card-height, 160px);
          overflow: hidden;
          color: var(--primary-text-color);
          background: var(--ha-card-background, var(--card-background-color));
        }
        .header {
          display: flex;
          align-items: center;
          gap: 9px;
          min-height: 48px;
          padding: 10px 14px 7px;
          box-sizing: border-box;
          border-bottom: 1px solid var(--divider-color, rgb(127 127 127 / .22));
        }
        .header-icon {
          color: var(--primary-color);
          --mdc-icon-size: 22px;
        }
        .title-wrap { min-width: 0; flex: 1; }
        .title {
          overflow: hidden;
          font-size: 17px;
          font-weight: 500;
          line-height: 1.25;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .server {
          overflow: hidden;
          margin-top: 2px;
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.2;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .count {
          min-width: 22px;
          padding: 3px 7px;
          border-radius: 999px;
          color: var(--text-primary-color, #fff);
          background: var(--primary-color);
          font-size: 12px;
          font-weight: 700;
          line-height: 18px;
          text-align: center;
        }
        .refresh {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          margin: -4px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          color: var(--secondary-text-color);
          background: transparent;
          cursor: pointer;
        }
        .refresh:hover { background: rgb(127 127 127 / .12); }
        .refresh:focus-visible { outline: 2px solid var(--primary-color); }
        .refresh ha-icon { --mdc-icon-size: 20px; }
        .content {
          display: flex;
          flex: 1;
          min-height: 0;
          flex-direction: column;
        }
        .clients {
          flex: 1;
          min-height: 0;
          margin: 0;
          padding: 8px 12px 10px;
          overflow: auto;
          list-style: none;
          scrollbar-width: thin;
        }
        .client {
          display: flex;
          align-items: center;
          gap: 9px;
          min-height: 30px;
          padding: 2px 5px;
          border-radius: 7px;
          box-sizing: border-box;
        }
        .client + .client { margin-top: 2px; }
        .client:hover { background: rgb(127 127 127 / .08); }
        .client.right { flex-direction: row-reverse; text-align: right; }
        .nickname {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .client-icon { flex: none; color: var(--secondary-text-color); }
        .text-xsmall { font-size: 12px; }
        .text-small { font-size: 14px; }
        .text-medium { font-size: 16px; }
        .text-large { font-size: 18px; }
        .text-xlarge { font-size: 21px; }
        .icon-xsmall { --mdc-icon-size: 13px; }
        .icon-small { --mdc-icon-size: 16px; }
        .icon-medium { --mdc-icon-size: 19px; }
        .icon-large { --mdc-icon-size: 22px; }
        .icon-xlarge { --mdc-icon-size: 26px; }
        .message {
          display: grid;
          flex: 1;
          place-items: center;
          min-height: 72px;
          padding: 18px;
          box-sizing: border-box;
          color: var(--secondary-text-color);
          font-size: 14px;
          text-align: center;
        }
        .message.error { color: var(--error-color); }
        .overflow-note {
          padding: 4px 17px 11px;
          color: var(--secondary-text-color);
          font-size: 12px;
          text-align: center;
        }
        [hidden] { display: none !important; }
      </style>
      <ha-card>
        <div class="header">
          <ha-icon class="header-icon" icon="mdi:headset"></ha-icon>
          <div class="title-wrap">
            <div class="title"></div>
            <div class="server" hidden></div>
          </div>
          <span class="count" hidden></span>
          <button class="refresh" type="button" aria-label="Refresh client list" title="Refresh" hidden>
            <ha-icon icon="mdi:refresh"></ha-icon>
          </button>
        </div>
        <div class="content">
          <ul class="clients" aria-label="Online TeamSpeak clients"></ul>
          <div class="message" role="status" hidden></div>
          <div class="overflow-note" hidden></div>
        </div>
      </ha-card>
    `;
    this._elements = {
      card: this.shadowRoot.querySelector("ha-card"),
      header: this.shadowRoot.querySelector(".header"),
      title: this.shadowRoot.querySelector(".title"),
      server: this.shadowRoot.querySelector(".server"),
      count: this.shadowRoot.querySelector(".count"),
      refresh: this.shadowRoot.querySelector(".refresh"),
      clients: this.shadowRoot.querySelector(".clients"),
      message: this.shadowRoot.querySelector(".message"),
      overflow: this.shadowRoot.querySelector(".overflow-note"),
    };
    this._elements.card.addEventListener("click", () => this._showMoreInfo());
    this._elements.refresh.addEventListener("click", (event) => {
      event.stopPropagation();
      this._refresh();
    });
  }

  _applySizing() {
    if (!this._config) return;
    this.style.setProperty("--ts-card-width", this._config.card_width);
    this.style.setProperty("--ts-card-height", this._config.card_height);
  }

  _update() {
    if (!this._config || !this._hass) return;
    const state = this._hass.states[this._config.entity];
    const rawClients = state?.attributes?.[this._config.client_attribute];
    const renderKey = JSON.stringify([
      state?.state,
      state?.last_updated,
      rawClients,
      state?.attributes?.server,
      this._config,
    ]);
    if (renderKey === this._renderKey) return;
    this._renderKey = renderKey;

    const title = typeof this._config.name === "string" && this._config.name.trim()
      ? this._config.name.trim()
      : state?.attributes?.friendly_name || "TeamSpeak 3";
    this._elements.title.textContent = title;
    this._elements.header.hidden = !this._config.show_header;
    this._elements.refresh.hidden = !this._config.show_refresh;

    const server = state?.attributes?.server || "";
    this._elements.server.textContent = server;
    this._elements.server.hidden = !this._config.show_server || !server;

    if (!state) {
      this._renderMessage(`Entity not found: ${this._config.entity}`, true);
      this._renderCount(null);
      return;
    }
    if (state.state === "unavailable" || state.state === "unknown") {
      this._renderMessage(this._config.unavailable_message, true);
      this._renderCount(null);
      return;
    }

    if (rawClients === undefined) {
      this._renderMessage(`Attribute not found: ${this._config.client_attribute}`, true);
      this._renderCount(null);
      return;
    }
    let clients = parseClients(rawClients);
    if (clients === null) {
      this._renderMessage(`Attribute “${this._config.client_attribute}” must contain a client list.`, true);
      this._renderCount(null);
      return;
    }
    if (this._config.sort_clients) {
      clients = [...clients].sort((left, right) => left.localeCompare(right, this._hass.language));
    }

    this._renderCount(clients.length);
    if (clients.length === 0) {
      this._renderMessage(this._config.empty_message, false);
      return;
    }

    this._elements.message.hidden = true;
    this._elements.message.classList.remove("error");
    this._elements.clients.hidden = false;
    this._elements.clients.replaceChildren();
    const maximum = this._config.max_clients > 0 ? this._config.max_clients : clients.length;
    const shown = clients.slice(0, maximum);
    for (const nickname of shown) {
      const row = document.createElement("li");
      row.className = `client ${this._config.text_align} text-${this._config.text_size}`;
      const name = document.createElement("span");
      name.className = "nickname";
      name.textContent = nickname;
      name.title = nickname;
      if (this._config.show_icon) {
        const icon = document.createElement("ha-icon");
        icon.className = `client-icon icon-${this._config.icon_size}`;
        icon.setAttribute("icon", this._config.icon || DEFAULT_CONFIG.icon);
        icon.setAttribute("aria-hidden", "true");
        row.append(icon);
      }
      row.append(name);
      this._elements.clients.append(row);
    }
    const remaining = clients.length - shown.length;
    this._elements.overflow.textContent = remaining > 0 ? `+${remaining} more online` : "";
    this._elements.overflow.hidden = remaining <= 0;
    this._elements.card.setAttribute("aria-label", `${title}: ${clients.length} online`);
  }

  _renderCount(count) {
    const visible = this._config.show_header && this._config.show_count && count !== null;
    this._elements.count.textContent = count === null ? "" : String(count);
    this._elements.count.hidden = !visible;
  }

  _renderMessage(text, error) {
    this._elements.clients.replaceChildren();
    this._elements.clients.hidden = true;
    this._elements.overflow.hidden = true;
    this._elements.message.textContent = text;
    this._elements.message.classList.toggle("error", error);
    this._elements.message.hidden = false;
    this._elements.card.setAttribute("aria-label", text);
  }

  _refresh() {
    if (!this._hass?.callService) return;
    this._hass.callService("homeassistant", "update_entity", {
      entity_id: this._config.entity,
    });
  }

  _showMoreInfo() {
    if (!this._config?.entity) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      bubbles: true,
      composed: true,
      detail: { entityId: this._config.entity },
    }));
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, TeamSpeak3Card);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: "TeamSpeak 3 Card",
    description: "Displays the online voice-client list from a TeamSpeak 3 Monitor sensor.",
    preview: true,
    documentationURL: "https://github.com/Thlb/MMM-teamspeak3",
    getEntitySuggestion: (_hass, entityId) => (
      entityId.startsWith("sensor.")
        ? { config: { type: `custom:${CARD_TAG}`, entity: entityId } }
        : null
    ),
  });
}

console.info(`%c TEAMSPEAK3-CARD %c v${CARD_VERSION} `, "color: white; background: #2580c3; font-weight: 700;", "color: #2580c3; background: transparent;");
