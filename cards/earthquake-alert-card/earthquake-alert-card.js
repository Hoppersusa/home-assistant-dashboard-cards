const CARD_TAG = "earthquake-alert-card";
const EDITOR_TAG = "earthquake-alert-card-editor";
const VERSION = "1.0.0";
const USGS_FEED = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";

const DEFAULT_THRESHOLDS = Object.freeze([
  { magnitude: 2.5, distance: 10 },
  { magnitude: 4.0, distance: 60 },
  { magnitude: 5.5, distance: 300 },
  { magnitude: 7.0, distance: null },
]);

const DEFAULT_CONFIG = Object.freeze({
  title: "Earthquake Alerts",
  data_source: "auto",
  distance_unit: "mi",
  hours: 24,
  max_items: 8,
  update_interval: 5,
  show_depth: true,
  show_source: true,
  animate: true,
  card_width: "100%",
  max_width: "none",
});

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTime(value) {
  if (typeof value === "number") return value;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && String(value).trim() !== "") return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(latitude1, longitude1, latitude2, longitude2) {
  const values = [latitude1, longitude1, latitude2, longitude2].map(numberOrNull);
  if (values.some((value) => value === null)) return Number.NaN;
  const [lat1, lon1, lat2, lon2] = values;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceToConfiguredUnit(km, unit) {
  return unit === "mi" ? km / 1.609344 : km;
}

function severityForMagnitude(magnitude) {
  if (magnitude >= 7) return "critical";
  if (magnitude >= 5.5) return "high";
  if (magnitude >= 4) return "moderate";
  return "low";
}

function normalizedThresholds(config) {
  const configured = Array.isArray(config?.thresholds) ? config.thresholds : DEFAULT_THRESHOLDS;
  return configured
    .map((threshold) => ({
      magnitude: numberOrNull(threshold.magnitude),
      distance: numberOrNull(threshold.distance),
    }))
    .filter((threshold) => threshold.magnitude !== null)
    .sort((left, right) => left.magnitude - right.magnitude);
}

function resolvedLocations(config, hass) {
  const configured = Array.isArray(config?.locations) && config.locations.length
    ? config.locations
    : [{ name: "Home", use_home_coordinates: true }];
  return configured
    .map((location, index) => {
      const useHome = location.use_home_coordinates === true;
      const latitude = numberOrNull(useHome ? hass?.config?.latitude : location.latitude);
      const longitude = numberOrNull(useHome ? hass?.config?.longitude : location.longitude);
      return {
        name: String(location.name || (useHome ? "Home" : `Location ${index + 1}`)),
        latitude,
        longitude,
      };
    })
    .filter(
      (location) =>
        location.latitude !== null &&
        location.longitude !== null &&
        location.latitude >= -90 &&
        location.latitude <= 90 &&
        location.longitude >= -180 &&
        location.longitude <= 180,
    );
}

function normalizeNativeEvent(entityId, stateObj) {
  const attributes = stateObj?.attributes || {};
  return {
    id: String(attributes.external_id || entityId),
    entityId,
    magnitude: numberOrNull(attributes.magnitude),
    latitude: numberOrNull(attributes.latitude),
    longitude: numberOrNull(attributes.longitude),
    depth: numberOrNull(attributes.depth),
    place: String(attributes.place || attributes.friendly_name || stateObj?.name || "Unknown location"),
    time: normalizeTime(attributes.time || stateObj?.last_changed),
    updated: normalizeTime(attributes.updated || stateObj?.last_updated),
    status: String(attributes.status || ""),
    type: String(attributes.type || "earthquake"),
    url: String(attributes.url || attributes.external_url || ""),
    source: "Home Assistant",
  };
}

function normalizeGeoJsonFeature(feature) {
  const properties = feature?.properties || {};
  const coordinates = feature?.geometry?.coordinates || [];
  return {
    id: String(feature?.id || properties.code || `${properties.time}-${properties.place}`),
    entityId: "",
    magnitude: numberOrNull(properties.mag),
    longitude: numberOrNull(coordinates[0]),
    latitude: numberOrNull(coordinates[1]),
    depth: numberOrNull(coordinates[2]),
    place: String(properties.place || properties.title || "Unknown location"),
    time: normalizeTime(properties.time),
    updated: normalizeTime(properties.updated),
    status: String(properties.status || ""),
    type: String(properties.type || "earthquake"),
    url: String(properties.url || properties.detail || ""),
    source: "USGS",
  };
}

function qualifyEvent(event, locations, thresholds, unit) {
  if (
    event.magnitude === null ||
    event.latitude === null ||
    event.longitude === null ||
    event.type === "quarry"
  ) {
    return null;
  }

  const worldwide = thresholds.find(
    (threshold) => threshold.distance === null && event.magnitude >= threshold.magnitude,
  );
  const distances = locations.map((location) => ({
    ...location,
    km: distanceKm(location.latitude, location.longitude, event.latitude, event.longitude),
  }));

  for (const location of distances) {
    for (const threshold of thresholds) {
      if (threshold.distance === null || event.magnitude < threshold.magnitude) continue;
      const configuredDistance = distanceToConfiguredUnit(location.km, unit);
      if (configuredDistance <= threshold.distance) {
        return { ...event, matchedLocation: location, matchedThreshold: threshold, distances };
      }
    }
  }

  if (worldwide) {
    return {
      ...event,
      matchedLocation: distances[0] || null,
      matchedThreshold: worldwide,
      distances,
    };
  }
  return null;
}

function relativeTime(timestamp, locale) {
  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(deltaSeconds) < 90) return formatter.format(deltaSeconds, "second");
  const minutes = Math.round(deltaSeconds / 60);
  if (Math.abs(minutes) < 90) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 36) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

