"""Download per-hero item stats from api.deadlock-api.com into a folder (one JSON file per hero).

Usage: python tools/fetch_item_stats.py <out_dir> [days] [min_badge]
"""
import json, os, sys, time, urllib.request

API = "https://api.deadlock-api.com"
UA = {"User-Agent": "deadlocked-site-builds/1.0"}


def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                return json.load(r)
        except Exception as e:  # retry slow or failed responses
            if i == tries - 1:
                raise
            time.sleep(3)


def main():
    out = sys.argv[1]
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 21
    badge = int(sys.argv[3]) if len(sys.argv) > 3 else 81
    os.makedirs(out, exist_ok=True)
    since = int(time.time()) - days * 86400
    heroes = [h for h in get(API + "/v1/assets/heroes") if h.get("player_selectable") and not h.get("disabled")]
    hero_stats = get(f"{API}/v1/analytics/hero-stats?min_unix_timestamp={since}&min_average_badge={badge}")
    json.dump({"heroes": [{"id": h["id"], "name": h["name"]} for h in heroes], "hero_stats": hero_stats,
               "days": days, "min_badge": badge, "taken": time.strftime("%Y-%m-%d")},
              open(os.path.join(out, "_meta.json"), "w"))
    for h in heroes:
        url = f"{API}/v1/analytics/item-stats?hero_id={h['id']}&min_unix_timestamp={since}&min_average_badge={badge}&min_matches=50"
        json.dump(get(url), open(os.path.join(out, f"{h['id']}.json"), "w"))
        print(h["name"], flush=True)


if __name__ == "__main__":
    main()
