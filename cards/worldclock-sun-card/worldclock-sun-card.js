const CARD_TAG = "worldclock-sun-card";
const EDITOR_TAG = "worldclock-sun-card-editor";
const CARD_VERSION = "1.4.2";
const CARD_BASE_URL = new URL(".", import.meta.url);

const DEFAULT_CONFIG = Object.freeze({
  title: "World Clock",
  time_format: "auto",
  date_format: "full",
  show_seconds: false,
  show_timezone: true,
  show_daylight_label: true,
  animate_icons: true,
  prefer_entity_time: true,
  card_width: "100%",
  max_width: "none",
  row_height: 82,
});

const COMMON_TIME_ZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];

const DATE_OPTIONS = Object.freeze({
  short: { month: "short", day: "numeric" },
  medium: { weekday: "short", month: "short", day: "numeric" },
  long: { weekday: "long", month: "long", day: "numeric" },
  full: { weekday: "long", year: "numeric", month: "long", day: "numeric" },
});

function cloneConfig(value) {
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

function normalizeFlagCode(value) {
  const flag = String(value ?? "").trim();
  if (/^[a-z]{2}$/i.test(flag)) return flag.toLowerCase();

  const regionalIndicators = [...flag];
  if (
    regionalIndicators.length === 2 &&
    regionalIndicators.every((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff;
    })
  ) {
    return regionalIndicators
      .map((character) => String.fromCharCode(character.codePointAt(0) - 0x1f1e6 + 97))
      .join("");
  }
  return "";
}

function getFlagUrl(value) {
  const code = normalizeFlagCode(value);
  return code ? new URL(`flags/${code}.svg`, CARD_BASE_URL).href : "";
}

function toFiniteNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value) {
  return (value * 180) / Math.PI;
}

/**
 * Calculate the Sun's geometric elevation for a UTC instant and coordinates.
 * Equations follow the NOAA/Meeus solar-position method. A value of -0.833°
 * is used by getSolarState for apparent sunrise and sunset.
 */
function calculateSolarElevation(date, latitude, longitude) {
  const lat = toFiniteNumber(latitude);
  const lon = toFiniteNumber(longitude);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return Number.NaN;
  if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return Number.NaN;
  }

  const julianDay = date.getTime() / 86400000 + 2440587.5;
  const julianCentury = (julianDay - 2451545.0) / 36525;

  const geomMeanLong = normalizeDegrees(
    280.46646 + julianCentury * (36000.76983 + julianCentury * 0.0003032),
  );
  const geomMeanAnomaly =
    357.52911 + julianCentury * (35999.05029 - 0.0001537 * julianCentury);
  const eccentricity =
    0.016708634 - julianCentury * (0.000042037 + 0.0000001267 * julianCentury);

  const anomalyRad = degreesToRadians(geomMeanAnomaly);
  const equationOfCenter =
    Math.sin(anomalyRad) *
      (1.914602 - julianCentury * (0.004817 + 0.000014 * julianCentury)) +
    Math.sin(2 * anomalyRad) * (0.019993 - 0.000101 * julianCentury) +
    Math.sin(3 * anomalyRad) * 0.000289;

  const trueLongitude = geomMeanLong + equationOfCenter;
  const omega = 125.04 - 1934.136 * julianCentury;
  const apparentLongitude =
    trueLongitude - 0.00569 - 0.00478 * Math.sin(degreesToRadians(omega));

  const meanObliquity =
    23 +
    (26 +
      (21.448 -
        julianCentury *
          (46.815 + julianCentury * (0.00059 - julianCentury * 0.001813))) /
        60) /
      60;
  const obliquityCorrection =
    meanObliquity + 0.00256 * Math.cos(degreesToRadians(omega));

  const obliquityRad = degreesToRadians(obliquityCorrection);
  const apparentLongitudeRad = degreesToRadians(apparentLongitude);
  const declination = Math.asin(
    Math.sin(obliquityRad) * Math.sin(apparentLongitudeRad),
  );

  const y = Math.tan(obliquityRad / 2) ** 2;
  const geomMeanLongRad = degreesToRadians(geomMeanLong);
  const equationOfTime =
    4 *
    radiansToDegrees(
      y * Math.sin(2 * geomMeanLongRad) -
        2 * eccentricity * Math.sin(anomalyRad) +
        4 * eccentricity * y * Math.sin(anomalyRad) * Math.cos(2 * geomMeanLongRad) -
        0.5 * y * y * Math.sin(4 * geomMeanLongRad) -
        1.25 * eccentricity * eccentricity * Math.sin(2 * anomalyRad),
    );

  const utcMinutes =
    date.getUTCHours() * 60 +
    date.getUTCMinutes() +
    date.getUTCSeconds() / 60 +
    date.getUTCMilliseconds() / 60000;
  let trueSolarMinutes = (utcMinutes + equationOfTime + 4 * lon) % 1440;
  if (trueSolarMinutes < 0) trueSolarMinutes += 1440;

  let hourAngle = trueSolarMinutes / 4 - 180;
  if (hourAngle < -180) hourAngle += 360;
  const hourAngleRad = degreesToRadians(hourAngle);
  const latitudeRad = degreesToRadians(lat);
  const cosZenith =
    Math.sin(latitudeRad) * Math.sin(declination) +
    Math.cos(latitudeRad) * Math.cos(declination) * Math.cos(hourAngleRad);
  const zenith = Math.acos(Math.min(1, Math.max(-1, cosZenith)));
  return 90 - radiansToDegrees(zenith);
}

