# MMM-HoymilesPVMonitor

A [MagicMirror²](https://magicmirror.builders/) module that displays
**live PV power and energy data** from a **Hoymiles DTU** using a
**clean Chart.js donut chart**.

This module queries the DTU via the local network at regular intervals
and visualizes the current power, daily energy, and total energy values
on your MagicMirror.


## Features

-   Fetches real-time PV data from your Hoymiles DTU
-   Displays:
    -   **Current power (W)**
    -   **Daily energy (kWh)**
    -   **Total energy (MWh)**
-   Visual donut chart created with **Chart.js**
-   Automatically updates at configurable intervals
-   Keeps showing the last known energy values at night when the DTU
    stops responding
-   Stores all daily values with timestamps in a local history file
    (`history_daily.json`) for potential future charts


## Dependencies

This module relies on the following dependencies:

- **Python 3** — Make sure Python 3 is installed and available as `python3` on your system.
- **[hoymiles-wifi](https://pypi.org/project/hoymiles-wifi/)** — Python library to communicate with Hoymiles DTU.  
  Install it via:

  ```bash
  pip3 install hoymiles-wifi

- **Chart.js** — A JavaScript library used to render the donut chart. No manual installation is required. The module automatically loads Chart.js from a public CDN (Content Delivery Network) when the MagicMirror starts.

## Installation

1.  Navigate to your `MagicMirror/modules` directory:

    ``` bash
    cd ~/MagicMirror/modules
    ```

2.  Clone this repository:

    ``` bash
    git clone https://github.com/CuddlyCow/MMM-HoymilesPVMonitor.git
    ```


## Configuration

Add the module to the `modules` array in your `config.js`:

| Option           | Default           | Description                                     |
| ---------------- | ----------------- | ------------------------------------------------|
| `dtuIp`          | *none (required)* | Local IP address of the DTU unit                |
| `maxPower`       | *none (required)* | Maximum PV power capacity                       |
| `updateInterval` | 5 * 60 * 1000     | How often to fetch and update data/history in ms|

Example:
``` javascript
{
  module: "MMM-HoymilesPVMonitor",
  position: "top_left",
  config: {
    dtuIp: "192.168.178.56",        // IP address of your Hoymiles DTU
    maxPower: 870,                  // Maximum system power in watts
    updateInterval: 5 * 60 * 1000   // Update interval in milliseconds (default: 5 minutes)
  }
}
```


## File Structure

    MMM-HoymilesPVMonitor/
    │
    ├── MMM-HoymilesPVMonitor.js      # Main frontend module
    ├── node_helper.js                # Backend helper to run Python script
    ├── dtu_data.py                   # Python script fetching data from the DTU
    │
    ├── public/
    │   ├── history_daily.json        # Stores last 24h of data with timestamps
    │   ├── today.svg                  # Icon for daily energy
    │   └── total.svg                  # Icon for total energy
    │
    └── README.md


## Notes

-   The module keeps writing new entries to `public/history_daily.json`
    every update cycle.
-   Older entries (\> 24 hours) are automatically removed.
-   At midnight, the `energy_daily` counter resets to `0.0`.
-   The `energy_total` value is never reset and will continue growing
    over time.


## License

This project is licensed under the [MIT License](LICENSE).


## Credits

-   Developed by **Jochen Temmen**
-   Uses the
    [hoymiles_wifi](https://pypi.org/project/hoymiles-wifi/) Python
    library
-   Built for the [MagicMirror²](https://magicmirror.builders/) platform
