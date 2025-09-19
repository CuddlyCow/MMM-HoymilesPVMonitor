#!/usr/bin/env python3

"""
dtu_data.py — Part of the MagicMirror² module "MMM-HoymilesPVMonitor"

This script is called periodically by the module's Node Helper (node_helper.js).
It queries a Hoymiles DTU (Data Transfer Unit) over the local network and appends
the received data (power, daily energy, total energy) to a JSON history file.

Features:
- Queries the DTU every few minutes (interval set in config.js).
- Appends each new measurement to history_daily.json together with a timestamp.
- Removes all entries older than 24 hours to keep the file size small.
- Resets daily energy (energy_daily) to 0.0 once per day after midnight.
- During nighttime (DTU off → reports 0 or lower values):
  - Keeps the last known non-zero daily and total energy values instead of 0.
  - Writes power = 0 to indicate no current production.

The JSON history file can be used by the frontend to:
- Display the most recent data point.
- Visualize daily performance graphs in the future.

Author: Jochen Temmen
"""

import json
import asyncio
import argparse
from datetime import datetime, timedelta
from hoymiles_wifi.dtu import DTU
from os.path import exists

# --- CLI ARGUMENTS ---
# This script is called by the MagicMirror node_helper.
# It queries the Hoymiles DTU and appends the result to a local JSON history file.
parser = argparse.ArgumentParser(description="Fetch PV data from Hoymiles DTU and append to history.")
parser.add_argument("--ip", required=True, help="IP address of the Hoymiles DTU")
parser.add_argument("--max", required=True, type=int, help="Max system power in watts")
parser.add_argument("--out", default="public/history_daily.json", help="Output history file path")
args = parser.parse_args()


# --- QUERY THE DTU (ASYNC) ---
async def get_dtu_data(ip):
    """
    Connects to the Hoymiles DTU and retrieves the latest real-time data.
    Returns a dict with timestamp, power, energy_daily and energy_total
    or None if the request failed or data was invalid.
    """
    try:
        dtu = DTU(ip)
        response = await dtu.async_get_real_data_new()

        # DTU responded but without valid data
        if not response or not hasattr(response, "pv_data") or not response.pv_data:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] [INFO] DTU responded but returned no valid pv_data.")
            return None

        pv_data = response.pv_data
        power = sum(pv.power for pv in pv_data) / 10.0
        energy_total = sum(pv.energy_total for pv in pv_data) / 1_000_000  # Wh → MWh
        energy_daily = sum(pv.energy_daily for pv in pv_data) / 1_000      # Wh → kWh

        return {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "power": round(power),
            "energy_daily": round(energy_daily, 2),
            "energy_total": round(energy_total, 2)
        }

    except Exception as e:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] [INFO] Error while communicating with DTU: {e}")
        return None


# --- LOAD EXISTING HISTORY FILE ---
def load_history(path):
    """
    Loads the JSON history file if it exists.
    Returns a list of data entries, or an empty list if file is missing or unreadable.
    """
    if not exists(path):
        return []
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"[WARNING] Could not load history: {e}")
        return []


# --- REMOVE ENTRIES OLDER THAN 24 HOURS ---
def prune_old_entries(history):
    """
    Removes all entries older than 24 hours from the history list.
    Keeps only recent entries to prevent uncontrolled file growth.
    """
    now = datetime.now()
    cutoff = now - timedelta(hours=24)
    pruned = []
    for entry in history:
        try:
            entry_time = datetime.strptime(entry["timestamp"], "%Y-%m-%d %H:%M")
            if entry_time > cutoff:
                pruned.append(entry)
        except Exception:
            # Ignore malformed entries
            pass
    return pruned


# --- MAIN LOGIC ---
def main():
    history = load_history(args.out)
    history = prune_old_entries(history)

    now = datetime.now()
    result = asyncio.run(get_dtu_data(args.ip))

    last_entry = history[-1] if history else None
    last_date = None
    if last_entry:
        try:
            last_date = datetime.strptime(last_entry["timestamp"], "%Y-%m-%d %H:%M").date()
        except Exception:
            last_date = None

    # Detect day change: first entry after midnight should reset daily counter
    new_day = (last_date is not None) and (now.date() != last_date)

    if result:
        # --- Valid DTU response ---
        if new_day:
            # Reset daily energy at start of new day
            result["energy_daily"] = 0.0
            # Keep the last known total energy (DTU may return 0 at night)
            if last_entry:
                result["energy_total"] = last_entry.get("energy_total", result["energy_total"])
        else:
            # --- Night fallback logic ---
            # If power = 0 and DTU reports 0 daily or a lower total than last time,
            # assume DTU is off and reuse last known non-zero values.
            if result.get("power", 0) == 0 and last_entry:
                if result.get("energy_daily", 0) == 0:
                    result["energy_daily"] = last_entry.get("energy_daily", 0)
                if result.get("energy_total", 0) < last_entry.get("energy_total", 0):
                    result["energy_total"] = last_entry.get("energy_total", result.get("energy_total"))

        history.append(result)
        print(f"[{result['timestamp']}] [INFO] Live DTU data appended: {result}")

    else:
        # --- No valid DTU response ---
        timestamp = now.strftime("%Y-%m-%d %H:%M")
        if last_entry:
            # Reuse last known values (reset daily only if it's a new day)
            fallback_daily = 0.0 if new_day else last_entry.get("energy_daily", 0)
            fallback_total = last_entry.get("energy_total", 0)
            fallback = {
                "timestamp": timestamp,
                "power": 0,
                "energy_daily": fallback_daily,
                "energy_total": fallback_total
            }
            history.append(fallback)
            print(f"[{timestamp}] [INFO] No DTU data -> appended fallback: {fallback}")
        else:
            # No history at all: start with zeros
            fallback = {
                "timestamp": timestamp,
                "power": 0,
                "energy_daily": 0,
                "energy_total": 0
            }
            history.append(fallback)
            print(f"[{timestamp}] [INFO] No DTU data and no history -> appended zeros.")

    # --- Save updated history back to file ---
    try:
        with open(args.out, "w") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[ERROR] Failed to write history file: {e}")


if __name__ == "__main__":
    main()

