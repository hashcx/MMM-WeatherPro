# MMM-WeatherPro

A robust, futuristic MagicMirror² weather module using **Open-Meteo** — completely free, no API key required.

---

## Features

- **No API key** — powered by [Open-Meteo](https://open-meteo.com)
- Location by lat/lon with optional auto-resolved city name via reverse geocode
- Standard MM module header with optional prefix
- Compact current conditions row (icon + temp + description + field chips)
- Hourly forecast cards — configurable fields, optional title, cards per row
- Hourly **chart mode** — SVG line + bar chart, no external libraries
- Daily forecast cards — same configurability
- Daily **chart mode** — SVG temperature range + precipitation chart
- °C / °F with optional secondary unit shown inline
- Condition-triggered animations on individual field chips — not the whole card
- Per-rule custom alert color override
- Offline disk cache — serves last known data if fetch fails
- **Last updated timestamp** — shows when the data was last refreshed
- **Smart alignment** — current conditions and last-updated follow the MagicMirror region automatically, with a manual override option
- Futuristic minimal design with CSS variable theming

---

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/YOUR_USERNAME/MMM-WeatherPro.git
# No npm install needed!
```

---

## Quick Start

```js
{
  module: "MMM-WeatherPro",
  position: "top_right",
  config: {
    lat: 44.9778,
    lon: -93.2650,
  }
}
```

---

## Full Configuration Reference

```js
{
  module: "MMM-WeatherPro",
  position: "top_right",
  config: {

    // ── Header ─────────────────────────────────────────────────────────────
    showTitle:   true,           // show standard MM module header
    titlePrefix: "Weather — ",   // prefix before the auto-resolved city name
    //   titlePrefix: "Weather — "  → "Weather — Minneapolis"
    //   titlePrefix: ""            → "Minneapolis"
    //   showTitle: false           → no header at all

    // ── Location ───────────────────────────────────────────────────────────
    lat:          44.9778,       // required
    lon:          -93.2650,      // required
    showLocation: true,          // auto-resolve city name from lat/lon

    // ── Units ──────────────────────────────────────────────────────────────
    units:             "C",      // "C" | "F"
    showSecondaryUnit: true,     // show the other unit inline next to primary

    // ── Current conditions ─────────────────────────────────────────────────
    // Shown as a single compact row: icon + temp + description + chips below
    showCurrent:   true,
    currentFields: [
      "temperature", "feelsLike", "humidity",
      "windSpeed", "uvIndex", "precipitation",
    ],

    // ── Hourly forecast ────────────────────────────────────────────────────
    showHourly:        true,
    showHourlyTitle:   true,     // show "Hourly" section label
    hourlyMode:        "cards",  // "cards" | "chart"
    hourlyCount:       6,        // number of cards or chart points (max 48)
    hourlyCardsPerRow: null,     // null = flex row, or e.g. 4 for fixed grid
    hourlyTimeFormat:  24,       // 12 | 24
    showAmPm:          true,     // show AM/PM label when hourlyTimeFormat is 12
    // "absolute" — value only, no delta shown
    // "delta"    — delta only on non-first cards (= when no change)
    // "both"     — value + delta on non-first cards
    deltaMode:         "both",
    hourlyFields: [
      "temperature", "precipitation", "windSpeed",
    ],

    // ── Daily forecast ─────────────────────────────────────────────────────
    showDaily:        true,
    showDailyTitle:   true,      // show "Forecast" section label
    dailyMode:        "cards",   // "cards" | "chart"
    dailyCount:       5,         // number of cards or chart points (max 16)
    dailyCardsPerRow: null,      // null = flex row, or e.g. 3 for fixed grid
    dailyFields: [
      "tempMax", "tempMin", "precipitation", "windSpeed",
    ],

    // ── Condition alerts / animations ──────────────────────────────────────
    // Only the matching field chip/row is animated — not the whole card.
    // Multiple fields on the same card can animate independently.
    //
    // field:     weather field to check (see Available Fields below)
    // operator:  "<" | ">" | "<=" | ">=" | "==" | "!="
    // value:     threshold in SI units (°C, km/h, mm) regardless of display units
    // animation: see Animations table below
    // target:    "hourly" | "daily" | "both" | "current"
    // color:     optional CSS color override (default: dangerColor)
    alerts: [
      { field: "temperature",              operator: "<=", value: 0,  animation: "pulse",     target: "both",    color: "#40c4ff" },
      { field: "precipitationProbability", operator: ">=", value: 70, animation: "highlight", target: "hourly"                   },
      { field: "windSpeed",                operator: ">=", value: 50, animation: "shake",     target: "both"                     },
      { field: "uvIndex",                  operator: ">=", value: 8,  animation: "bold",      target: "current"                  },
    ],

    // ── Style ──────────────────────────────────────────────────────────────
    accentColor:    "#40c4ff",
    dangerColor:    "#ff4d4d",
    cardBackground: "rgba(255,255,255,0.06)",

    // ── Updates ────────────────────────────────────────────────────────────
    updateInterval: 900000,      // 15 minutes (ms)
    animationSpeed: 1500,

    // ── Last updated ───────────────────────────────────────────────────────
    showLastUpdated:       true, // show "Updated HH:MM" line at the bottom
    lastUpdatedTimeFormat: 24,   // 12 | 24

    // ── Alignment ──────────────────────────────────────────────────────────
    // Aligns current conditions, chip row, section labels, and last-updated.
    // "auto"   — follows the module's MagicMirror region (recommended)
    // "left"   | "center" | "right"  — explicit override
    align: "auto",
  }
}
```

---

## Available Fields

### Current & Hourly

| Field | Description |
|---|---|
| `temperature` | Air temperature |
| `feelsLike` | Apparent / feels-like temperature |
| `humidity` | Relative humidity % |
| `windSpeed` | Wind speed km/h |
| `precipitation` | Precipitation amount mm |
| `precipitationProbability` | Chance of rain % (hourly only) |
| `uvIndex` | UV index |

### Daily only

| Field | Description |
|---|---|
| `tempMax` | Daily high temperature |
| `tempMin` | Daily low temperature |
| `precipitation` | Total daily precipitation mm |
| `precipitationProbability` | Max chance of rain % for the day |
| `windSpeed` | Max wind speed km/h |
| `uvIndex` | Max UV index |

---

## Alert Animations

When a rule matches, **only the specific field chip or row** is animated — not the whole card. A precipitation chip can glow while the temperature chip on the same card stays normal.

| Animation | Effect | Motion |
|---|---|---|
| `pulse` | Fades in and out gently | Yes |
| `glow` | Border and shadow breathe in the alert color | Yes |
| `shake` | Horizontal jitter | Yes |
| `flash` | Hard blink | Yes |
| `bounce` | Gentle vertical hop | Yes |
| `highlight` | Static colored background tint + colored border | No |
| `bold` | Value text turns alert color and goes bold | No |

- `target` values: `"hourly"`, `"daily"`, `"both"` (hourly + daily), `"current"`
- `color` is optional per rule — overrides `dangerColor` for that specific rule
- Comparisons are always in SI (°C, km/h, mm) regardless of the `units` display setting
- First matching rule per field wins

---

## Last Updated

When `showLastUpdated: true` (the default), a small "🕒 Updated HH:MM" line appears at the bottom of the module, showing the time of the most recent successful data fetch.

| Option | Default | Description |
|---|---|---|
| `showLastUpdated` | `true` | Show the last-updated timestamp |
| `lastUpdatedTimeFormat` | `24` | `12` for 12-hour (e.g. `2:35 PM`) or `24` for 24-hour (e.g. `14:35`) |

---

## Charts

Set `hourlyMode: "chart"` and/or `dailyMode: "chart"` to replace the card rows with inline SVG charts. No external libraries required — charts are drawn natively and respect your `accentColor`, `units`, and `hourlyFields` / `dailyFields` config.

**Hourly chart** — draws whichever of these are in `hourlyFields`:
- `temperature` → line chart with dots and value labels
- `precipitation` or `precipitationProbability` → semi-transparent bar chart behind the line
- `windSpeed` → faint bar chart (shown only when precipitation is not in the field list)

Weather condition icons and time labels appear on the x-axis.

**Daily chart** — draws whichever of these are in `dailyFields`:
- `tempMax` / `tempMin` → vertical pill showing the day's temperature range, with high/low labels
- `precipitation` or `precipitationProbability` → semi-transparent bar chart

Weather condition icons and day labels appear on the x-axis.

Both charts scale to the module's full width and respect `hourlyCount` / `dailyCount` for how many points to show.

---

## Alignment

The `align` option controls the text/content alignment of the current conditions block, chip row, section labels, and the last-updated line.

| Value | Behaviour |
|---|---|
| `"auto"` *(default)* | Reads `this.data.position` (the MagicMirror region the module is placed in) — left-side regions align left, center aligns center, right-side regions align right |
| `"left"` | Always left-aligned |
| `"center"` | Always centered |
| `"right"` | Always right-aligned |

The hourly and daily forecast cards are unaffected — they always fill the available width as a row.

---

## CSS Theming

Override in your `custom.css`:

```css
.MMM-WeatherPro {
  --wp-accent:  #c8a96e;               /* gold accent */
  --wp-danger:  #ff6b6b;               /* alert color */
  --wp-card-bg: rgba(255,255,255,0.04); /* card background */
}
```

---

## License

MIT
