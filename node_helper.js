/**
 * MMM-WeatherPro — node_helper.js
 * Fetches weather from Open-Meteo (free, no API key required).
 * Geocodes lat/lon to city name via Nominatim.
 */

const NodeHelper = require("node_helper");
const https      = require("https");
const http       = require("http");
const fs         = require("fs");
const path       = require("path");

const CACHE_FILE = path.join(__dirname, ".cache", "weather.json");

module.exports = NodeHelper.create({

  start () {
    console.log("[MMM-WeatherPro] Node helper started.");
    const cacheDir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    this._locationCache = {};
  },

  socketNotificationReceived (notification, payload) {
    if (notification === "WP_FETCH") {
      this._fetchWeather(payload);
    }
  },

  /* ─────────────────────── WEATHER FETCH ─────────────────────────────── */
  async _fetchWeather ({ lat, lon, showLocation }) {
    try {
      const [weatherData, locationName] = await Promise.all([
        this._fetchOpenMeteo(lat, lon),
        showLocation ? this._geocodeReverse(lat, lon) : Promise.resolve(null),
      ]);

      const payload = { weather: weatherData, locationName };

      // Cache to disk
      try { fs.writeFileSync(CACHE_FILE, JSON.stringify({ ts: Date.now(), ...payload })); } catch (_) {}

      this.sendSocketNotification("WP_DATA", payload);
    } catch (err) {
      console.error("[MMM-WeatherPro] Fetch error:", err.message);

      // Try disk cache
      try {
        const cached = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
        console.log("[MMM-WeatherPro] Serving cached weather data.");
        this.sendSocketNotification("WP_DATA", { weather: cached.weather, locationName: cached.locationName });
        return;
      } catch (_) {}

      this.sendSocketNotification("WP_ERROR", { message: `Failed to fetch weather: ${err.message}` });
    }
  },

  async _fetchOpenMeteo (lat, lon) {
    const params = new URLSearchParams({
      latitude:  lat,
      longitude: lon,
      timezone:  "auto",

      // Current
      current: [
        "temperature_2m", "apparent_temperature", "relative_humidity_2m",
        "precipitation", "weather_code", "wind_speed_10m",
        "uv_index",
      ].join(","),

      // Hourly — next 48 hours
      hourly: [
        "temperature_2m", "apparent_temperature", "relative_humidity_2m",
        "precipitation_probability", "precipitation", "weather_code",
        "wind_speed_10m", "wind_direction_10m", "uv_index",
      ].join(","),
      forecast_hours: 48,

      // Daily — next 16 days
      daily: [
        "temperature_2m_max", "temperature_2m_min",
        "precipitation_sum", "precipitation_probability_max",
        "weather_code", "wind_speed_10m_max", "wind_direction_10m_dominant",
        "uv_index_max",
      ].join(","),
      forecast_days: 16,
    });

    const url  = `https://api.open-meteo.com/v1/forecast?${params}`;
    const body = await this._httpGet(url);
    const data = JSON.parse(body);

    if (!data.current) throw new Error("Invalid Open-Meteo response");

    // Normalize daily field names for consistency with hourly
    if (data.daily) {
      data.daily.precipitation        = data.daily.precipitation_sum;
      data.daily.precipitation_probability = data.daily.precipitation_probability_max;
      data.daily.wind_speed_10m        = data.daily.wind_speed_10m_max;
      data.daily.wind_direction_10m    = data.daily.wind_direction_10m_dominant;
      data.daily.uv_index              = data.daily.uv_index_max;
    }

    return data;
  },

  /* ─────────────────────── REVERSE GEOCODE ───────────────────────────── */
  async _geocodeReverse (lat, lon) {
    const key = `${lat},${lon}`;
    if (this._locationCache[key]) return this._locationCache[key];

    try {
      const url  = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`;
      const body = await this._httpGet(url, { "User-Agent": "MMM-WeatherPro/1.0" });
      const data = JSON.parse(body);
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.county || addr.state || "Unknown";
      this._locationCache[key] = city;
      return city;
    } catch (_) {
      return null;
    }
  },

  /* ─────────────────────── HTTP ───────────────────────────────────────── */
  _httpGet (url, headers = {}) {
    return new Promise((resolve, reject) => {
      const lib     = url.startsWith("https") ? https : http;
      const options = { timeout: 15000, headers };
      const req = lib.get(url, options, res => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => resolve(data));
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
    });
  },
});
