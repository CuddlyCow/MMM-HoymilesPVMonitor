/* MagicMirror² Module: MMM-HoymilesPVMonitor
 * Displays live PV power and energy data from Hoymiles DTU using a Chart.js donut chart.
 * Author: Jochen Temmen
 */

Module.register("MMM-HoymilesPVMonitor", {
  // Default config values (can be overridden in config.js)
  defaults: {
    updateInterval: 5 * 60 * 1000, // Update every 5 minutes
    dataFile: "/modules/MMM-HoymilesPVMonitor/public/history_daily.json",
    iconToday: "/modules/MMM-HoymilesPVMonitor/public/today.svg",
    iconTotal: "/modules/MMM-HoymilesPVMonitor/public/total.svg",
  },

  // Called when the module is loaded
  start() {
    Log.info("MMM-HoymilesPVMonitor started with DTU-IP: " + this.config.dtuIp);

    this.pvdata = {
      power: "--",
      energy_daily: "--",
      energy_total: "--"
    };

    // Request initial data from node_helper
    this.loadData();
    this.scheduleUpdate();
    this.sendSocketNotification("GET_PV_DATA", {
      dtuIp: this.config.dtuIp,
      maxPower: this.config.maxPower,
      updateInterval: this.config.updateInterval
    });
  },

  // Request data regularly
  scheduleUpdate() {
    setInterval(() => {
      this.sendSocketNotification("GET_PV_DATA", {
        dtuIp: this.config.dtuIp,
        maxPower: this.config.maxPower,
        updateInterval: this.config.updateInterval
      });
    }, this.config.updateInterval);
  },

  // Handle notification from node_helper when data is ready
  socketNotificationReceived(notification, payload) {
    if (notification === "PV_DATA_READY") {
      this.loadData(); // Only reload data from file
    }
  },

  // Load JSON data and trigger redraw
  loadData() {
    fetch(this.config.dataFile)
      .then(res => res.json())
      .then(json => {
        if (Array.isArray(json) && json.length > 0) {
          // <-- NEW: pick the last entry of the history
          this.pvdata = json[json.length - 1];
        } else {
          console.warn("HoymilesPVMonitor: history_daily.json is empty or invalid");
          this.pvdata = { power: 0, energy_daily: 0, energy_total: 0 };
        }
        this.updateDom();
      })
      .catch(err => {
        console.error("HoymilesPVMonitor: Failed to load history_daily.json:", err);
      });
  },

  // Load Chart.js from CDN
  getScripts() {
    return ["https://cdn.jsdelivr.net/npm/chart.js"];
  },

  // Render the module's DOM
  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "small bright MMM-HoymilesPVMonitor";
    wrapper.style.position = "relative";
    wrapper.style.margin = "0 auto";

    // Container for canvas + overlays
    const container = document.createElement("div");
    container.style.position = "relative";
    container.style.width = "95%";
    container.style.height = "auto";
    container.style.margin = "0 auto";

    // Chart canvas
    const canvas = document.createElement("canvas");
    canvas.id = "pvChart";
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    container.appendChild(canvas);

    // Power overlay in center
    const powerOverlay = document.createElement("div");
    powerOverlay.style.position = "absolute";
    powerOverlay.style.top = "45%";
    powerOverlay.style.left = "50%";
    powerOverlay.style.transform = "translate(-50%, -50%)";
    powerOverlay.style.fontSize = "2.0rem";
    powerOverlay.className = "bright";
    powerOverlay.innerHTML = `${this.pvdata.power ?? "--"} W`;
    container.appendChild(powerOverlay);

    // Energy data overlay at bottom
    const overlay = document.createElement("div");
    overlay.style.position = "absolute";
    overlay.style.bottom = "8px";
    overlay.style.left = "0px";
    overlay.style.width = "100%";
    overlay.style.display = "flex";
    overlay.style.justifyContent = "space-between";
    overlay.style.alignItems = "center";
    overlay.style.fontSize = "0.9rem";

    // Today energy
    const todayWrapper = document.createElement("div");
    todayWrapper.style.display = "flex";
    todayWrapper.style.alignItems = "center";
    todayWrapper.style.gap = "6px";

    const todayIcon = document.createElement("img");
    todayIcon.src = this.config.iconToday;
    todayIcon.style.height = "25px";
    todayIcon.style.width = "auto";

    const todayText = document.createElement("span");
    todayText.innerHTML = `${this.pvdata.energy_daily ?? "--"} kWh`;

    todayWrapper.appendChild(todayIcon);
    todayWrapper.appendChild(todayText);

    // Total energy
    const totalWrapper = document.createElement("div");
    totalWrapper.style.display = "flex";
    totalWrapper.style.alignItems = "center";
    totalWrapper.style.gap = "6px";

    const totalIcon = document.createElement("img");
    totalIcon.src = this.config.iconTotal;
    totalIcon.style.height = "25px";
    totalIcon.style.width = "auto";

    const totalText = document.createElement("span");
    totalText.innerHTML = `${this.pvdata.energy_total ?? "--"} MWh`;

    totalWrapper.appendChild(totalIcon);
    totalWrapper.appendChild(totalText);

    overlay.appendChild(todayWrapper);
    overlay.appendChild(totalWrapper);
    container.appendChild(overlay);
    wrapper.appendChild(container);

    // Delay chart rendering until DOM is ready
    setTimeout(() => {
      const canvasEl = document.getElementById("pvChart");
      if (!canvasEl) return;
      const computedWidth = canvasEl.offsetWidth;
      canvasEl.width = computedWidth;
      canvasEl.height = computedWidth;
      this.drawChart("pvChart");
    }, 10);

    return wrapper;
  },

  // Chart.js rendering logic
  drawChart(canvasId) {
    const power = this.pvdata.power ?? 0;
    const max = this.config.maxPower;

    const fraction = Math.min(power / max, 1);
    const filled = 240 * fraction;
    const empty = 240 - filled;
    const gap = 120; // transparent lower section

    const ctx = document.getElementById(canvasId).getContext("2d");

    new Chart(ctx, {
      type: "doughnut",
      data: {
        datasets: [{
          data: [filled, empty, gap],
          backgroundColor: [
            "rgba(246, 246, 246, 0.8)",  // active segment
            "rgba(200, 200, 200, 0.5)",  // inactive segment
            "rgba(0, 0, 0, 0)"           // transparent
          ],
          borderWidth: 0,
        }]
      },
      options: {
        rotation: 240,
        circumference: 360,
        cutout: "70%",
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        responsive: false,
        maintainAspectRatio: false,
        animation: false
      }
    });
  }
});

