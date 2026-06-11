/**
 * MMM-WeatherPro
 * A robust, futuristic weather module using Open-Meteo (free, no API key).
 *
 * Features:
 *  - Location by lat/lon with optional auto-resolved place name
 *  - Current conditions display
 *  - Hourly forecast (configurable fields per card)
 *  - Daily forecast (configurable fields per card)
 *  - °C / °F with optional secondary unit
 *  - Condition-triggered animations on hour/day cards
 *  - Futuristic minimal design
 */

Module.register("MMM-WeatherPro", {

  /* ─────────────────────── DEFAULTS ──────────────────────────────────── */
  defaults: {
    // ── Header ─────────────────────────────────────────────────────────────
    showTitle:   true,          // show the MM module header
    titlePrefix: "",            // prefix before the location name e.g. "Weather - "

    // ── Location ──────────────────────────────────────────────────────────
    lat:          null,
    lon:          null,
    showLocation: true,         // auto-resolve city name from lat/lon

    // ── Units ─────────────────────────────────────────────────────────────
    units:            "C",      // "C" | "F"
    showSecondaryUnit: true,    // show the other unit as minor text

    // ── Current conditions ────────────────────────────────────────────────
    showCurrent: true,
    currentFields: [
      "temperature", "feelsLike", "humidity",
      "windSpeed", "uvIndex", "precipitation",
    ],

    // ── Hourly forecast ───────────────────────────────────────────────────
    showHourly:        true,
    showHourlyTitle:   true,        // show "Hourly" section label
    hourlyMode:        "cards",     // "cards" | "chart"
    hourlyCount:       6,           // number of hour cards / chart points to show
    hourlyCardsPerRow: null,        // null = all in one row, or e.g. 4
    hourlyTimeFormat:  24,          // 12 | 24
    showAmPm:          true,        // show AM/PM when hourlyTimeFormat is 12
    // "absolute" — show value only (no delta)
    // "delta"    — show delta only on non-first cards (= when no change)
    // "both"     — show value + delta on non-first cards
    deltaMode:         "both",
    hourlyFields: [
      "temperature", "precipitation", "windSpeed",
    ],

    // ── Daily forecast ────────────────────────────────────────────────────
    showDaily:        true,
    showDailyTitle:   true,         // show "Forecast" section label
    dailyMode:        "cards",      // "cards" | "chart"
    dailyCount:       5,            // number of day cards / chart points to show
    dailyCardsPerRow: null,         // null = all in one row, or e.g. 3
    dailyFields: [
      "tempMax", "tempMin", "precipitation", "windSpeed",
    ],

    // ── Alerts / animations ────────────────────────────────────────────────
    // field:     any weather field
    // operator:  "<" | ">" | "<=" | ">=" | "==" | "!="
    // value:     number (always in SI: °C, mm, km/h)
    // animation: "pulse" | "glow" | "shake" | "flash" | "highlight" | "bounce"
    // target:    "hourly" | "daily" | "both" | "current"
    alerts: [
      { field: "temperature",              operator: "<=", value: 0,  animation: "pulse",     target: "both"   },
      { field: "precipitationProbability", operator: ">=", value: 70, animation: "highlight", target: "hourly" },
      { field: "windSpeed",                operator: ">=", value: 50, animation: "shake",     target: "both"   },
    ],

    // ── Style ─────────────────────────────────────────────────────────────
    accentColor:    "#40c4ff",
    dangerColor:    "#ff4d4d",
    cardBackground: "rgba(255,255,255,0.06)",

    // ── Update interval ───────────────────────────────────────────────────
    updateInterval: 15 * 60 * 1000,   // 15 minutes
    animationSpeed: 1500,

    // ── Last updated ──────────────────────────────────────────────────────
    showLastUpdated:       true,       // show "Updated: HH:MM" line
    lastUpdatedTimeFormat: 24,         // 12 | 24

    // ── Alignment ─────────────────────────────────────────────────────────
    // Controls text/content alignment for current conditions and last-updated.
    // "auto"   — inferred from the module's MagicMirror region (left zones →
    //            left, center zone → center, right zones → right)
    // "left"   | "center" | "right"  — explicit override
    align: "auto",
  },

  /* ─────────────────────── LIFECYCLE ─────────────────────────────────── */
  start () {
    Log.info("[MMM-WeatherPro] Starting…");
    this.weather      = null;
    this.locationName = null;
    this.loaded       = false;
    this.error        = null;
    this.lastUpdated  = null;

    this._fetch();
    setInterval(() => this._fetch(), this.config.updateInterval);
  },

  getStyles () { return ["MMM-WeatherPro.css"]; },

  getHeader () {
    if (!this.config.showTitle) return undefined;
    if (this.config.showLocation && this.locationName) {
      return (this.config.titlePrefix || "") + this.locationName;
    }
    return this.config.titlePrefix || undefined;
  },

  _fetch () {
    this.sendSocketNotification("WP_FETCH", {
      lat:          this.config.lat,
      lon:          this.config.lon,
      showLocation: this.config.showLocation,
    });
  },

  socketNotificationReceived (notification, payload) {
    if (notification === "WP_DATA") {
      this.weather      = payload.weather;
      this.locationName = payload.locationName;
      this.loaded       = true;
      this.error        = null;
      this.lastUpdated  = new Date();
      this.updateDom(this.config.animationSpeed);
    }
    if (notification === "WP_ERROR") {
      this.error = payload.message;
      this.updateDom(this.config.animationSpeed);
    }
  },

  /* ─────────────────────── DOM ────────────────────────────────────────── */
  getDom () {
    const wrapper = document.createElement("div");
    wrapper.className = "MMM-WeatherPro";
    wrapper.style.setProperty("--wp-accent",  this.config.accentColor);
    wrapper.style.setProperty("--wp-danger",  this.config.dangerColor);
    wrapper.style.setProperty("--wp-card-bg", this.config.cardBackground);

    const align = this._resolveAlign();
    const justifyMap = { left: "flex-start", center: "center", right: "flex-end" };
    const alignItemsMap = { left: "flex-start", center: "center", right: "flex-end" };
    wrapper.style.setProperty("--wp-align",       align);
    wrapper.style.setProperty("--wp-justify",     justifyMap[align]  || "flex-start");
    wrapper.style.setProperty("--wp-align-items", alignItemsMap[align] || "flex-start");

    if (!this.loaded && !this.error) {
      wrapper.innerHTML = `<div class="wp-loading">
        <div class="wp-spinner"></div>
        <span>Loading weather…</span>
      </div>`;
      return wrapper;
    }

    if (this.error) {
      wrapper.innerHTML = `<div class="wp-error">⚠ ${this.error}</div>`;
      return wrapper;
    }

    // Current conditions
    if (this.config.showCurrent && this.weather.current) {
      wrapper.appendChild(this._buildCurrent());
    }

    // Hourly forecast
    if (this.config.showHourly && this.weather.hourly) {
      const section = document.createElement("div");
      section.className = "wp-section";
      if (this.config.showHourlyTitle) {
        const title = document.createElement("div");
        title.className = "wp-section-title";
        title.textContent = "Hourly";
        section.appendChild(title);
      }
      section.appendChild(
        this.config.hourlyMode === "chart"
          ? this._buildHourlyChart()
          : this._buildHourlyRow()
      );
      wrapper.appendChild(section);
    }

    // Daily forecast
    if (this.config.showDaily && this.weather.daily) {
      const section = document.createElement("div");
      section.className = "wp-section";
      if (this.config.showDailyTitle) {
        const title = document.createElement("div");
        title.className = "wp-section-title";
        title.textContent = "Forecast";
        section.appendChild(title);
      }
      section.appendChild(
        this.config.dailyMode === "chart"
          ? this._buildDailyChart()
          : this._buildDailyRow()
      );
      wrapper.appendChild(section);
    }

    // Last updated
    if (this.config.showLastUpdated && this.lastUpdated) {
      wrapper.appendChild(this._buildLastUpdated());
    }

    return wrapper;
  },

  /* ─────────────────────── CURRENT ───────────────────────────────────── */
  _buildCurrent () {
    const c  = this.weather.current;
    const el = document.createElement("div");
    el.className = "wp-current";

    const tempVal = this._temp(c.temperature_2m);

    // Header row: icon left, temps right — mirrors hourly/daily card layout
    const header = document.createElement("div");
    header.className = "wp-current-header";
    header.innerHTML = `
      <span class="wp-current-temps">
        <span class="wp-temp-big">${tempVal.primary}<sup class="wp-temp-unit">${this._unitSymbol()}</sup></span>
        ${tempVal.secondary ? `<span class="wp-temp-big wp-temp-secondary">${tempVal.secondary}<sup class="wp-temp-unit">${this._secondaryUnitSymbol()}</sup></span>` : ""}
        <span class="wp-cond-icon">${this._weatherIcon(c.weather_code)}</span>
      </span>
    `;
    el.appendChild(header);

    // Fields row (chips)
    const fields = this.config.currentFields.filter(f => f !== "temperature");
    if (fields.length) {
      const grid = document.createElement("div");
      grid.className = "wp-current-grid";
      for (const field of fields) {
        const item = this._buildFieldChip(field, c, undefined, "current");
        if (item) grid.appendChild(item);
      }
      el.appendChild(grid);
    }

    return el;
  },

  /* ─────────────────────── HOURLY ─────────────────────────────────────── */
  _buildHourlyRow () {
    const row = document.createElement("div");
    row.className = "wp-forecast-row";
    if (this.config.hourlyCardsPerRow) {
      row.style.setProperty("--wp-cards-per-row", this.config.hourlyCardsPerRow);
      row.classList.add("wp-row-grid");
    }

    const hours = this.weather.hourly;
    const now   = new Date();
    // Find current hour index
    let startIdx = 0;
    for (let i = 0; i < hours.time.length; i++) {
      const t = new Date(hours.time[i]);
      if (t >= now) { startIdx = i; break; }
    }

    for (let i = startIdx; i < startIdx + this.config.hourlyCount && i < hours.time.length; i++) {
      const card = this._buildHourCard(hours, i, i === startIdx);
      row.appendChild(card);
    }

    return row;
  },

  _buildHourCard (hours, idx, isFirst) {
    const card = document.createElement("div");
    card.className = "wp-card";

    const time = new Date(hours.time[idx]);
    const timeEl = document.createElement("div");
    timeEl.className = "wp-card-time";
    if (this.config.hourlyTimeFormat === 12) {
      const h   = time.getHours();
      const h12 = h % 12 || 12;
      const ampm = h < 12 ? "AM" : "PM";
      timeEl.textContent = this.config.showAmPm ? `${h12} ${ampm}` : `${h12}`;
    } else {
      timeEl.textContent = time.getHours().toString().padStart(2, "0") + ":00";
    }

    const icon = document.createElement("span");
    icon.className = "wp-card-icon";
    icon.textContent = this._weatherIcon(hours.weather_code?.[idx] ?? 0);

    // Header row: time left, icon right
    const header = document.createElement("div");
    header.className = "wp-card-header";
    header.appendChild(timeEl);
    header.appendChild(icon);
    card.appendChild(header);

    for (const field of this.config.hourlyFields) {
      const item = this._buildFieldRow(field, hours, idx, "hourly", isFirst ? null : idx - 1);
      if (item) card.appendChild(item);
    }

    return card;
  },

  /* ─────────────────────── DAILY ──────────────────────────────────────── */
  _buildDailyRow () {
    const row = document.createElement("div");
    row.className = "wp-forecast-row";
    if (this.config.dailyCardsPerRow) {
      row.style.setProperty("--wp-cards-per-row", this.config.dailyCardsPerRow);
      row.classList.add("wp-row-grid");
    }

    const days = this.weather.daily;
    for (let i = 0; i < this.config.dailyCount && i < days.time.length; i++) {
      const card = this._buildDayCard(days, i, i === 0);
      row.appendChild(card);
    }

    return row;
  },

  _buildDayCard (days, idx, isFirst) {
    const card = document.createElement("div");
    card.className = "wp-card";

    const date = new Date(days.time[idx] + "T00:00:00");
    const dayEl = document.createElement("div");
    dayEl.className = "wp-card-time";
    dayEl.textContent = idx === 0
      ? "Today"
      : date.toLocaleDateString(undefined, { weekday: "short" });

    const icon = document.createElement("span");
    icon.className = "wp-card-icon";
    icon.textContent = this._weatherIcon(days.weather_code?.[idx] ?? 0);

    // Header row: day left, icon right
    const header = document.createElement("div");
    header.className = "wp-card-header";
    header.appendChild(dayEl);
    header.appendChild(icon);
    card.appendChild(header);

    for (const field of this.config.dailyFields) {
      const item = this._buildFieldRow(field, days, idx, "daily", isFirst ? null : idx - 1);
      if (item) card.appendChild(item);
    }

    return card;
  },

  /* ─────────────────────── HOURLY CHART ───────────────────────────────── */
  _buildHourlyChart () {
    const wrap = document.createElement("div");
    wrap.className = "wp-chart-wrap";
    const draw = (W) => {
      wrap.innerHTML = "";
      wrap.appendChild(this._renderHourlyChartSvg(W));
    };
    const getW = () => {
      // Walk up to find the MM .module container which has the true region width
      let el = wrap;
      while (el && !el.classList?.contains("module")) el = el.parentElement;
      return el ? el.offsetWidth : wrap.offsetWidth;
    };
    const ro = new ResizeObserver(() => {
      const W = getW();
      if (W > 0) draw(W);
    });
    // Observe the wrap; once connected, also observe the .module ancestor
    ro.observe(wrap);
    requestAnimationFrame(() => {
      const W = getW();
      if (W > 0) draw(W);
      let el = wrap;
      while (el && !el.classList?.contains("module")) el = el.parentElement;
      if (el) ro.observe(el);
    });
    return wrap;
  },

  _renderHourlyChartSvg (W) {
    const hours    = this.weather.hourly;
    const now      = new Date();
    let startIdx   = 0;
    for (let i = 0; i < hours.time.length; i++) {
      if (new Date(hours.time[i]) >= now) { startIdx = i; break; }
    }
    const count  = Math.min(this.config.hourlyCount, hours.time.length - startIdx);
    const fields = this.config.hourlyFields;

    const padL   = 0;
    const padR   = 0;
    const padTop = 18;
    const showWind   = fields.includes("windSpeed");
    const padBot = showWind ? 44 : 32;  // extra row for wind labels when shown
    const plotW  = W - padL - padR;
    const plotH  = 70;
    const H      = plotH + padTop + padBot;
    const slotW  = plotW / count;

    const accent    = this.config.accentColor;
    const rain      = "#60aaff";
    const windColor = "rgba(255,255,255,0.55)";

    const slice = (arr) => arr ? Array.from({ length: count }, (_, k) => arr[startIdx + k] ?? null) : [];
    const temps   = slice(hours.temperature_2m);
    const precip  = slice(hours.precipitation);
    const precipP = slice(hours.precipitation_probability);
    const winds   = slice(hours.wind_speed_10m);
    const codes   = slice(hours.weather_code);
    const times   = slice(hours.time).map(t => new Date(t));

    const xOf  = (i) => padL + slotW * i + slotW / 2;
    const norm = (v, min, max) => max === min ? 0.5 : (v - min) / (max - min);

    // ── Temperature line ──────────────────────────────────────────────────
    const dispTemps = temps.map(v => v === null ? null
      : this.config.units === "F" ? Math.round(v * 9/5 + 32) : Math.round(v));
    const tMin = Math.min(...dispTemps.filter(v => v !== null));
    const tMax = Math.max(...dispTemps.filter(v => v !== null));
    const tPad = Math.max(3, (tMax - tMin) * 0.15);
    const yTemp = (v) => padTop + plotH - plotH * norm(v, tMin - tPad, tMax + tPad);

    const showTemp = fields.includes("temperature");
    let area = "", line = "", dots = "", tempLabels = "";
    if (showTemp) {
      const pts = dispTemps.map((v, i) => v === null ? null : [xOf(i), yTemp(v)]).filter(Boolean);
      if (pts.length > 1) {
        const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
        const areaD = pathD
          + ` L${pts[pts.length-1][0].toFixed(1)},${(padTop+plotH).toFixed(1)}`
          + ` L${pts[0][0].toFixed(1)},${(padTop+plotH).toFixed(1)} Z`;
        area = `<path d="${areaD}" fill="${accent}" opacity="0.08"/>`;
        line = `<path d="${pathD}" fill="none" stroke="${accent}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      for (let i = 0; i < count; i++) {
        if (dispTemps[i] === null) continue;
        const [cx, cy] = [xOf(i), yTemp(dispTemps[i])];
        dots += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.5" fill="${accent}"/>`;
        const labelY = Math.max(padTop - 2, cy - 5);
        tempLabels += `<text x="${cx.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" fill="${accent}" font-size="7" font-family="inherit">${dispTemps[i]}${this._unitSymbol()}</text>`;
      }
    }

    // ── Precipitation bars ────────────────────────────────────────────────
    const showPrecip  = fields.includes("precipitation") || fields.includes("precipitationProbability");
    const precipData  = fields.includes("precipitationProbability") ? precipP : precip;
    const precipMax   = fields.includes("precipitationProbability") ? 100 : Math.max(1, ...precipData.filter(Boolean));
    const barW        = slotW * 0.45;
    let bars = "";
    if (showPrecip) {
      for (let i = 0; i < count; i++) {
        const v = precipData[i];
        if (v === null || v <= 0) continue;
        const bh = plotH * (v / precipMax);
        const bx = xOf(i) - barW / 2;
        const by = padTop + plotH - bh;
        bars += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${rain}" opacity="0.35" rx="2"/>`;
      }
    }

    // ── Wind: directional arrow + value labels below the baseline ────────
    const windBaseY = padTop + plotH;
    const windLblY  = windBaseY + 14;
    const windDirs  = showWind ? slice(hours.wind_direction_10m) : [];
    let windLabels = "";
    if (showWind) {
      for (let i = 0; i < count; i++) {
        if (winds[i] === null) continue;
        const arrow = this._windDir(windDirs[i]);
        windLabels += `<text x="${xOf(i).toFixed(1)}" y="${windLblY.toFixed(1)}" text-anchor="middle" fill="${windColor}" font-size="8" font-family="inherit">${Math.round(winds[i])} ${arrow}</text>`;
      }
    }

    // ── X-axis: weather icons + time labels ───────────────────────────────
    const iconY = windBaseY + (showWind ? 26 : 10);
    const lblY  = windBaseY + (showWind ? 38 : 26);
    let xLabels = "", icons = "";
    for (let i = 0; i < count; i++) {
      const t  = times[i];
      const cx = xOf(i);
      let label;
      if (this.config.hourlyTimeFormat === 12) {
        const h = t.getHours(); const h12 = h % 12 || 12;
        const ampm = h < 12 ? "AM" : "PM";
        label = this.config.showAmPm ? `${h12}${ampm}` : `${h12}`;
      } else {
        label = t.getHours().toString().padStart(2, "0") + ":00";
      }
      icons   += `<text x="${cx.toFixed(1)}" y="${iconY.toFixed(1)}" text-anchor="middle" font-size="10">${this._weatherIcon(codes[i] ?? 0)}</text>`;
      xLabels += `<text x="${cx.toFixed(1)}" y="${lblY.toFixed(1)}" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-size="8" font-family="inherit">${label}</text>`;
    }

    const baseLine = `<line x1="${padL}" y1="${padTop + plotH}" x2="${W - padR}" y2="${padTop + plotH}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", H);
    svg.setAttribute("class", "wp-chart");
    svg.innerHTML = baseLine + bars + area + line + dots + tempLabels + windLabels + icons + xLabels;
    return svg;
  },

  /* ─────────────────────── DAILY CHART ────────────────────────────────── */
  _buildDailyChart () {
    const wrap = document.createElement("div");
    wrap.className = "wp-chart-wrap";
    const draw = (W) => {
      wrap.innerHTML = "";
      wrap.appendChild(this._renderDailyChartSvg(W));
    };
    const ro = new ResizeObserver(entries => {
      const W = Math.floor(entries[0].contentRect.width);
      if (W > 0) draw(W);
    });
    ro.observe(wrap);
    return wrap;
  },

  _renderDailyChartSvg (W) {
    const days   = this.weather.daily;
    const count  = Math.min(this.config.dailyCount, days.time.length);
    const fields = this.config.dailyFields;

    const padL   = 0;
    const padR   = 0;
    const padTop = 18;
    const showWind = fields.includes("windSpeed");
    const padBot = showWind ? 44 : 24;
    const plotW  = W - padL - padR;
    const plotH  = 70;
    const H      = plotH + padTop + padBot;
    const slotW  = plotW / count;

    const accent = this.config.accentColor;
    const rain   = "#60aaff";

    const slice = (arr) => arr ? Array.from({ length: count }, (_, k) => arr[k] ?? null) : [];
    const maxRaw  = slice(days.temperature_2m_max);
    const minRaw  = slice(days.temperature_2m_min);
    const precip  = slice(days.precipitation);
    const precipP = slice(days.precipitation_probability);
    const codes   = slice(days.weather_code);
    const times   = slice(days.time).map(t => new Date(t + "T00:00:00"));

    const toDisp = (v) => v === null ? null
      : this.config.units === "F" ? Math.round(v * 9/5 + 32) : Math.round(v);
    const dispMax = maxRaw.map(toDisp);
    const dispMin = minRaw.map(toDisp);

    const allTemps = [...dispMax, ...dispMin].filter(v => v !== null);
    const tMin  = Math.min(...allTemps);
    const tMax  = Math.max(...allTemps);
    const tPad  = Math.max(3, (tMax - tMin) * 0.15);
    const yTemp = (v) => padTop + plotH - plotH * ((v - (tMin - tPad)) / ((tMax + tPad) - (tMin - tPad)));

    const xOf  = (i) => padL + slotW * i + slotW / 2;

    // ── Precipitation bars ────────────────────────────────────────────────
    const showPrecip  = fields.includes("precipitation") || fields.includes("precipitationProbability");
    const precipData  = fields.includes("precipitationProbability") ? precipP : precip;
    const precipMax   = fields.includes("precipitationProbability") ? 100 : Math.max(1, ...precipData.filter(Boolean));
    const barW        = slotW * 0.35;
    let precipBars = "";
    if (showPrecip) {
      for (let i = 0; i < count; i++) {
        const v = precipData[i];
        if (!v || v <= 0) continue;
        const bh = plotH * (v / precipMax);
        const bx = xOf(i) - barW / 2;
        const by = padTop + plotH - bh;
        precipBars += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${rain}" opacity="0.35" rx="2"/>`;
      }
    }

    // ── Temperature range pills ───────────────────────────────────────────
    const showRange = fields.includes("tempMax") || fields.includes("tempMin");
    let rangeBars = "", rangeLabels = "";
    if (showRange) {
      for (let i = 0; i < count; i++) {
        if (dispMax[i] === null || dispMin[i] === null) continue;
        const yHi = yTemp(dispMax[i]);
        const yLo = yTemp(dispMin[i]);
        const cx  = xOf(i);
        const rh  = Math.max(2, yLo - yHi);
        rangeBars   += `<rect x="${(cx - 3).toFixed(1)}" y="${yHi.toFixed(1)}" width="6" height="${rh.toFixed(1)}" fill="${accent}" opacity="0.55" rx="3"/>`;
        rangeLabels += `<text x="${cx.toFixed(1)}" y="${(yHi - 3).toFixed(1)}" text-anchor="middle" fill="${accent}" font-size="7" font-family="inherit">${dispMax[i]}°</text>`;
        rangeLabels += `<text x="${cx.toFixed(1)}" y="${(yLo + 8).toFixed(1)}" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="7" font-family="inherit">${dispMin[i]}°</text>`;
      }
    }

    // ── Wind: directional arrow + value labels below baseline ────────────
    const winds     = slice(days.wind_speed_10m);
    const windDirs  = slice(days.wind_direction_10m);
    const windColor = "rgba(255,255,255,0.55)";
    const windBaseY = padTop + plotH;
    const windLblY  = windBaseY + 14;
    let windLabels = "";
    if (showWind) {
      for (let i = 0; i < count; i++) {
        if (winds[i] === null) continue;
        const arrow = this._windDir(windDirs[i]);
        windLabels += `<text x="${xOf(i).toFixed(1)}" y="${windLblY.toFixed(1)}" text-anchor="middle" fill="${windColor}" font-size="8" font-family="inherit">${Math.round(winds[i])} ${arrow}</text>`;
      }
    }

    // ── X-axis: weather icons + day labels ───────────────────────────────
    const iconY = windBaseY + (showWind ? 26 : 10);
    const lblY  = windBaseY + (showWind ? 38 : 22);
    let icons = "", xLabels = "";
    for (let i = 0; i < count; i++) {
      const cx    = xOf(i);
      const label = i === 0 ? "Today" : times[i].toLocaleDateString(undefined, { weekday: "short" });
      icons   += `<text x="${cx.toFixed(1)}" y="${iconY.toFixed(1)}" text-anchor="middle" font-size="10">${this._weatherIcon(codes[i] ?? 0)}</text>`;
      xLabels += `<text x="${cx.toFixed(1)}" y="${lblY.toFixed(1)}" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-size="8" font-family="inherit">${label}</text>`;
    }

    const baseLine = `<line x1="${padL}" y1="${padTop + plotH}" x2="${W - padR}" y2="${padTop + plotH}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", H);
    svg.setAttribute("class", "wp-chart");
    svg.innerHTML = baseLine + precipBars + rangeBars + rangeLabels + windLabels + icons + xLabels;
    return svg;
  },

  _applyAlertToEl (el, field, data, idx, target) {
    if (!target) return;
    const raw = this._rawFieldValue(field, data, idx);
    if (raw === null) return;
    for (const rule of this.config.alerts) {
      if (rule.field !== field) continue;
      if (rule.target !== target && rule.target !== "both" &&
          !(rule.target === "current" && target === "current")) continue;
      const matches = {
        "<": raw < rule.value, ">": raw > rule.value,
        "<=": raw <= rule.value, ">=": raw >= rule.value,
        "==": raw === rule.value, "!=": raw !== rule.value,
      }[rule.operator];
      if (matches && rule.animation) {
        const color = rule.color || this.config.dangerColor;
        el.classList.add(`wp-anim-${rule.animation}`);
        el.style.setProperty("--wp-anim-color", color);
        if (rule.animation === "highlight") {
          el.style.background = this._hexToRgba(color, 0.25) || "rgba(255,77,77,0.25)";
        }
        break;
      }
    }
  },

  _hexToRgba (hex, alpha) {
    if (!hex || !hex.startsWith("#")) return null;
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    if (isNaN(r)) return null;
    return `rgba(${r},${g},${b},${alpha})`;
  },

  /* ─────────────────────── FIELD ROW (compact, inside cards) ──────────── */
  _buildFieldRow (field, data, idx, target, prevIdx) {
    const val = this._fieldValue(field, data, idx);
    if (val === null) return null;

    const row = document.createElement("div");
    row.className = "wp-field-row";

    let deltaEl = "";
    let showVal = true;

    if (prevIdx !== undefined && prevIdx !== null && this.config.deltaMode !== "absolute") {
      const curr = this._rawFieldValue(field, data, idx);
      const prev = this._rawFieldValue(field, data, prevIdx);
      if (curr !== null && prev !== null) {
        const diff = curr - prev;
        if (Math.abs(diff) >= 0.1) {
          const isTemp = ["temperature","feelsLike","tempMax","tempMin"].includes(field);
          const abs    = isTemp ? Math.abs(Math.round(diff)) : Math.abs(diff) < 1 ? Math.abs(diff).toFixed(1) : Math.abs(Math.round(diff));
          const sign   = diff > 0 ? "↑" : "↓";
          const cls    = diff > 0 ? "wp-delta-up" : "wp-delta-down";
          deltaEl = `<span class="${cls}">${sign}${abs}</span>`;
        } else if (this.config.deltaMode === "delta") {
          deltaEl = `<span class="wp-delta-eq">=</span>`;
        }
        if (this.config.deltaMode === "delta") showVal = false;
      }
    }

    const valPart = showVal ? `<span class="wp-field-val">${val}</span>` : "";
    row.innerHTML = `<span class="wp-field-icon">${this._fieldIcon(field)}</span>${valPart}${deltaEl}`;
    this._applyAlertToEl(row, field, data, idx, target);
    return row;
  },

  /* ─────────────────────── FIELD CHIP (used in current grid) ──────────── */
  _buildFieldChip (field, data, idx, target) {
    const val = this._fieldValue(field, data, idx);
    if (val === null) return null;

    const chip = document.createElement("div");
    chip.className = "wp-chip";
    chip.innerHTML = `
      <span class="wp-chip-icon">${this._fieldIcon(field)}</span>
      <span class="wp-chip-val">${val}</span>
    `;
    this._applyAlertToEl(chip, field, data, idx, target);
    return chip;
  },

  /* ─────────────────────── VALUE HELPERS ──────────────────────────────── */
  _rawFieldValue (field, data, idx) {
    const map = {
      temperature:              () => idx !== undefined ? data.temperature_2m?.[idx]      : data.temperature_2m,
      feelsLike:                () => idx !== undefined ? data.apparent_temperature?.[idx] : data.apparent_temperature,
      humidity:                 () => idx !== undefined ? data.relative_humidity_2m?.[idx] : data.relative_humidity_2m,
      windSpeed:                () => idx !== undefined ? data.wind_speed_10m?.[idx]       : data.wind_speed_10m,
      precipitation:            () => idx !== undefined ? data.precipitation?.[idx]        : data.precipitation,
      precipitationProbability: () => idx !== undefined ? data.precipitation_probability?.[idx] : null,
      uvIndex:                  () => idx !== undefined ? data.uv_index?.[idx]             : data.uv_index,
      tempMax:                  () => data.temperature_2m_max?.[idx],
      tempMin:                  () => data.temperature_2m_min?.[idx],
    };
    return map[field] ? (map[field]() ?? null) : null;
  },

  _fieldValue (field, data, idx) {
    const raw = this._rawFieldValue(field, data, idx);
    if (raw === null) return null;

    switch (field) {
      case "temperature":
      case "feelsLike":
      case "tempMax":
      case "tempMin": {
        const t = this._temp(raw);
        return `${t.primary}${this._unitSymbol()}`;
      }
      case "humidity":                 return `${Math.round(raw)}%`;
      case "windSpeed":                return `${Math.round(raw)} km/h`;
      case "precipitation":            return `${raw.toFixed(1)} mm`;
      case "precipitationProbability": return `${Math.round(raw)}%`;
      case "uvIndex":                  return `UV ${Math.round(raw)}`;
      default:                         return `${raw}`;
    }
  },

  _fieldIcon (field) {
    return {
      temperature:              "🌡",
      feelsLike:                "🤔",
      humidity:                 "💧",
      windSpeed:                "💨",
      precipitation:            "🌧",
      precipitationProbability: "☔",
      uvIndex:                  "☀️",
      tempMax:                  "🔺",
      tempMin:                  "🔻",
    }[field] || "•";
  },

  /* ─────────────────────── ALIGNMENT ─────────────────────────────────── */
  _resolveAlign () {
    if (this.config.align && this.config.align !== "auto") {
      return this.config.align;  // explicit override
    }
    // MagicMirror sets this.data.position before start() is called.
    // Values are e.g. "top_left", "top_center", "top_right",
    // "bottom_left", "bottom_center", "bottom_right",
    // "upper_third", "middle_center", "lower_third", etc.
    const pos = (this.data && this.data.position) ? this.data.position : "";
    if (pos.includes("right"))  return "right";
    if (pos.includes("center") || pos.includes("middle")) return "center";
    return "left";  // left, upper_third, lower_third, full_width, etc.
  },

  /* ─────────────────────── LAST UPDATED ──────────────────────────────── */
  _buildLastUpdated () {
    const el = document.createElement("div");
    el.className = "wp-last-updated";

    const d = this.lastUpdated;
    let timeStr;
    if (this.config.lastUpdatedTimeFormat === 12) {
      const h    = d.getHours();
      const h12  = h % 12 || 12;
      const ampm = h < 12 ? "AM" : "PM";
      const m    = d.getMinutes().toString().padStart(2, "0");
      timeStr = `${h12}:${m} ${ampm}`;
    } else {
      const h = d.getHours().toString().padStart(2, "0");
      const m = d.getMinutes().toString().padStart(2, "0");
      timeStr = `${h}:${m}`;
    }

    el.innerHTML = `<span class="wp-last-updated-icon">🕒</span> Updated ${timeStr}`;
    return el;
  },

  /* ─────────────────────── TEMPERATURE ────────────────────────────────── */
  _temp (celsius) {
    const primary = this.config.units === "F"
      ? Math.round(celsius * 9 / 5 + 32)
      : Math.round(celsius);
    const secondary = this.config.showSecondaryUnit
      ? (this.config.units === "F" ? Math.round(celsius) : Math.round(celsius * 9 / 5 + 32))
      : null;
    return { primary, secondary };
  },

  _unitSymbol ()          { return this.config.units === "F" ? "°F" : "°C"; },
  _secondaryUnitSymbol () { return this.config.units === "F" ? "°C" : "°F"; },

  /* ─────────────────────── WEATHER CODES ──────────────────────────────── */
  _windDir (deg) {
    const dirs = ["N","NE","E","SE","S","SW","W","NW"];
    return dirs[Math.round(((deg ?? 0) % 360) / 45) % 8];
  },

  _weatherIcon (code) {
    if (code === 0)                    return "☀️";
    if (code <= 2)                     return "⛅";
    if (code === 3)                    return "☁️";
    if (code <= 49)                    return "🌫";
    if (code <= 57)                    return "🌧";
    if (code <= 67)                    return "🌧";
    if (code <= 77)                    return "❄️";
    if (code <= 82)                    return "🌦";
    if (code <= 86)                    return "🌨";
    if (code <= 99)                    return "⛈";
    return "🌡";
  },

  _weatherDesc (code) {
    const descs = {
      0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
      45: "Fog", 48: "Icy fog",
      51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
      61: "Light rain", 63: "Rain", 65: "Heavy rain",
      71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
      80: "Showers", 81: "Rain showers", 82: "Heavy showers",
      85: "Snow showers", 86: "Heavy snow showers",
      95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Severe thunderstorm",
    };
    return descs[code] || "Unknown";
  },
});