function getSolarState(date, latitude, longitude) {
  const elevation = calculateSolarElevation(date, latitude, longitude);
  if (!Number.isFinite(elevation)) {
    return { state: "unknown", elevation: Number.NaN };
  }
  return {
    state: elevation >= -0.833 ? "day" : "night",
    elevation,
  };
}

function resolveLocale(hass) {
  return hass?.locale?.language || hass?.language || globalThis.navigator?.language || "en-US";
}

function resolveTimeZone(location, hass) {
  return String(location.timezone || location.time_zone || hass?.config?.time_zone || "UTC");
}

function resolveCoordinates(location, hass) {
  let latitude = toFiniteNumber(location.latitude);
  let longitude = toFiniteNumber(location.longitude);
  const useHome = location.use_home_coordinates === true;
  const timeZone = resolveTimeZone(location, hass);
  const matchesHomeZone = timeZone === hass?.config?.time_zone;

  if (useHome || ((latitude === null || longitude === null) && matchesHomeZone)) {
    latitude = toFiniteNumber(hass?.config?.latitude);
    longitude = toFiniteNumber(hass?.config?.longitude);
  }

  const valid =
    latitude !== null &&
    longitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
  return { latitude, longitude, valid };
}

function formatZonedTime(date, timeZone, locale, config = {}) {
  const options = {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  };
  if (config.show_seconds) options.second = "2-digit";
  if (config.time_format === "12") options.hour12 = true;
  if (config.time_format === "24") options.hour12 = false;
  return new Intl.DateTimeFormat(locale, options).format(date);
}

function formatZonedDate(date, timeZone, locale, dateFormat = "full") {
  const options = DATE_OPTIONS[dateFormat] || DATE_OPTIONS.full;
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date);
}

function formatTimeZoneName(date, timeZone, locale) {
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    timeZoneName: "short",
  });
  return formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value || timeZone;
}

function isUsableEntityState(stateObj) {
  return Boolean(
    stateObj &&
      stateObj.state &&
      stateObj.state !== "unknown" &&
      stateObj.state !== "unavailable",
  );
}

class WorldclockSunCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._timer = null;
  }

  static getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    return {
      title: "World Clock",
      time_format: "auto",
      date_format: "full",
      show_timezone: true,
      show_daylight_label: true,
      card_width: "100%",
      locations: [
        {
          name: "Home",
          timezone: hass?.config?.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          use_home_coordinates: true,
        },
      ],
    };
  }

  static getGridOptions() {
    return { columns: 6, min_columns: 3, rows: 3, min_rows: 2 };
  }

  setConfig(config) {
    if (!config || typeof config !== "object") {
      throw new Error("Worldclock Sun Card requires a configuration object.");
    }
    if (!Array.isArray(config.locations) || config.locations.length === 0) {
      throw new Error("Worldclock Sun Card requires at least one location.");
    }

    this._config = {
      ...DEFAULT_CONFIG,
      ...cloneConfig(config),
      locations: config.locations.map((location) => ({ ...location })),
    };
    this._scheduleUpdate();
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return Math.max(2, Math.ceil((this._config?.locations?.length || 1) * 1.25 + 1));
  }

  getGridOptions() {
    const rows = Math.max(2, (this._config?.locations?.length || 1) + (this._config?.title ? 1 : 0));
    return { columns: 6, min_columns: 3, rows, min_rows: 2 };
  }

  connectedCallback() {
    this._scheduleUpdate();
    this._render();
  }

  disconnectedCallback() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
  }

  _scheduleUpdate() {
    if (this._timer) clearTimeout(this._timer);
    if (!this.isConnected || !this._config) return;
    const interval = this._config.show_seconds ? 1000 : 60000;
    const delay = interval - (Date.now() % interval) + 40;
    this._timer = setTimeout(() => {
      this._render();
      this._scheduleUpdate();
    }, delay);
  }

  _openMoreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  _renderSolarArtwork(state, index, fallbackIcon) {
    if (state === "day") {
      return `
        <svg class="solar-svg sun-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <circle class="sun-halo" cx="32" cy="32" r="21"></circle>
          <g class="sun-rays">
            <path d="M32 3v8"></path>
            <path d="M32 53v8"></path>
            <path d="M3 32h8"></path>
            <path d="M53 32h8"></path>
            <path d="m11.5 11.5 5.7 5.7"></path>
            <path d="m46.8 46.8 5.7 5.7"></path>
            <path d="m52.5 11.5-5.7 5.7"></path>
            <path d="m17.2 46.8-5.7 5.7"></path>
          </g>
          <circle class="sun-core" cx="32" cy="32" r="13"></circle>
          <circle class="sun-glint" cx="27.5" cy="27" r="3.2"></circle>
          <circle class="sun-ring" cx="32" cy="32" r="17"></circle>
        </svg>`;
    }

    if (state === "night") {
      const maskId = `worldclock-moon-mask-${index}`;
      return `
        <svg class="solar-svg moon-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <defs>
            <mask id="${maskId}">
              <rect width="64" height="64" fill="white"></rect>
              <circle cx="39" cy="23" r="20" fill="black"></circle>
            </mask>
          </defs>
          <circle class="moon-crescent" cx="29" cy="32" r="20" mask="url(#${maskId})"></circle>
          <circle class="moon-sheen" cx="24" cy="30" r="17" mask="url(#${maskId})"></circle>
          <circle class="moon-crater crater-one" cx="20" cy="27" r="2.2"></circle>
          <circle class="moon-crater crater-two" cx="26" cy="42" r="1.6"></circle>
          <circle class="moon-star star-one" cx="49" cy="15" r="2"></circle>
          <circle class="moon-star star-two" cx="54" cy="28" r="1.4"></circle>
          <path class="moon-star star-three" d="M45 37l1.2 2.8L49 41l-2.8 1.2L45 45l-1.2-2.8L41 41l2.8-1.2z"></path>
        </svg>`;
    }

    return `<ha-icon icon="${fallbackIcon}"></ha-icon>`;
  }

  _renderLocation(location, index, now, locale) {
    const entityId = location.entity ? String(location.entity) : "";
    const stateObj = entityId ? this._hass?.states?.[entityId] : null;
    const name =
      location.name || stateObj?.attributes?.friendly_name || entityId || `Location ${index + 1}`;
    const flagCode = normalizeFlagCode(location.flag);
    const flagUrl = getFlagUrl(location.flag);
    const timeZone = resolveTimeZone(location, this._hass);
    const coordinates = resolveCoordinates(location, this._hass);

    let time = "—";
    let date = "Invalid time zone";
    let zoneName = timeZone;
    let timeZoneValid = true;
    try {
      time =
        this._config.prefer_entity_time !== false && isUsableEntityState(stateObj)
          ? stateObj.state
          : formatZonedTime(now, timeZone, locale, this._config);
      date = formatZonedDate(now, timeZone, locale, this._config.date_format);
      zoneName = formatTimeZoneName(now, timeZone, locale);
    } catch (_error) {
      timeZoneValid = false;
    }

    const solar = coordinates.valid
      ? getSolarState(now, coordinates.latitude, coordinates.longitude)
      : { state: "unknown", elevation: Number.NaN };
    const isDay = solar.state === "day";
    const isNight = solar.state === "night";
    const statusLabel = isDay ? "Sun up" : isNight ? "Sun down" : "Coordinates needed";
    const icon = isDay
      ? "mdi:weather-sunny"
      : isNight
        ? "mdi:weather-night"
        : "mdi:map-marker-alert-outline";
    const tooltip = Number.isFinite(solar.elevation)
      ? `${statusLabel} · solar elevation ${solar.elevation.toFixed(1)}°`
      : "Add latitude and longitude for the daylight icon";
    const sourceFallback = Boolean(entityId && !isUsableEntityState(stateObj));
    const rowClass = [
      "location-row",
      solar.state,
      entityId ? "interactive" : "",
      !timeZoneValid ? "error" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return `
      <div class="${rowClass}" data-entity="${escapeHtml(entityId)}"
        ${entityId ? 'role="button" tabindex="0"' : ""}
        aria-label="${escapeHtml(`${name}, ${time}, ${date}, ${statusLabel}`)}">
        <div class="icons">
          ${
            flagUrl
              ? `<img class="flag" src="${escapeHtml(flagUrl)}" alt="${escapeHtml(
                  `${flagCode.toUpperCase()} flag`,
                )}" title="${escapeHtml(`${flagCode.toUpperCase()} flag`)}" loading="eager" decoding="async">`
              : ""
          }
          <div class="celestial ${solar.state}" title="${escapeHtml(tooltip)}">
            <span class="glow"></span>
            ${this._renderSolarArtwork(solar.state, index, icon)}
          </div>
        </div>
        <div class="place">
          <div class="place-line">
            <span class="place-name">${escapeHtml(name)}</span>
            ${
              this._config.show_timezone
                ? `<span class="zone" title="${escapeHtml(timeZone)}">${escapeHtml(zoneName)}</span>`
                : ""
            }
          </div>
          <div class="date">${escapeHtml(date)}</div>
          ${
            this._config.show_daylight_label
              ? `<div class="solar-label">${escapeHtml(statusLabel)}${
                  sourceFallback ? " · entity unavailable, using local clock" : ""
                }</div>`
              : ""
          }
        </div>
        <div class="time" title="${escapeHtml(timeZone)}">${escapeHtml(time)}</div>
      </div>`;
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;
    const now = new Date();
    const locale = resolveLocale(this._hass);
    const rows = this._config.locations
      .map((location, index) => this._renderLocation(location, index, now, locale))
      .join("");
    const title = this._config.title
      ? `<div class="header"><ha-icon icon="mdi:earth"></ha-icon><span>${escapeHtml(
          this._config.title,
        )}</span></div>`
      : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          min-width: 0;
        }
        ha-card {
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          container-type: inline-size;
          background:
            radial-gradient(circle at 0 0, color-mix(in srgb, var(--primary-color) 13%, transparent), transparent 42%),
            linear-gradient(145deg, color-mix(in srgb, var(--primary-text-color) 2%, transparent), transparent 48%),
            var(--ha-card-background, var(--card-background-color, #fff));
        }
        ha-card::before {
          content: "";
          position: absolute;
          inset: 0 0 auto;
          height: 1px;
          pointer-events: none;
          background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--primary-color) 45%, transparent), transparent);
          opacity: 0.7;
        }
        .header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 19px 20px 13px;
          color: var(--primary-text-color);
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .header ha-icon {
          --mdc-icon-size: 20px;
          color: var(--primary-color);
          filter: drop-shadow(0 0 7px color-mix(in srgb, var(--primary-color) 36%, transparent));
        }
        .locations {
          padding: 0 12px 13px;
        }
        .location-row {
          position: relative;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 13px;
          min-height: var(--worldclock-row-height, 82px);
          margin-top: 4px;
          padding: 0 11px;
          border: 1px solid transparent;
          border-radius: 13px;
          box-sizing: border-box;
          background: color-mix(in srgb, var(--primary-text-color) 1.5%, transparent);
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 150ms ease;
        }
        .location-row:first-child {
          margin-top: 0;
        }
        .location-row.day {
          background: linear-gradient(90deg, color-mix(in srgb, var(--warning-color, #f5a623) 5%, transparent), transparent 43%);
        }
        .location-row.night {
          background: linear-gradient(90deg, color-mix(in srgb, var(--indigo-color, #7986cb) 6%, transparent), transparent 43%);
        }
        .location-row.interactive {
          cursor: pointer;
        }
        .location-row.interactive:hover,
        .location-row.interactive:focus-visible {
          outline: none;
          border-color: color-mix(in srgb, var(--primary-color) 18%, transparent);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-color) 4%, transparent);
        }
        .location-row.interactive:active {
          transform: scale(0.995);
        }
        .icons {
          display: flex;
          align-items: center;
          gap: 9px;
        }
        .flag {
          display: block;
          width: 31px;
          height: 23.25px;
          border: 1px solid color-mix(in srgb, var(--secondary-text-color) 22%, transparent);
          border-radius: 5px;
          box-sizing: border-box;
          object-fit: cover;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.18);
        }
        .flag.missing {
          display: none;
        }
        .celestial {
          position: relative;
          display: grid;
          place-items: center;
          width: 46px;
          height: 46px;
          border-radius: 50%;
          isolation: isolate;
        }
        .celestial .glow {
          position: absolute;
          inset: 5px;
          z-index: -1;
          border-radius: inherit;
          opacity: 0.28;
          filter: blur(8px);
        }
        .celestial ha-icon,
        .solar-svg {
          --mdc-icon-size: 32px;
          position: relative;
          z-index: 1;
          display: block;
          width: 34px;
          height: 34px;
          overflow: visible;
        }
        .celestial.day {
          color: var(--warning-color, #f5a623);
          background:
            radial-gradient(circle, color-mix(in srgb, var(--warning-color, #f5a623) 20%, transparent), transparent 68%),
            color-mix(in srgb, var(--warning-color, #f5a623) 10%, transparent);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning-color, #f5a623) 12%, transparent);
        }
        .celestial.day .glow {
          background: var(--warning-color, #f5a623);
        }
        .celestial.night {
          color: var(--indigo-color, #7986cb);
          background:
            radial-gradient(circle at 65% 32%, color-mix(in srgb, white 8%, transparent), transparent 34%),
            color-mix(in srgb, var(--indigo-color, #7986cb) 13%, transparent);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--indigo-color, #7986cb) 12%, transparent);
        }
        .celestial.night .glow {
          background: var(--indigo-color, #7986cb);
        }
        .celestial.unknown {
          color: var(--secondary-text-color);
          background: color-mix(in srgb, var(--secondary-text-color) 10%, transparent);
        }
        .sun-rays {
          fill: none;
          stroke: currentColor;
          stroke-width: 3.6;
          stroke-linecap: round;
          transform-box: view-box;
          transform-origin: 32px 32px;
        }
        .sun-core { fill: currentColor; transform-box: fill-box; transform-origin: center; }
        .sun-halo {
          fill: color-mix(in srgb, currentColor 12%, transparent);
          stroke: color-mix(in srgb, currentColor 24%, transparent);
          stroke-width: 1;
          transform-box: fill-box;
          transform-origin: center;
        }
        .sun-glint { fill: color-mix(in srgb, white 58%, transparent); }
        .sun-ring {
          fill: none;
          stroke: color-mix(in srgb, white 28%, transparent);
          stroke-width: 1.2;
          stroke-linecap: round;
          stroke-dasharray: 12 95;
          transform-box: view-box;
          transform-origin: 32px 32px;
        }
        .moon-crescent { fill: currentColor; }
        .moon-sheen {
          fill: color-mix(in srgb, white 24%, transparent);
          transform-box: view-box;
          transform-origin: center;
        }
        .moon-crater {
          fill: color-mix(in srgb, var(--card-background-color, #111) 24%, transparent);
          opacity: 0.55;
        }
        .moon-star {
          fill: currentColor;
          filter: drop-shadow(0 0 2px currentColor);
          transform-box: fill-box;
          transform-origin: center;
        }
        ha-card:not(.motion-off) .sun-rays {
          animation: worldclock-sun-rays 10s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        ha-card:not(.motion-off) .sun-core {
          animation: worldclock-sun-core 10s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        ha-card:not(.motion-off) .sun-halo {
          animation: worldclock-sun-halo 10s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        ha-card:not(.motion-off) .sun-ring {
          animation: worldclock-sun-ring 10s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        ha-card:not(.motion-off) .celestial.day .glow {
          animation: worldclock-sun-glow 10s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        ha-card:not(.motion-off) .moon-sheen {
          animation: worldclock-moon-sheen 12s ease-in-out infinite;
        }
        ha-card:not(.motion-off) .celestial.night .glow {
          animation: worldclock-moon-glow 9s ease-in-out infinite;
        }
        ha-card:not(.motion-off) .moon-star.star-one {
          animation: worldclock-star-twinkle 5.5s ease-in-out infinite;
        }
        ha-card:not(.motion-off) .moon-star.star-two {
          animation: worldclock-star-twinkle 7.2s 1.4s ease-in-out infinite;
        }
        ha-card:not(.motion-off) .moon-star.star-three {
          animation: worldclock-star-twinkle 6.4s 2.2s ease-in-out infinite;
        }
        @keyframes worldclock-sun-rays {
          0%, 100% { opacity: 0.72; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.03); }
        }
        @keyframes worldclock-sun-core {
          0%, 100% { transform: scale(0.94); }
          50% { transform: scale(1.03); }
        }
        @keyframes worldclock-sun-halo {
          0%, 100% { opacity: 0.42; transform: scale(0.9); }
          50% { opacity: 0.9; transform: scale(1.05); }
        }
        @keyframes worldclock-sun-ring {
          0%, 100% { opacity: 0.18; transform: scale(0.94); }
          50% { opacity: 0.72; transform: scale(1.03); }
        }
        @keyframes worldclock-sun-glow {
          0%, 100% { opacity: 0.2; transform: scale(0.88); }
          50% { opacity: 0.48; transform: scale(1.16); }
        }
        @keyframes worldclock-moon-sheen {
          0%, 100% { opacity: 0.08; transform: translateX(-4px); }
          50% { opacity: 0.3; transform: translateX(5px); }
        }
        @keyframes worldclock-moon-glow {
          0%, 100% { opacity: 0.18; transform: scale(0.92); }
          50% { opacity: 0.42; transform: scale(1.12); }
        }
        @keyframes worldclock-star-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.7); }
          50% { opacity: 1; transform: scale(1.35); }
        }
        .place {
          min-width: 0;
          padding: 9px 0;
        }
        .place-line {
          display: flex;
          align-items: baseline;
          gap: 8px;
          min-width: 0;
        }
        .place-name {
          overflow: hidden;
          color: var(--primary-text-color);
          font-size: 15px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .zone {
          flex: 0 0 auto;
          color: var(--secondary-text-color);
          padding: 2px 5px;
          border-radius: 5px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          background: color-mix(in srgb, var(--secondary-text-color) 8%, transparent);
        }
        .date {
          overflow: hidden;
          margin-top: 3px;
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.25;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .solar-label {
          margin-top: 2px;
          color: var(--secondary-text-color);
          font-size: 11px;
          line-height: 1.2;
          opacity: 0.82;
        }
        .location-row.day .solar-label { color: var(--warning-color, #f5a623); }
        .location-row.night .solar-label { color: var(--indigo-color, #7986cb); }
        .time {
          color: var(--primary-text-color);
          font-size: clamp(24px, 7.5cqi, 32px);
          font-variant-numeric: tabular-nums;
          font-weight: 320;
          letter-spacing: -0.045em;
          line-height: 1;
          text-align: right;
          white-space: nowrap;
        }
        .location-row.error .date {
          color: var(--error-color, #db4437);
        }
        @container (max-width: 380px) {
          .location-row {
            grid-template-columns: auto minmax(0, 1fr) auto;
            gap: 8px;
            padding-inline: 6px;
          }
          .celestial {
            width: 40px;
            height: 40px;
          }
          .celestial ha-icon {
            --mdc-icon-size: 27px;
          }
          .solar-svg {
            width: 30px;
            height: 30px;
          }
          .icons { gap: 5px; }
          .flag {
            width: 24px;
            height: 18px;
          }
          .time {
            font-size: 22px;
          }
          .zone,
          .solar-label {
            display: none;
          }
          .date {
            font-size: 12px;
          }
        }
        @container (max-width: 290px) {
          .location-row {
            grid-template-columns: auto minmax(0, 1fr);
          }
          .time {
            grid-column: 2;
            margin-top: -20px;
            font-size: 18px;
          }
          .date {
            padding-right: 72px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .location-row,
          .celestial,
          .celestial ha-icon,
          .solar-svg *,
          .celestial .glow,
          .moon-star {
            transition: none;
            animation: none !important;
          }
        }
      </style>
      <ha-card class="${this._config.animate_icons === false ? "motion-off" : ""}">
        ${title}
        <div class="locations">${rows}</div>
      </ha-card>`;

    const card = this.shadowRoot.querySelector("ha-card");
    card.style.width = String(this._config.card_width || "100%");
    card.style.maxWidth = String(this._config.max_width || "none");
    card.style.marginInline = this._config.max_width && this._config.max_width !== "none" ? "auto" : "";
    if (this._config.min_height) card.style.minHeight = String(this._config.min_height);
    const rowHeight = Math.max(58, Math.min(160, Number(this._config.row_height) || 82));
    card.style.setProperty("--worldclock-row-height", `${rowHeight}px`);

    this.shadowRoot.querySelectorAll(".location-row.interactive").forEach((row) => {
      const open = () => this._openMoreInfo(row.dataset.entity);
      row.addEventListener("click", open);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });
    this.shadowRoot.querySelectorAll("img.flag").forEach((flag) => {
      flag.addEventListener("error", () => flag.classList.add("missing"), { once: true });
    });
  }
}

