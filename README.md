# Home Assistant Dashboard Cards

Custom Home Assistant dashboard cards adapted from useful MagicMirror modules.

## Included packages

| Package | Purpose |
| --- | --- |
| [Chameleon Weather Card](cards/chameleon-weather-card/) | Temperature-sensitive chameleon artwork, weather overlays, localized messages, width, visibility, and Sections layout support. |
| [TeamSpeak 3 Card](cards/teamspeak3-card/) | Secure ServerQuery integration and a Lovelace card showing connected voice clients. |
| [Worldclock Sun Card](cards/worldclock-sun-card/) | Local time and date, bundled SVG country flags, and location-aware animated sun/moon artwork. |
| [Earthquake Alert Card](cards/earthquake-alert-card/) | USGS/native Home Assistant earthquake alerts using ordered magnitude-and-distance thresholds. |

Each package contains its own installation guide, configuration examples, attribution, and license information.

## Installation

Open the README inside the package you want to install. Most frontend packages are copied into Home Assistant's `/config/www/` directory and registered as JavaScript module resources. The TeamSpeak package also includes a backend custom integration.

## Disclaimer

These are community dashboard components and are not official Home Assistant integrations. Earthquake information is informational and must not be used as a substitute for official emergency alerts.
