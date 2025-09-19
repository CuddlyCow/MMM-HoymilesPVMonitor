const NodeHelper = require("node_helper");
const { exec } = require("child_process");
const path = require("path");

module.exports = NodeHelper.create({
  // Called when the node helper is started
  start() {
    console.log("[MMM-HoymilesPVMonitor] Node helper started.");
  },

  // Called when a socket notification is received from the frontend
  socketNotificationReceived(notification, payload) {
    if (notification === "GET_PV_DATA") {
      const script = path.join(__dirname, "dtu_data.py");
      const outFile = path.join(__dirname, "public", "history_daily.json");

      // Run the Python script to fetch and append new data
      const cmd = `python3 ${script} --ip ${payload.dtuIp} --max ${payload.maxPower} --out ${outFile}`;
      console.log("[MMM-HoymilesPVMonitor] Running Python script:", cmd);

      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error("[MMM-HoymilesPVMonitor] Python script error:", error);
          return;
        }
        if (stderr) {
          console.warn("[MMM-HoymilesPVMonitor] Python script stderr:", stderr);
        }

        if (stdout) {
          console.log("[MMM-HoymilesPVMonitor] Python script output:", stdout.trim());
        }

        // Notify the frontend to reload the updated data
        this.sendSocketNotification("PV_DATA_READY");
      });
    }
  }
});

