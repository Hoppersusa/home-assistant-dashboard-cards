const CARD_VERSION = "1.2.0";
const CARD_TAG = "chameleon-weather-card";
const CARD_ASSET_ROOT = new URL(".", import.meta.url).href;

const DEFAULT_RANGES = [
  { min: Number.NEGATIVE_INFINITY, max: 0, image: "images/frog/chameleon_below0.png" },
  { min: 0, max: 10, image: "images/frog/chameleon_to10.png" },
  { min: 10, max: 20, image: "images/frog/chameleon_to20.png" },
  { min: 20, max: 30, image: "images/frog/chameleon_to30.png" },
  { min: 30, max: Number.POSITIVE_INFINITY, image: "images/frog/chameleon_above30.png" },
];

const WEATHER_ICONS = {
  "clear-night": "01n.png",
  cloudy: "04d.png",
  exceptional: "na.png",
  fog: "50d.png",
  hail: "511.png",
  lightning: "11d.png",
  "lightning-rainy": "11d.png",
  partlycloudy: "02d.png",
  pouring: "502.png",
  rainy: "500.png",
  snowy: "13d.png",
  "snowy-rainy": "511.png",
  sunny: "01d.png",
  windy: "50d.png",
  "windy-variant": "04d.png",
};

const CONDITION_GROUPS = {
  "clear-night": "Clear",
  cloudy: "Clouds",
  exceptional: "Extreme",
  fog: "Clouds",
  hail: "Snow",
  lightning: "Extreme",
  "lightning-rainy": "Rain",
  partlycloudy: "Clouds",
  pouring: "Rain",
  rainy: "Rain",
  snowy: "Snow",
  "snowy-rainy": "Snow",
  sunny: "Clear",
  windy: "Clouds",
  "windy-variant": "Clouds",
};