class WorldclockSunCardEditor extends HTMLElement {
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
    const activeField = this.shadowRoot.activeElement?.matches?.(
      "[data-config-field], [data-location-field]",
    );
    this._config = cloneConfig(config || WorldclockSunCard.getStubConfig(this._hass));
    if (!Array.isArray(this._config.locations)) this._config.locations = [];
    // Home Assistant echoes config-changed back through setConfig. Rebuilding
    // the editor while a field is active would discard focus and the caret.
    if (!activeField) this._render();
  }

  _emitConfig() {
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
    if (event.type === "input" && (target.type === "checkbox" || target.tagName === "SELECT")) return;
    if (event.type === "change" && target.type !== "checkbox" && target.tagName !== "SELECT") return;

    const globalField = target.dataset.configField;
    const locationField = target.dataset.locationField;
    let value = target.type === "checkbox" ? target.checked : target.value;
    if (target.type === "number") value = value === "" ? undefined : Number(value);

    if (globalField) {
      if (value === "") delete this._config[globalField];
      else this._config[globalField] = value;
      this._emitConfig();
      return;
    }

    if (locationField) {
      const index = Number(target.dataset.index);
      if (!Number.isInteger(index) || !this._config.locations[index]) return;
      if (value === undefined || (value === "" && ["entity", "latitude", "longitude"].includes(locationField))) {
        delete this._config.locations[index][locationField];
      } else {
        this._config.locations[index][locationField] = value;
      }
      this._emitConfig();
      if (locationField === "use_home_coordinates") this._render();
    }
  }

  _handleAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "add") {
      this._config.locations.push({
        name: "New location",
        timezone: this._hass?.config?.time_zone || "UTC",
        latitude: "",
        longitude: "",
      });
    } else if (action === "remove") {
      const index = Number(button.dataset.index);
      if (this._config.locations.length > 1) this._config.locations.splice(index, 1);
    }
    this._emitConfig();
    this._render();
  }

  _renderLocationEditor(location, index) {
    const useHome = location.use_home_coordinates === true;
    return `
      <section class="location-editor">
        <div class="section-title">
          <span>Location ${index + 1}</span>
          <button class="icon-button" data-action="remove" data-index="${index}"
            ${this._config.locations.length <= 1 ? "disabled" : ""} title="Remove location">
            <ha-icon icon="mdi:delete-outline"></ha-icon>
          </button>
        </div>
        <div class="grid">
          <label>Name
            <input data-location-field="name" data-index="${index}" value="${escapeHtml(location.name || "")}" placeholder="London">
          </label>
          <label>Country flag (optional)
            <input data-location-field="flag" data-index="${index}" value="${escapeHtml(
              location.flag || "",
            )}" placeholder="GB" maxlength="8">
          </label>
          <label class="wide">IANA time zone
            <input data-location-field="timezone" data-index="${index}" value="${escapeHtml(
              location.timezone || location.time_zone || "",
            )}" list="worldclock-zones" placeholder="Europe/London" spellcheck="false">
          </label>
          <label class="wide">Worldclock entity (optional)
            <input data-location-field="entity" data-index="${index}" value="${escapeHtml(
              location.entity || "",
            )}" placeholder="sensor.london_time" spellcheck="false">
          </label>
          <label class="check wide">
            <input type="checkbox" data-location-field="use_home_coordinates" data-index="${index}" ${
              useHome ? "checked" : ""
            }>
            Use Home Assistant home coordinates
          </label>
          <label>Latitude
            <input type="number" step="any" min="-90" max="90" data-location-field="latitude" data-index="${index}"
              value="${escapeHtml(location.latitude ?? "")}" ${useHome ? "disabled" : ""} placeholder="51.5074">
          </label>
          <label>Longitude
            <input type="number" step="any" min="-180" max="180" data-location-field="longitude" data-index="${index}"
              value="${escapeHtml(location.longitude ?? "")}" ${useHome ? "disabled" : ""} placeholder="-0.1278">
          </label>
        </div>
      </section>`;
  }

  _render() {
    if (!this._config) return;
    const config = { ...DEFAULT_CONFIG, ...this._config };
    const zones = COMMON_TIME_ZONES.map((zone) => `<option value="${zone}"></option>`).join("");
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          color: var(--primary-text-color);
          font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
        }
        * { box-sizing: border-box; }
        .note {
          margin: 0 0 16px;
          padding: 12px;
          border-radius: 10px;
          color: var(--secondary-text-color);
          background: color-mix(in srgb, var(--primary-color) 7%, transparent);
          font-size: 13px;
          line-height: 1.4;
        }
        .settings,
        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        label {
          display: grid;
          gap: 5px;
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 500;
        }
        label.wide { grid-column: 1 / -1; }
        label.check {
          display: flex;
          align-items: center;
          gap: 9px;
          min-height: 34px;
          color: var(--primary-text-color);
          font-size: 14px;
          font-weight: 400;
        }
        input:not([type="checkbox"]),
        select {
          width: 100%;
          min-height: 42px;
          padding: 8px 10px;
          border: 1px solid var(--divider-color, #aaa);
          border-radius: 8px;
          outline: none;
          color: var(--primary-text-color);
          background: var(--card-background-color, #fff);
          font: inherit;
          font-size: 14px;
        }
        input:focus,
        select:focus { border-color: var(--primary-color); }
        input:disabled { opacity: 0.55; }
        input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: var(--primary-color);
        }
        .location-editor {
          margin-top: 18px;
          padding: 14px;
          border: 1px solid var(--divider-color, #ccc);
          border-radius: 12px;
        }
        .section-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 15px;
          font-weight: 600;
        }
        button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 14px;
          border: 0;
          border-radius: 9px;
          color: var(--text-primary-color, #fff);
          background: var(--primary-color);
          font: inherit;
          font-weight: 600;
          cursor: pointer;
        }
        button:disabled { opacity: 0.38; cursor: default; }
        .icon-button {
          width: 36px;
          min-height: 36px;
          padding: 0;
          color: var(--secondary-text-color);
          background: transparent;
        }
        .icon-button ha-icon { --mdc-icon-size: 20px; }
        .add-row { display: flex; justify-content: flex-end; margin-top: 14px; }
        .divider { height: 1px; margin: 18px 0; background: var(--divider-color); }
        @media (max-width: 430px) {
          .settings,
          .grid { grid-template-columns: 1fr; }
          label.wide { grid-column: auto; }
        }
      </style>
      <p class="note">Each location needs an IANA time zone and coordinates. Enter a two-letter country code to show its bundled SVG flag. A Worldclock sensor is optional and, when supplied, is used only for its displayed time.</p>
      <div class="settings">
        <label class="wide">Card title
          <input data-config-field="title" value="${escapeHtml(config.title || "")}" placeholder="World Clock">
        </label>
        <label>Time format
          <select data-config-field="time_format">
            <option value="auto" ${config.time_format === "auto" ? "selected" : ""}>System</option>
            <option value="12" ${config.time_format === "12" ? "selected" : ""}>12 hour</option>
            <option value="24" ${config.time_format === "24" ? "selected" : ""}>24 hour</option>
          </select>
        </label>
        <label>Date format
          <select data-config-field="date_format">
            <option value="short" ${config.date_format === "short" ? "selected" : ""}>Short</option>
            <option value="medium" ${config.date_format === "medium" ? "selected" : ""}>Medium</option>
            <option value="long" ${config.date_format === "long" ? "selected" : ""}>Long</option>
            <option value="full" ${config.date_format === "full" ? "selected" : ""}>Full</option>
          </select>
        </label>
        <label>Card width
          <input data-config-field="card_width" value="${escapeHtml(config.card_width)}" placeholder="100%">
        </label>
        <label>Maximum width
          <input data-config-field="max_width" value="${escapeHtml(config.max_width)}" placeholder="none">
        </label>
        <label>Row height (px)
          <input type="number" min="58" max="160" data-config-field="row_height" value="${escapeHtml(
            config.row_height,
          )}">
        </label>
        <label class="check"><input type="checkbox" data-config-field="show_seconds" ${
          config.show_seconds ? "checked" : ""
        }> Show seconds</label>
        <label class="check"><input type="checkbox" data-config-field="show_timezone" ${
          config.show_timezone ? "checked" : ""
        }> Show time-zone abbreviation</label>
        <label class="check"><input type="checkbox" data-config-field="show_daylight_label" ${
          config.show_daylight_label ? "checked" : ""
        }> Show daylight label</label>
        <label class="check"><input type="checkbox" data-config-field="animate_icons" ${
          config.animate_icons !== false ? "checked" : ""
        }> Animate sun and moon</label>
        <label class="check"><input type="checkbox" data-config-field="prefer_entity_time" ${
          config.prefer_entity_time !== false ? "checked" : ""
        }> Prefer Worldclock entity time</label>
      </div>
      <div class="divider"></div>
      ${this._config.locations.map((location, index) => this._renderLocationEditor(location, index)).join("")}
      <div class="add-row"><button data-action="add"><ha-icon icon="mdi:plus"></ha-icon>&nbsp; Add location</button></div>
      <datalist id="worldclock-zones">${zones}</datalist>`;
  }
}

if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, WorldclockSunCardEditor);
if (!customElements.get(CARD_TAG)) customElements.define(CARD_TAG, WorldclockSunCard);

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: "Worldclock Sun Card",
    description: "World clocks with local dates and location-aware sun or moon icons.",
    preview: true,
  });
}

console.info(`%c WORLDCLOCK-SUN-CARD %c ${CARD_VERSION} `, "color:#fff;background:#3f51b5;font-weight:700", "color:#3f51b5;background:#fff");

export {
  calculateSolarElevation,
  formatZonedDate,
  formatZonedTime,
  getSolarState,
};
