# Home Assistant Dashboard Cards

![TeamSpeak 3 Card preview](cards/teamspeak3-card/preview.png)


Custom Home Assistant dashboard cards adapted from useful MagicMirror modules.

## Included packages

| Package | Purpose |
| --- | --- |
| [Chameleon Weather Card](cards/chameleon-weather-card/) | Temperature-sensitive chameleon artwork, weather overlays, localized messages, width, visibility, and Sections layout support. |
| [TeamSpeak 3 Card](cards/teamspeak3-card/) | Secure ServerQuery integration and a Lovelace card showing connected voice clients. |
| [Worldclock Sun Card](cards/worldclock-sun-card/) | Local time and date, bundled SVG country flags, and location-aware animated sun/moon artwork. |
| [Earthquake Alert Card](cards/earthquake-alert-card/) | USGS/native Home Assistant earthquake alerts using ordered magnitude-and-distance thresholds. |
| [Expander Scroll Card](cards/expander-scroll-card/) | Collapsible child-card container with a configurable, scrollable collapsed preview. |

Each package contains its own installation guide, configuration examples, attribution, and license information.

## Installation

Open the README inside the package you want to install. Most frontend packages are copied into Home Assistant's `/config/www/` directory and registered as JavaScript module resources. The TeamSpeak package also includes a backend custom integration.

## Disclaimer

These are community dashboard components and are not official Home Assistant integrations. Earthquake information is informational and must not be used as a substitute for official emergency alerts.

## Install with HACS

1. Open HACS in Home Assistant.
2. Open the three-dot menu and select **Custom repositories**.
3. Add `https://github.com/Hoppersusa/home-assistant-dashboard-cards` with category **Dashboard**.
4. Download **Home Assistant Dashboard Cards** and refresh the browser.

HACS installs the bundle resource at:

```text
/hacsfiles/home-assistant-dashboard-cards/home-assistant-dashboard-cards.js
```

The bundle registers all five frontend cards. The TeamSpeak backend integration is published separately at [Hoppersusa/teamspeak3-monitor](https://github.com/Hoppersusa/teamspeak3-monitor).