// Message text is adapted from MMM-ChameleonWeather and retained under its MIT license.
const MESSAGES = {
  en: {
    Rain: [
      "Rain again? Someone up there needs a new hobby.",
      "Don't forget your umbrella!",
      "Rain: Nature's way of saying 'Netflix day!'",
      "It's wet outside. Might as well stay in.",
      "Rain, rain, go away... but maybe come back tomorrow?",
    ],
    Clear: [
      "Sunny skies! Enjoy it while it lasts.",
      "Perfect day for a walk!",
      "The sun is out. Don’t forget sunscreen!",
      "Finally, some good weather. Time for ice cream!",
      "Blue skies. Who needs a vacation when it’s like this?",
    ],
    Clouds: [
      "Cloudy with a chance of yawns.",
      "Where’s the sun? Taking a break, I guess.",
      "Gray skies ahead, like your Monday mood.",
      "The clouds are here to stay, apparently.",
      "Looks like the sun is on strike.",
    ],
    Snow: [
      "Snowball fight incoming!",
      "Snow: The prettiest inconvenience.",
      "Grab your shovel and your sense of humor.",
      "Winter wonderland time!",
      "Snow means hot cocoa and blankets, right?",
    ],
    Extreme: [
      "Stay safe out there, the weather’s wild!",
      "Extreme weather alert! Hold onto your hats.",
      "Looks like Mother Nature’s in a mood.",
      "Buckle up, it’s going to be a bumpy ride.",
      "Extreme weather: perfect excuse to stay indoors.",
    ],
  },
  de: {
    Rain: [
      "Schon wieder Regen? Hat der Himmel keine anderen Ideen?",
      "Vergiss deinen Regenschirm nicht!",
      "Regen: Perfekt für einen Netflix-Tag!",
      "Wie wäre es mit einem Boot statt einem Auto?",
      "Regen, Regen, geh weg, komm wieder an einem anderen Tag!",
    ],
    Clear: [
      "Sonnenschein! Genieße es, solange es hält.",
      "Perfektes Wetter für einen Spaziergang!",
      "Die Sonne scheint. Vergiss die Sonnencreme nicht!",
      "Ein perfekter Tag, um faul in der Sonne zu liegen.",
      "Endlich Sonne! Zeit für ein Eis.",
    ],
    Clouds: [
      "Wolken... passt zu meiner Montagslaune.",
      "Wo ist die Sonne? Wahrscheinlich in Urlaub.",
      "Grauer Himmel... Wie inspirierend!",
      "Wolken: Die Tarnung der Sonne.",
      "Immer noch keine Sonne? Typisch.",
    ],
    Snow: [
      "Zeit für eine Schneeballschlacht!",
      "Schnee: Die schönste Unannehmlichkeit.",
      "Hoffentlich hast du eine Schaufel parat!",
      "Es ist Winterwunderland-Zeit!",
      "Schnee: Perfekt für heiße Schokolade und Kuscheldecken.",
    ],
    Extreme: [
      "Bleib sicher, das Wetter ist wild!",
      "Unwetterwarnung! Halte dich fest!",
      "Sieht aus, als hätte Mutter Natur einen schlechten Tag.",
      "Vorsicht: Das Wetter hat heute keine gute Laune.",
      "Extremwetter: Bleib lieber drinnen.",
    ],
  },
  fr: {
    Rain: [
      "Encore de la pluie ? Le ciel manque d'inspiration ?",
      "N'oublie pas ton parapluie !",
      "Pluie : Parfait pour une journée Netflix !",
      "La pluie : un rappel que le soleil ne brille pas toujours.",
      "Mieux vaut être mouillé que gelé, non ?",
    ],
    Clear: [
      "Du soleil ! Profites-en tant que ça dure.",
      "Un temps parfait pour une promenade !",
      "Le soleil brille. N'oublie pas la crème solaire !",
      "Enfin une journée sans nuages !",
      "Parfait pour un pique-nique en plein air.",
    ],
    Clouds: [
      "Nuages... Parfait pour rester au lit.",
      "Où est le soleil ? Probablement en vacances.",
      "Ciel gris... Ça reflète l'humeur de lundi.",
      "Les nuages cachent les étoiles ce soir.",
      "Encore des nuages ? Pas de surprise.",
    ],
    Snow: [
      "Bataille de boules de neige à venir !",
      "Neige : L'inconvénient le plus joli.",
      "Prêt à pelleter ou à faire du ski ?",
      "C'est l'heure du chocolat chaud et des couvertures.",
      "La neige tombe, et tout devient magique.",
    ],
    Extreme: [
      "Reste prudent, le temps est fou !",
      "Alerte météo extrême ! Accroche-toi !",
      "On dirait que Mère Nature n'est pas contente.",
      "Vérifie deux fois avant de sortir.",
      "Temps extrême : reste bien au chaud.",
    ],
  },
  "pt-br": {
    Rain: [
      "Chuva de novo? Alguém lá em cima precisa de um novo hobby.",
      "Não esqueça seu guarda-chuva!",
      "Chuva: A maneira da natureza dizer 'Dia de Netflix!'",
      "Está molhado lá fora. Melhor ficar em casa.",
      "Chuva, chuva, vá embora... mas talvez volte amanhã?",
    ],
    Clear: [
      "Céu ensolarado! Aproveite enquanto dura.",
      "Dia perfeito para uma caminhada!",
      "O sol está brilhando. Não esqueça o protetor solar!",
      "Finalmente, um bom tempo. Hora de tomar sorvete!",
      "Céu azul. Quem precisa de férias quando está assim?",
    ],
    Clouds: [
      "Nublado com chance de bocejos.",
      "Cadê o sol? Tirando uma folga, eu acho.",
      "Céu cinzento à frente, como seu humor de segunda-feira.",
      "As nuvens vieram para ficar, aparentemente.",
      "Parece que o sol entrou em greve.",
    ],
    Snow: [
      "Batalha de bolas de neve chegando!",
      "Neve: O inconveniente mais bonito.",
      "Pegue sua pá e seu senso de humor.",
      "Hora de um país das maravilhas de inverno!",
      "Neve significa chocolate quente e cobertores, certo?",
    ],
    Extreme: [
      "Fique seguro lá fora, o clima está selvagem!",
      "Alerta de clima extremo! Segure seus chapéus.",
      "Parece que a Mãe Natureza está de mau humor.",
      "Aperte os cintos, vai ser uma viagem turbulenta.",
      "Clima extremo: desculpa perfeita para ficar em casa.",
    ],
  },
};

const DEFAULT_CONFIG = {
  show_temperature: true,
  show_message: true,
  use_weather_mapping: true,
  temperature_decimals: 1,
  range_unit: "celsius",
  display_unit: "auto",
  card_width: "100%",
  image_width: "54%",
  card_height: "230px",
  weather_image_path: "images/weather/",
};

function parseBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function cssLength(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) return `${value}px`;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeLanguage(value) {
  const language = String(value || "en").replace("_", "-").toLowerCase();
  if (language.startsWith("pt")) return "pt-br";
  if (language.startsWith("de")) return "de";
  if (language.startsWith("fr")) return "fr";
  return "en";
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toCelsius(value, unit) {
  const normalized = String(unit || "°C").toUpperCase();
  if (normalized.includes("F")) return (value - 32) * (5 / 9);
  if (normalized.includes("K") && !normalized.includes("°")) return value - 273.15;
  return value;
}

function fromCelsius(value, unit) {
  if (unit === "fahrenheit") return value * (9 / 5) + 32;
  return value;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

class ChameleonWeatherCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._renderKey = "";
    this._renderSkeleton();
  }

  static getStubConfig() {
    return { entity: "weather.home" };
  }

  static getConfigForm() {
    const labels = {
      entity: "Weather entity",
      temperature_entity: "Temperature entity (optional)",
      name: "Card title",
      language: "Message language",
      show_temperature: "Show temperature",
      show_message: "Show weather message",
      use_weather_mapping: "Show weather overlay",
      display_unit: "Display unit",
      temperature_decimals: "Temperature decimals",
      card_width: "Card width",
      card_height: "Minimum card height",
      image_width: "Chameleon width",
    };
    const helpers = {
      temperature_entity: "Uses the weather entity's temperature when left empty.",
      card_width: "Examples: 100%, 350px, or 24rem. Grid columns are configured on Home Assistant's Layout tab.",
      card_height: "Examples: 230px or 18rem. A Sections layout can stretch the card to its selected rows.",
      image_width: "CSS width of the chameleon artwork, such as 54% or 180px.",
    };

    return {
      schema: [
        {
          name: "entity",
          required: true,
          selector: { entity: { filter: { domain: "weather" } } },
        },
        {
          name: "temperature_entity",
          selector: {
            entity: {
              filter: [
                { domain: "sensor", device_class: "temperature" },
                { domain: "input_number" },
                { domain: "number" },
              ],
            },
          },
        },
        { name: "name", selector: { text: {} } },
        {
          type: "grid",
          name: "",
          flatten: true,
          column_min_width: "160px",
          schema: [
            {
              name: "language",
              selector: {
                select: {
                  mode: "dropdown",
                  options: [
                    { value: "en", label: "English" },
                    { value: "de", label: "Deutsch" },
                    { value: "fr", label: "Français" },
                    { value: "pt-BR", label: "Português (Brasil)" },
                  ],
                },
              },
            },
            {
              name: "display_unit",
              selector: {
                select: {
                  mode: "dropdown",
                  options: [
                    { value: "auto", label: "Automatic" },
                    { value: "celsius", label: "Celsius" },
                    { value: "fahrenheit", label: "Fahrenheit" },
                  ],
                },
              },
            },
            {
              name: "temperature_decimals",
              selector: { number: { min: 0, max: 3, step: 1, mode: "box" } },
            },
          ],
        },
        {
          type: "expandable",
          name: "content",
          title: "Content",
          flatten: true,
          schema: [
            { name: "show_temperature", selector: { boolean: {} } },
            { name: "show_message", selector: { boolean: {} } },
            { name: "use_weather_mapping", selector: { boolean: {} } },
          ],
        },
        {
          type: "expandable",
          name: "appearance",
          title: "Appearance",
          flatten: true,
          schema: [
            { name: "card_width", selector: { text: {} } },
            { name: "card_height", selector: { text: {} } },
            { name: "image_width", selector: { text: {} } },
          ],
        },
      ],
      computeLabel: (schema) => labels[schema.name],
      computeHelper: (schema) => helpers[schema.name],
    };
  }

  setConfig(config) {
    if (!config || typeof config.entity !== "string" || !config.entity.trim()) {
      throw new Error("Chameleon Weather Card requires a weather entity.");
    }

    this._config = {
      ...DEFAULT_CONFIG,
      ...config,
      entity: config.entity.trim(),
      show_temperature: parseBoolean(config.show_temperature, true),
      show_message: parseBoolean(config.show_message, true),
      use_weather_mapping: parseBoolean(config.use_weather_mapping, true),
      card_width: cssLength(config.card_width ?? config.width, DEFAULT_CONFIG.card_width),
      image_width: cssLength(config.image_width, DEFAULT_CONFIG.image_width),
      card_height: cssLength(config.card_height, DEFAULT_CONFIG.card_height),
    };
    this._ranges = this._normalizeRanges(config.temperature_ranges || DEFAULT_RANGES);
    this._renderKey = "";
    this._applySizing();
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    return { rows: 4, columns: 6, min_rows: 4, min_columns: 4 };
  }

  _renderSkeleton() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: var(--cw-card-width, 100%);
          max-width: 100%;
          height: 100%;
          min-height: var(--cw-card-height, 230px);
          margin-inline: auto;
        }
        ha-card {
          display: block;
          position: relative;
          box-sizing: border-box;
          height: 100%;
          min-height: var(--cw-card-height, 230px);
          overflow: hidden;
          color: var(--primary-text-color, #fff);
          background: var(--ha-card-background, var(--card-background-color, #111));
          cursor: pointer;
          isolation: isolate;
        }
        ha-card:focus-visible {
          outline: 2px solid var(--primary-color, #03a9f4);
          outline-offset: -2px;
        }
        .name {
          position: absolute;
          top: 14px;
          left: 18px;
          right: 18px;
          z-index: 5;
          font-size: 15px;
          font-weight: 500;
          opacity: .86;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .chameleon {
          position: absolute;
          right: 2%;
          bottom: 5%;
          z-index: 1;
          display: block;
          width: var(--cw-image-width, 54%);
          max-width: 68%;
          max-height: 94%;
          object-fit: contain;
          object-position: right bottom;
          filter: drop-shadow(0 3px 5px rgb(0 0 0 / .3));
          user-select: none;
          pointer-events: none;
        }
        .overlay {
          position: absolute;
          left: 8%;
          bottom: 17%;
          z-index: 2;
          display: block;
          width: min(45%, 190px);
          opacity: .82;
          object-fit: contain;
          user-select: none;
          pointer-events: none;
        }
        .temperature {
          position: absolute;
          left: 5%;
          bottom: 36%;
          z-index: 3;
          font-size: clamp(32px, 10vw, 54px);
          font-weight: 300;
          line-height: 1;
          color: var(--primary-text-color, #fff);
          text-shadow: 0 2px 5px rgb(0 0 0 / .75);
          white-space: nowrap;
        }
        .message {
          position: absolute;
          left: 5%;
          right: 5%;
          bottom: 7%;
          z-index: 4;
          overflow: hidden;
          color: var(--primary-text-color, #fff);
          font-size: clamp(14px, 4vw, 20px);
          line-height: 1.25;
          text-overflow: ellipsis;
          text-shadow: 0 1px 4px rgb(0 0 0 / .85);
          white-space: nowrap;
        }
        .status {
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: 16px;
          z-index: 6;
          padding: 8px 10px;
          border-radius: 8px;
          color: var(--error-color, #db4437);
          background: color-mix(in srgb, var(--card-background-color, #111) 88%, transparent);
          font-size: 13px;
        }
        [hidden] { display: none !important; }
      </style>
      <ha-card tabindex="0" role="button">
        <div class="name" hidden></div>
        <img class="chameleon" alt="" />
        <img class="overlay" alt="" hidden />
        <div class="temperature" hidden></div>
        <div class="message" hidden></div>
        <div class="status" role="status" hidden></div>
      </ha-card>
    `;

    this._elements = {
      card: this.shadowRoot.querySelector("ha-card"),
      name: this.shadowRoot.querySelector(".name"),
      chameleon: this.shadowRoot.querySelector(".chameleon"),
      overlay: this.shadowRoot.querySelector(".overlay"),
      temperature: this.shadowRoot.querySelector(".temperature"),
      message: this.shadowRoot.querySelector(".message"),
      status: this.shadowRoot.querySelector(".status"),
    };

    this._elements.card.addEventListener("click", () => this._showMoreInfo());
    this._elements.card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this._showMoreInfo();
      }
    });
  }

  _normalizeRanges(ranges) {
    if (!Array.isArray(ranges) || ranges.length === 0) {
      throw new Error("temperature_ranges must be a non-empty list.");
    }

    return ranges.map((entry, index) => {
      if (!entry || typeof entry !== "object" || !entry.image) {
        throw new Error(`Temperature range ${index + 1} requires an image.`);
      }
      const pair = Array.isArray(entry.range) ? entry.range : [];
      const rawMin = Object.prototype.hasOwnProperty.call(entry, "min") ? entry.min : pair[0];
      const rawMax = Object.prototype.hasOwnProperty.call(entry, "max") ? entry.max : pair[1];
      const min = rawMin === null || rawMin === undefined ? Number.NEGATIVE_INFINITY : Number(rawMin);
      const max = rawMax === null || rawMax === undefined ? Number.POSITIVE_INFINITY : Number(rawMax);
      if (Number.isNaN(min) || Number.isNaN(max) || min >= max) {
        throw new Error(`Temperature range ${index + 1} has invalid limits.`);
      }
      return { min, max, image: String(entry.image) };
    });
  }

  _applySizing() {
    if (!this._config) return;
    this.style.setProperty("--cw-card-width", this._config.card_width);
    this.style.setProperty("--cw-image-width", this._config.image_width);
    this.style.setProperty("--cw-card-height", this._config.card_height);
  }

  _update() {
    if (!this._config || !this._hass) return;

    const weather = this._hass.states[this._config.entity];
    const temperatureState = this._config.temperature_entity
      ? this._hass.states[this._config.temperature_entity]
      : null;
    const sunState = this._hass.states["sun.sun"]?.state || "";
    const renderKey = JSON.stringify([
      weather?.state,
      weather?.last_updated,
      weather?.attributes?.temperature,
      weather?.attributes?.temperature_unit,
      temperatureState?.state,
      temperatureState?.last_updated,
      temperatureState?.attributes?.unit_of_measurement,
      sunState,
      this._hass.language,
    ]);
    if (renderKey === this._renderKey) return;
    this._renderKey = renderKey;

    if (!weather) {
      this._renderUnavailable(`Entity not found: ${this._config.entity}`);
      return;
    }

    const condition = String(weather.state || "unknown").toLowerCase();
    const temperature = this._readTemperature(weather, temperatureState);
    const temperatureC = temperature.value === null
      ? null
      : toCelsius(temperature.value, temperature.unit);
    const rangeTemperature = this._config.range_unit === "fahrenheit" && temperatureC !== null
      ? fromCelsius(temperatureC, "fahrenheit")
      : temperatureC;

    this._renderName(weather);
    this._renderChameleon(rangeTemperature);
    this._renderOverlay(condition, sunState === "below_horizon");
    this._renderTemperature(temperature, temperatureC);
    this._renderMessage(condition, weather.last_updated || weather.last_changed || "");

    const isUnavailable = condition === "unknown" || condition === "unavailable";
    const status = isUnavailable
      ? `Weather entity is ${condition}.`
      : temperature.error;
    this._setText(this._elements.status, status, Boolean(status));

    const labelParts = [
      this._elements.name.textContent,
      condition.replaceAll("-", " "),
      this._elements.temperature.textContent,
      this._elements.message.textContent,
    ].filter(Boolean);
    this._elements.card.setAttribute("aria-label", labelParts.join(", "));
  }

  _readTemperature(weather, sensor) {
    if (this._config.temperature_entity) {
      if (!sensor) {
        return { value: null, unit: "", error: `Entity not found: ${this._config.temperature_entity}` };
      }
      const value = finiteNumber(sensor.state);
      const unavailable = sensor.state === "unknown" || sensor.state === "unavailable";
      return {
        value,
        unit: sensor.attributes.unit_of_measurement || this._config.temperature_source_unit || "°C",
        error: unavailable || value === null ? `Temperature entity is ${sensor.state}.` : "",
      };
    }

    const value = finiteNumber(weather.attributes.temperature);
    return {
      value,
      unit: weather.attributes.temperature_unit || this._config.temperature_source_unit || "°C",
      error: value === null ? "This weather entity does not provide a current temperature." : "",
    };
  }

  _renderName(weather) {
    const name = this._config.name === true
      ? weather.attributes.friendly_name || this._config.entity
      : typeof this._config.name === "string"
        ? this._config.name
        : "";
    this._setText(this._elements.name, name, Boolean(name));
  }

  _renderChameleon(rangeTemperature) {
    const range = rangeTemperature === null
      ? null
      : this._ranges.find((entry) => rangeTemperature >= entry.min && rangeTemperature < entry.max);
    const fallback = this._assetUrl("images/frog/default.png");
    const image = range ? this._assetUrl(range.image) : fallback;
    this._setImage(this._elements.chameleon, image, fallback);
  }

  _renderOverlay(condition, isNight) {
    if (!this._config.use_weather_mapping) {
      this._elements.overlay.hidden = true;
      return;
    }

    const override = this._config.weather_icons?.[condition];
    let filename = override || WEATHER_ICONS[condition] || "na.png";
    if (!override && isNight) filename = filename.replace("d.png", "n.png");
    const image = this._weatherAsset(filename);
    this._setImage(this._elements.overlay, image);
    this._elements.overlay.hidden = false;
  }

  _renderTemperature(temperature, temperatureC) {
    if (!this._config.show_temperature || temperature.value === null || temperatureC === null) {
      this._setText(this._elements.temperature, "", false);
      return;
    }

    const displayUnit = String(this._config.display_unit || "auto").toLowerCase();
    let value = temperature.value;
    let unit = temperature.unit || "°C";
    if (displayUnit === "celsius") {
      value = temperatureC;
      unit = "°C";
    } else if (displayUnit === "fahrenheit") {
      value = fromCelsius(temperatureC, "fahrenheit");
      unit = "°F";
    }

    const decimals = Math.max(0, Math.min(3, Number(this._config.temperature_decimals) || 0));
    const formatted = value.toLocaleString(this._hass.locale?.language || this._hass.language, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    this._setText(this._elements.temperature, `${formatted}${unit.startsWith("°") ? unit : `°${unit}`}`, true);
  }

  _renderMessage(condition, updateToken) {
    if (!this._config.show_message) {
      this._setText(this._elements.message, "", false);
      return;
    }

    const language = normalizeLanguage(this._config.language || this._hass.language);
    const group = CONDITION_GROUPS[condition] || "Clear";
    const overrides = this._config.messages || {};
    const options = overrides[condition] || overrides[group] || MESSAGES[language]?.[group] || MESSAGES.en[group];
    const normalized = Array.isArray(options) ? options.filter((item) => typeof item === "string" && item) : [];
    const fallback = "The weather is boring. Move somewhere else.";
    const text = normalized.length
      ? normalized[hashString(`${condition}|${updateToken}`) % normalized.length]
      : fallback;
    this._setText(this._elements.message, text, true);
    this._elements.message.title = text;
  }

  _renderUnavailable(message) {
    this._setImage(
      this._elements.chameleon,
      this._assetUrl("images/frog/default.png"),
    );
    this._elements.overlay.hidden = true;
    this._setText(this._elements.temperature, "", false);
    this._setText(this._elements.message, "", false);
    this._setText(this._elements.name, typeof this._config.name === "string" ? this._config.name : "", Boolean(this._config.name));
    this._setText(this._elements.status, message, true);
    this._elements.card.setAttribute("aria-label", message);
  }

  _assetUrl(path) {
    return new URL(String(path), String(path).startsWith("/") ? window.location.origin : CARD_ASSET_ROOT).href;
  }

  _weatherAsset(value) {
    const path = String(value);
    if (/^(?:https?:|data:|\/)/i.test(path) || path.includes("/")) return this._assetUrl(path);
    const base = this._config.weather_image_path || DEFAULT_CONFIG.weather_image_path;
    return this._assetUrl(`${String(base).replace(/\/?$/, "/")}${path}`);
  }

  _setImage(element, source, fallback = "") {
    element.hidden = false;
    element.onerror = () => {
      if (fallback && element.src !== fallback) {
        element.onerror = () => { element.hidden = true; };
        element.src = fallback;
      } else {
        element.hidden = true;
      }
    };
    if (element.src !== source) element.src = source;
  }

  _setText(element, text, visible) {
    element.textContent = text || "";
    element.hidden = !visible;
  }

  _showMoreInfo() {
    if (!this._config?.entity) return;
    const event = new CustomEvent("hass-more-info", {
      bubbles: true,
      composed: true,
      detail: { entityId: this._config.entity },
    });
    this.dispatchEvent(event);
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, ChameleonWeatherCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: "Chameleon Weather Card",
    description: "A temperature-reactive chameleon with weather overlays and witty messages.",
    preview: true,
    documentationURL: "https://github.com/ChrisF1976/MMM-ChameleonWeather/",
  });
}

console.info(`%c CHAMELEON-WEATHER-CARD %c v${CARD_VERSION} `, "color: white; background: #76b900; font-weight: 700;", "color: #76b900; background: transparent;");