function localeFromHass(hass) {
  return hass?.locale?.language || hass?.language || globalThis.navigator?.language || "en-US";
}

class EarthquakeAlertCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._remoteEvents = [];
    this._fetchError = "";
    this._loading = false;
    this._timer = null;
    this._minuteTimer = null;
    this._abortController = null;
  }

  static getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    return {
      title: "Earthquake Alerts",
      data_source: "auto",
      distance_unit: hass?.config?.unit_system?.length === "km" ? "km" : "mi",
      locations: [{ name: "Home", use_home_coordinates: true }],
      thresholds: clone(DEFAULT_THRESHOLDS),
    };
  }

  static getGridOptions() {
    return { columns: 6, min_columns: 3, rows: 4, min_rows: 2 };
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Earthquake Alert Card requires configuration.");
    this._config = {
      ...DEFAULT_CONFIG,
      ...clone(config),
      locations: Array.isArray(config.locations)
        ? config.locations.map((location) => ({ ...location }))
        : [{ name: "Home", use_home_coordinates: true }],
      thresholds: normalizedThresholds(config),
    };
    this._scheduleFetch();
    this._scheduleMinuteRender();
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._shouldFetchDirectly() && !this._remoteEvents.length && !this._loading) this._fetchFeed();
    this._render();
  }

  connectedCallback() {
    this._scheduleFetch(true);
    this._scheduleMinuteRender();
    this._render();
  }

  disconnectedCallback() {
    if (this._timer) clearTimeout(this._timer);
    if (this._minuteTimer) clearTimeout(this._minuteTimer);
    this._abortController?.abort();
    this._timer = null;
    this._minuteTimer = null;
  }

  getCardSize() {
    return Math.max(2, Math.min(8, (this._displayEvents()?.length || 1) + 1));
  }

  getGridOptions() {
    return {
      columns: 6,
      min_columns: 3,
      rows: Math.max(2, Math.min(8, (this._displayEvents()?.length || 1) + 1)),
      min_rows: 2,
    };
  }

  _nativeEvents() {
    if (!this._hass?.states) return [];
    return Object.entries(this._hass.states)
      .filter(
        ([entityId, stateObj]) =>
          entityId.startsWith("geo_location.") &&
          stateObj?.attributes?.source === "usgs_earthquakes_feed",
      )
      .map(([entityId, stateObj]) => normalizeNativeEvent(entityId, stateObj));
  }

  _shouldFetchDirectly() {
    if (!this._config) return false;
    if (this._config.data_source === "usgs") return true;
    if (this._config.data_source === "native") return false;
    return this._nativeEvents().length === 0;
  }

  _sourceEvents() {
    const nativeEvents = this._nativeEvents();
    if (this._config?.data_source === "native") return nativeEvents;
    if (this._config?.data_source === "usgs") return this._remoteEvents;
    return nativeEvents.length ? nativeEvents : this._remoteEvents;
  }

  _displayEvents() {
    if (!this._config) return [];
    const locations = resolvedLocations(this._config, this._hass);
    if (!locations.length) return [];
    const thresholds = normalizedThresholds(this._config);
    const cutoff = Date.now() - Math.max(1, Number(this._config.hours) || 24) * 3600000;
    const seen = new Set();
    return this._sourceEvents()
      .filter((event) => event.time >= cutoff && !seen.has(event.id) && seen.add(event.id))
      .map((event) => qualifyEvent(event, locations, thresholds, this._config.distance_unit))
      .filter(Boolean)
      .sort((left, right) => right.time - left.time || right.magnitude - left.magnitude)
      .slice(0, Math.max(1, Number(this._config.max_items) || 8));
  }

  async _fetchFeed() {
    if (!this._config || !this.isConnected || !this._shouldFetchDirectly()) return;
    this._abortController?.abort();
    this._abortController = new AbortController();
    this._loading = true;
    this._fetchError = "";
    this._render();
    try {
      const response = await fetch(USGS_FEED, {
        signal: this._abortController.signal,
        headers: { Accept: "application/geo+json, application/json" },
      });
      if (!response.ok) throw new Error(`USGS returned HTTP ${response.status}`);
      const payload = await response.json();
      this._remoteEvents = Array.isArray(payload?.features)
        ? payload.features.map(normalizeGeoJsonFeature)
        : [];
    } catch (error) {
      if (error?.name !== "AbortError") this._fetchError = error?.message || "Unable to load USGS data";
    } finally {
      this._loading = false;
      this._render();
      this._scheduleFetch();
    }
  }

  _scheduleFetch(immediate = false) {
    if (this._timer) clearTimeout(this._timer);
    if (!this.isConnected || !this._config || !this._shouldFetchDirectly()) return;
    const delay = immediate ? 0 : Math.max(5, Number(this._config.update_interval) || 5) * 60000;
    this._timer = setTimeout(() => this._fetchFeed(), delay);
  }

  _scheduleMinuteRender() {
    if (this._minuteTimer) clearTimeout(this._minuteTimer);
    if (!this.isConnected) return;
    const delay = 60000 - (Date.now() % 60000) + 50;
    this._minuteTimer = setTimeout(() => {
      this._render();
      this._scheduleMinuteRender();
    }, delay);
  }

  _activateEvent(event) {
    if (event.entityId) {
      this.dispatchEvent(
        new CustomEvent("hass-more-info", {
          detail: { entityId: event.entityId },
          bubbles: true,
          composed: true,
        }),
      );
    } else if (event.url) {
      globalThis.open(event.url, "_blank", "noopener,noreferrer");
    }
  }

  _renderEvent(event, index, locale) {
    const unit = this._config.distance_unit === "km" ? "km" : "mi";
    const primaryDistance = event.distances?.[0]
      ? distanceToConfiguredUnit(event.distances[0].km, unit)
      : Number.NaN;
    const matchedDistance = event.matchedLocation
      ? distanceToConfiguredUnit(event.matchedLocation.km, unit)
      : Number.NaN;
    const depth = event.depth === null
      ? ""
      : `${Math.round(distanceToConfiguredUnit(event.depth, unit))} ${unit} deep`;
    const distanceText = Number.isFinite(primaryDistance)
      ? `${Math.round(primaryDistance)} ${unit} from ${escapeHtml(event.distances[0].name)}`
      : "Worldwide alert";
    const secondaryLocation =
      event.matchedLocation && event.distances?.[0]?.name !== event.matchedLocation.name
        ? `${Math.round(matchedDistance)} ${unit} from ${escapeHtml(event.matchedLocation.name)}`
        : "";
    const severity = severityForMagnitude(event.magnitude);
    const clickable = Boolean(event.entityId || event.url);
    return `
      <article class="quake ${severity} ${clickable ? "clickable" : ""}" data-index="${index}"
        ${clickable ? 'role="button" tabindex="0"' : ""}
        aria-label="Magnitude ${event.magnitude.toFixed(1)} earthquake, ${escapeHtml(event.place)}, ${escapeHtml(
          relativeTime(event.time, locale),
        )}">
        <div class="magnitude" aria-hidden="true">
          <span class="wave wave-one"></span><span class="wave wave-two"></span>
          <span class="mag-number">${event.magnitude.toFixed(1)}</span>
        </div>
        <div class="quake-copy">
          <div class="place">${escapeHtml(event.place)}</div>
          <div class="facts">
            <span><ha-icon icon="mdi:map-marker-distance"></ha-icon>${distanceText}</span>
            ${secondaryLocation ? `<span>${secondaryLocation}</span>` : ""}
            ${this._config.show_depth && depth ? `<span>${escapeHtml(depth)}</span>` : ""}
          </div>
          <div class="meta">
            <span>${escapeHtml(relativeTime(event.time, locale))}</span>
            ${event.status ? `<span>${escapeHtml(event.status)}</span>` : ""}
          </div>
        </div>
        <ha-icon class="chevron" icon="mdi:chevron-right"></ha-icon>
      </article>`;
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;
    const locale = localeFromHass(this._hass);
    const events = this._displayEvents();
    const locations = resolvedLocations(this._config, this._hass);
    const nativeCount = this._nativeEvents().length;
    const sourceLabel = nativeCount && this._config.data_source !== "usgs" ? "HA · USGS" : "USGS feed";
    let content = events.map((event, index) => this._renderEvent(event, index, locale)).join("");
    if (!locations.length) {
      content = `<div class="empty error"><ha-icon icon="mdi:map-marker-alert-outline"></ha-icon><span>Add valid coordinates for at least one location.</span></div>`;
    } else if (!events.length && this._loading) {
      content = `<div class="empty"><span class="loader"></span><span>Loading recent earthquakes…</span></div>`;
    } else if (!events.length && this._fetchError) {
      content = `<div class="empty error"><ha-icon icon="mdi:cloud-alert-outline"></ha-icon><span>${escapeHtml(
        this._fetchError,
      )}</span></div>`;
    } else if (!events.length) {
      content = `<div class="empty clear"><ha-icon icon="mdi:check-circle-outline"></ha-icon><span>No qualifying earthquakes in the last ${escapeHtml(
        this._config.hours,
      )} hours.</span></div>`;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; min-width: 0; }
        ha-card {
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          container-type: inline-size;
          background:
            radial-gradient(circle at 0 0, color-mix(in srgb, var(--error-color, #db4437) 9%, transparent), transparent 38%),
            var(--ha-card-background, var(--card-background-color, #fff));
        }
        .header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 18px 20px 12px;
          color: var(--primary-text-color);
        }
        .header > ha-icon { --mdc-icon-size: 22px; color: var(--error-color, #db4437); }
        .title { min-width: 0; font-size: 18px; font-weight: 700; }
        .count {
          margin-left: auto;
          padding: 3px 8px;
          border-radius: 999px;
          color: var(--secondary-text-color);
          background: color-mix(in srgb, var(--secondary-text-color) 9%, transparent);
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }
        .source {
          margin: 0 20px 12px;
          color: var(--secondary-text-color);
          font-size: 11px;
        }
        .list { display: grid; gap: 7px; padding: 0 12px 13px; }
        .quake {
          --quake-color: var(--info-color, #2196f3);
          position: relative;
          display: grid;
          grid-template-columns: 52px minmax(0, 1fr) 24px;
          align-items: center;
          gap: 12px;
          min-height: 84px;
          padding: 9px 10px;
          border: 1px solid color-mix(in srgb, var(--quake-color) 13%, transparent);
          border-radius: 13px;
          box-sizing: border-box;
          background: linear-gradient(90deg, color-mix(in srgb, var(--quake-color) 8%, transparent), transparent 58%);
          transition: transform 150ms ease, border-color 150ms ease, background 150ms ease;
        }
        .quake.moderate { --quake-color: var(--warning-color, #f5a623); }
        .quake.high { --quake-color: #f57c00; }
        .quake.critical { --quake-color: var(--error-color, #db4437); }
        .quake.clickable { cursor: pointer; }
        .quake.clickable:hover,
        .quake.clickable:focus-visible {
          outline: none;
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--quake-color) 38%, transparent);
          background: linear-gradient(90deg, color-mix(in srgb, var(--quake-color) 13%, transparent), transparent 68%);
        }
        .magnitude {
          position: relative;
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          color: var(--quake-color);
          background: color-mix(in srgb, var(--quake-color) 12%, transparent);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--quake-color) 15%, transparent);
          isolation: isolate;
        }
        .mag-number { position: relative; z-index: 2; font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
        .wave {
          position: absolute;
          inset: 5px;
          z-index: 1;
          border: 1px solid currentColor;
          border-radius: 50%;
          opacity: 0.35;
        }
        ha-card:not(.motion-off) .wave-one { animation: quake-pulse 3.8s ease-out infinite; }
        ha-card:not(.motion-off) .wave-two { animation: quake-pulse 3.8s 1.9s ease-out infinite; }
        @keyframes quake-pulse {
          0% { opacity: 0.55; transform: scale(0.58); }
          70%, 100% { opacity: 0; transform: scale(1.18); }
        }
        .quake-copy { min-width: 0; }
        .place {
          overflow: hidden;
          color: var(--primary-text-color);
          font-size: 14px;
          font-weight: 700;
          line-height: 1.3;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .facts,
        .meta { display: flex; flex-wrap: wrap; gap: 3px 9px; margin-top: 4px; color: var(--secondary-text-color); font-size: 11px; }
        .facts span { display: inline-flex; align-items: center; gap: 4px; }
        .facts ha-icon { --mdc-icon-size: 13px; }
        .meta span + span::before { content: "·"; margin-right: 9px; }
        .chevron { --mdc-icon-size: 20px; color: var(--secondary-text-color); opacity: 0.5; }
        .empty {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 120px;
          padding: 20px;
          color: var(--secondary-text-color);
          text-align: center;
          font-size: 13px;
        }
        .empty ha-icon { --mdc-icon-size: 27px; }
        .empty.clear ha-icon { color: var(--success-color, #43a047); }
        .empty.error ha-icon { color: var(--error-color, #db4437); }
        .loader {
          width: 23px;
          height: 23px;
          border: 2px solid color-mix(in srgb, var(--primary-color) 20%, transparent);
          border-top-color: var(--primary-color);
          border-radius: 50%;
          animation: loader-spin 900ms linear infinite;
        }
        @keyframes loader-spin { to { transform: rotate(360deg); } }
        @container (max-width: 390px) {
          .header { padding-inline: 15px; }
          .source { margin-inline: 15px; }
          .list { padding-inline: 8px; }
          .quake { grid-template-columns: 44px minmax(0, 1fr) 18px; gap: 8px; padding-inline: 8px; }
          .magnitude { width: 42px; height: 42px; }
          .mag-number { font-size: 14px; }
          .facts { display: block; }
          .facts span { display: flex; margin-top: 2px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .quake, .wave, .loader { animation: none !important; transition: none !important; }
        }
      </style>
      <ha-card class="${this._config.animate === false ? "motion-off" : ""}">
        <div class="header">
          <ha-icon icon="mdi:pulse"></ha-icon>
          <span class="title">${escapeHtml(this._config.title)}</span>
          <span class="count">${events.length} alert${events.length === 1 ? "" : "s"}</span>
        </div>
        ${this._config.show_source ? `<div class="source">${escapeHtml(sourceLabel)} · last ${escapeHtml(this._config.hours)}h</div>` : ""}
        <div class="list">${content}</div>
      </ha-card>`;

    const card = this.shadowRoot.querySelector("ha-card");
    card.style.width = String(this._config.card_width || "100%");
    card.style.maxWidth = String(this._config.max_width || "none");
    card.style.marginInline = this._config.max_width && this._config.max_width !== "none" ? "auto" : "";
    const renderedEvents = events;
    this.shadowRoot.querySelectorAll(".quake.clickable").forEach((row) => {
      const activate = () => this._activateEvent(renderedEvents[Number(row.dataset.index)]);
      row.addEventListener("click", activate);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
    });
  }
}

class EarthquakeAlertCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this.shadowRoot.addEventListener("input", (event) => this._handleField(event));
    this.shadowRoot.addEventListener("change", (event) => this._handleField(event));
    this.shadowRoot.addEventListener("click", (event) => this._handleAction(event));
  }

  set hass(hass) {
    this._hass = hass;
  }

  setConfig(config) {
    const active = this.shadowRoot.activeElement?.matches?.("[data-field], [data-location], [data-threshold]");
    this._config = clone(config || EarthquakeAlertCard.getStubConfig(this._hass));
    if (!Array.isArray(this._config.locations)) this._config.locations = [];
    if (!Array.isArray(this._config.thresholds)) this._config.thresholds = clone(DEFAULT_THRESHOLDS);
    if (!active) this._render();
  }

  _emit() {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: clone(this._config) },
        bubbles: true,
        composed: true,
      }),
    );
  }

  _handleField(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (event.type === "input" && (target.type === "checkbox" || target.tagName === "SELECT")) return;
    if (event.type === "change" && target.type !== "checkbox" && target.tagName !== "SELECT") return;
    let value = target.type === "checkbox" ? target.checked : target.value;
    if (target.type === "number") value = value === "" ? null : Number(value);
    if (target.dataset.field) {
      this._config[target.dataset.field] = value;
    } else if (target.dataset.location) {
      const location = this._config.locations[Number(target.dataset.index)];
      if (!location) return;
      if (value === "" || value === null) delete location[target.dataset.location];
      else location[target.dataset.location] = value;
    } else if (target.dataset.threshold) {
      const threshold = this._config.thresholds[Number(target.dataset.index)];
      if (!threshold) return;
      threshold[target.dataset.threshold] = value;
    }
    this._emit();
    if (target.dataset.location === "use_home_coordinates") this._render();
  }

  _handleAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const index = Number(button.dataset.index);
    if (action === "add-location") {
      this._config.locations.push({ name: "New location", latitude: null, longitude: null });
    } else if (action === "remove-location" && this._config.locations.length > 1) {
      this._config.locations.splice(index, 1);
    } else if (action === "add-threshold") {
      this._config.thresholds.push({ magnitude: 4, distance: 100 });
    } else if (action === "remove-threshold" && this._config.thresholds.length > 1) {
      this._config.thresholds.splice(index, 1);
    }
    this._emit();
    this._render();
  }

  _locationEditor(location, index) {
    const home = location.use_home_coordinates === true;
    return `<section>
      <div class="section-title"><span>Location ${index + 1}</span><button class="icon" data-action="remove-location" data-index="${index}" ${
        this._config.locations.length <= 1 ? "disabled" : ""
      }><ha-icon icon="mdi:delete-outline"></ha-icon></button></div>
      <div class="grid">
        <label class="wide">Name<input data-location="name" data-index="${index}" value="${escapeHtml(location.name || "")}" placeholder="Home"></label>
        <label class="check wide"><input type="checkbox" data-location="use_home_coordinates" data-index="${index}" ${home ? "checked" : ""}>Use Home Assistant home coordinates</label>
        <label>Latitude<input type="number" step="any" min="-90" max="90" data-location="latitude" data-index="${index}" value="${escapeHtml(
          location.latitude ?? "",
        )}" ${home ? "disabled" : ""}></label>
        <label>Longitude<input type="number" step="any" min="-180" max="180" data-location="longitude" data-index="${index}" value="${escapeHtml(
          location.longitude ?? "",
        )}" ${home ? "disabled" : ""}></label>
      </div>
    </section>`;
  }

  _thresholdEditor(threshold, index, unit) {
    return `<section class="threshold">
      <div class="section-title"><span>Threshold ${index + 1}</span><button class="icon" data-action="remove-threshold" data-index="${index}" ${
        this._config.thresholds.length <= 1 ? "disabled" : ""
      }><ha-icon icon="mdi:delete-outline"></ha-icon></button></div>
      <div class="grid">
        <label>Minimum magnitude<input type="number" step="0.1" min="0" max="10" data-threshold="magnitude" data-index="${index}" value="${escapeHtml(
          threshold.magnitude ?? "",
        )}"></label>
        <label>Maximum distance (${unit}; blank = worldwide)<input type="number" step="1" min="0" data-threshold="distance" data-index="${index}" value="${escapeHtml(
          threshold.distance ?? "",
        )}"></label>
      </div>
    </section>`;
  }

  _render() {
    if (!this._config) return;
    const config = { ...DEFAULT_CONFIG, ...this._config };
    const unit = config.distance_unit === "km" ? "km" : "mi";
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; color: var(--primary-text-color); font-family: Roboto, sans-serif; }
        * { box-sizing: border-box; }
        .note { margin: 0 0 16px; padding: 12px; border-radius: 10px; color: var(--secondary-text-color); background: color-mix(in srgb, var(--primary-color) 7%, transparent); font-size: 13px; line-height: 1.4; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        label { display: grid; gap: 5px; color: var(--secondary-text-color); font-size: 12px; font-weight: 500; }
        label.wide { grid-column: 1 / -1; }
        label.check { display: flex; align-items: center; gap: 8px; min-height: 36px; color: var(--primary-text-color); font-size: 14px; font-weight: 400; }
        input:not([type="checkbox"]), select { width: 100%; min-height: 42px; padding: 8px 10px; border: 1px solid var(--divider-color); border-radius: 8px; outline: none; color: var(--primary-text-color); background: var(--card-background-color); font: inherit; font-size: 14px; }
        input:focus, select:focus { border-color: var(--primary-color); }
        input:disabled { opacity: 0.5; }
        input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--primary-color); }
        h3 { margin: 20px 0 8px; font-size: 16px; }
        section { margin-top: 12px; padding: 13px; border: 1px solid var(--divider-color); border-radius: 12px; }
        .section-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; font-size: 14px; font-weight: 700; }
        button { display: inline-flex; align-items: center; justify-content: center; min-height: 38px; padding: 0 14px; border: 0; border-radius: 9px; color: var(--text-primary-color, white); background: var(--primary-color); font: inherit; font-weight: 700; cursor: pointer; }
        button:disabled { opacity: 0.35; cursor: default; }
        button.icon { width: 34px; min-height: 34px; padding: 0; color: var(--secondary-text-color); background: transparent; }
        button.icon ha-icon { --mdc-icon-size: 19px; }
        .add { display: flex; justify-content: flex-end; margin-top: 10px; }
        @media (max-width: 430px) { .grid { grid-template-columns: 1fr; } label.wide { grid-column: auto; } }
      </style>
      <p class="note"><strong>Auto</strong> uses Home Assistant USGS geo-location entities when available, otherwise it loads the official USGS past-day M2.5+ feed directly.</p>
      <div class="grid">
        <label class="wide">Card title<input data-field="title" value="${escapeHtml(config.title)}"></label>
        <label>Data source<select data-field="data_source"><option value="auto" ${config.data_source === "auto" ? "selected" : ""}>Automatic</option><option value="native" ${
          config.data_source === "native" ? "selected" : ""
        }>Home Assistant</option><option value="usgs" ${config.data_source === "usgs" ? "selected" : ""}>Direct USGS</option></select></label>
        <label>Distance unit<select data-field="distance_unit"><option value="mi" ${unit === "mi" ? "selected" : ""}>Miles</option><option value="km" ${unit === "km" ? "selected" : ""}>Kilometers</option></select></label>
        <label>History (hours)<input type="number" min="1" max="720" data-field="hours" value="${escapeHtml(config.hours)}"></label>
        <label>Maximum alerts<input type="number" min="1" max="50" data-field="max_items" value="${escapeHtml(config.max_items)}"></label>
        <label>Direct-feed update (minutes)<input type="number" min="5" max="1440" data-field="update_interval" value="${escapeHtml(config.update_interval)}"></label>
        <label>Card width<input data-field="card_width" value="${escapeHtml(config.card_width)}"></label>
        <label>Maximum width<input data-field="max_width" value="${escapeHtml(config.max_width)}"></label>
        <label class="check"><input type="checkbox" data-field="show_depth" ${config.show_depth ? "checked" : ""}>Show depth</label>
        <label class="check"><input type="checkbox" data-field="show_source" ${config.show_source ? "checked" : ""}>Show data source</label>
        <label class="check"><input type="checkbox" data-field="animate" ${config.animate !== false ? "checked" : ""}>Animate magnitude pulses</label>
      </div>
      <h3>Locations</h3>
      ${this._config.locations.map((location, index) => this._locationEditor(location, index)).join("")}
      <div class="add"><button data-action="add-location"><ha-icon icon="mdi:plus"></ha-icon>&nbsp;Add location</button></div>
      <h3>Alert thresholds</h3>
      ${this._config.thresholds.map((threshold, index) => this._thresholdEditor(threshold, index, unit)).join("")}
      <div class="add"><button data-action="add-threshold"><ha-icon icon="mdi:plus"></ha-icon>&nbsp;Add threshold</button></div>`;
  }
}

if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, EarthquakeAlertCardEditor);
if (!customElements.get(CARD_TAG)) customElements.define(CARD_TAG, EarthquakeAlertCard);

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: "Earthquake Alert Card",
    description: "Location-aware USGS earthquake alerts with configurable magnitude and distance bands.",
    preview: true,
  });
}

console.info(
  `%c EARTHQUAKE-ALERT-CARD %c ${VERSION} `,
  "color:white;background:#d84315;font-weight:700",
  "color:#d84315;background:white",
);

export {
  DEFAULT_THRESHOLDS,
  distanceKm,
  normalizeGeoJsonFeature,
  normalizeNativeEvent,
  qualifyEvent,
  severityForMagnitude,
};
