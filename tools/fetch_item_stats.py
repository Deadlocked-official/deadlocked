"""Download everything the build maker needs from api.deadlock-api.com into one folder.

  _meta.json          heroes, hero stats, settings
  _items.json         every shop item (stats, effects, upgrade paths)
  _abilities.json     every ability (to see which ones scale with spirit power)
  _counters.json      hero-vs-hero results
  <hero>.json         item stats for that hero
  <hero>_maxfirst.json  which ability that hero's players max first
  <hero>_vs_<enemy>.json item stats for that hero against one of its hardest matchups

Usage: python tools/fetch_item_stats.py <out_dir> [days] [min_badge]
"""
import json, math, os, sys, time, urllib.request

API = "https://api.deadlock-api.com"
UA = {"User-Agent": "deadlocked-site-builds/2.0"}
PAUSE = 0.35  # stay well under the API's shared rate limit


def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
                data = json.load(r)
            time.sleep(PAUSE)
            return data
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(5)


def save(out, name, data):
    json.dump(data, open(os.path.join(out, name), "w"))


def logit(p):
    p = min(0.99, max(0.01, p))
    return math.log(p / (1 - p))


def main():
    out = sys.argv[1]
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 21
    badge = int(sys.argv[3]) if len(sys.argv) > 3 else 81
    os.makedirs(out, exist_ok=True)
    since = int(time.time()) - days * 86400
    q = f"min_unix_timestamp={since}&min_average_badge={badge}"

    heroes = [h for h in get(API + "/v1/assets/heroes") if h.get("player_selectable") and not h.get("disabled")]
    save(out, "_items.json", get(API + "/v1/assets/items/by-type/upgrade"))
    save(out, "_abilities.json", get(API + "/v1/assets/items/by-type/ability"))
    hero_stats = get(f"{API}/v1/analytics/hero-stats?{q}")
    counters = get(f"{API}/v1/analytics/hero-counter-stats?{q}&same_lane_filter=false&min_matches=100")
    save(out, "_counters.json", counters)
    save(out, "_meta.json", {"heroes": [{"id": h["id"], "name": h["name"], "items": h.get("items")} for h in heroes],
                             "hero_stats": hero_stats, "days": days, "min_badge": badge, "taken": time.strftime("%Y-%m-%d")})

    # Each hero's two hardest matchups, judged against both heroes' normal win rates.
    tot = {}
    for c in counters:
        t = tot.setdefault(c["hero_id"], [0, 0])
        t[0] += c["wins"]; t[1] += c["matches_played"]
    hardest = {}
    for c in counters:
        a, b = c["hero_id"], c["enemy_hero_id"]
        if c["matches_played"] < 300 or a not in tot or b not in tot:
            continue
        exp = 1 / (1 + math.exp(-(logit(tot[a][0] / tot[a][1]) - logit(tot[b][0] / tot[b][1]))))
        hardest.setdefault(a, []).append((c["wins"] / c["matches_played"] - exp, b))

    for h in heroes:
        hid = h["id"]
        save(out, f"{hid}.json", get(f"{API}/v1/analytics/item-stats?hero_id={hid}&{q}&min_matches=50"))
        save(out, f"{hid}_maxfirst.json", get(f"{API}/v1/analytics/ability-max-first-stats?hero_id={hid}&{q}"))
        for _, enemy in sorted(hardest.get(hid, []))[:2]:
            save(out, f"{hid}_vs_{enemy}.json",
                 get(f"{API}/v1/analytics/item-stats?hero_id={hid}&enemy_hero_ids={enemy}&{q}&min_matches=30"))
        print(h["name"], flush=True)


if __name__ == "__main__":
    main()
