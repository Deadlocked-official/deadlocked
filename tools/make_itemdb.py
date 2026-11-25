"""Write itemdb.js: every shop item with its stats, effect, upgrade paths, a grade, and the heroes who buy it.

Grade: an item's win rate minus the average of popular items in the same tier (share-weighted), minus
0.5 points per minute it's bought later than usual for its tier (late buys show up in already-won games).
  S >= +2.0, A >= +0.75, B >= -0.75, C >= -2.0, D below. Items bought in under 1% of games get no grade.

Usage: python tools/make_itemdb.py <site_dir> [days] [min_badge]
"""
import json, os, sys, time, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_builds import key_stats, effect  # noqa: E402  (same item text as the builds)

API = "https://api.deadlock-api.com"
UA = {"User-Agent": "deadlocked-site-items/1.0"}


def get(path):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(API + path, headers=UA), timeout=180) as r:
                return json.load(r)
        except Exception:
            if i == 2:
                raise
            time.sleep(5)


def grade(d):
    return "S" if d >= 2 else "A" if d >= 0.75 else "B" if d >= -0.75 else "C" if d >= -2 else "D"


def main():
    site = sys.argv[1]
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 21
    badge = int(sys.argv[3]) if len(sys.argv) > 3 else 81
    since = int(time.time()) - days * 86400
    q = f"min_unix_timestamp={since}&min_average_badge={badge}"
    items = {int(i["id"]): i for i in get("/v1/assets/items/by-type/upgrade") if i.get("shopable") and not i.get("disabled")}
    by_class = {i["class_name"]: k for k, i in items.items()}
    hero_stats = get(f"/v1/analytics/hero-stats?{q}")
    hero_games = {int(h["hero_id"]): h["matches"] for h in hero_stats}
    total_games = sum(hero_games.values()) or 1
    overall = {int(s["item_id"]): s for s in get(f"/v1/analytics/item-stats?{q}&min_matches=50")}
    by_hero = get(f"/v1/analytics/item-stats?{q}&min_matches=50&bucket=hero")

    rows = {}
    for iid, s in overall.items():
        if iid not in items or not s["matches"]:
            continue
        rows[iid] = {"share": 100 * s["matches"] / total_games, "wr": 100 * s["wins"] / s["matches"],
                     "t": s.get("avg_buy_time_s") or 0, "sold": 100 * (s.get("sold") or 0) / s["matches"],
                     "tier": int(items[iid].get("item_tier") or 0)}
    tier_avg, tier_time = {}, {}
    for t in {r["tier"] for r in rows.values()}:
        pop = [r for r in rows.values() if r["tier"] == t and r["share"] >= 3]
        n = sum(r["share"] for r in pop)
        tier_avg[t] = sum(r["wr"] * r["share"] for r in pop) / n if n else 50
        tier_time[t] = sum(r["t"] * r["share"] for r in pop) / n if n else 0
    for r in rows.values():
        r["delta"] = r["wr"] - tier_avg[r["tier"]] - 0.5 * max(0, (r["t"] - tier_time[r["tier"]]) / 60)

    heroes_for = {}
    for s in by_hero:
        iid, hid = int(s["item_id"]), int(s["bucket"])
        if iid in items and hero_games.get(hid) and s["matches"] >= 50:
            heroes_for.setdefault(iid, []).append([hid, round(100 * s["matches"] / hero_games[hid], 1), round(100 * s["wins"] / s["matches"], 1)])

    upgrades_into = {}
    for iid, it in items.items():
        for c in it.get("component_items") or []:
            cid = by_class.get(c)
            if cid:
                upgrades_into.setdefault(cid, []).append(iid)

    out = {}
    for iid, it in items.items():
        r = rows.get(iid)
        out[iid] = {
            "stats": key_stats(it), "effect": effect(it), "active": bool(it.get("is_active_item")),
            "from": [by_class[c] for c in it.get("component_items") or [] if c in by_class],
            "into": upgrades_into.get(iid, []),
            "share": round(r["share"], 1) if r else 0, "wr": round(r["wr"], 1) if r else None,
            "delta": round(r["delta"], 1) if r else None, "min": round(r["t"] / 60, 1) if r else None,
            "sold": round(r["sold"]) if r else None,
            "grade": grade(r["delta"]) if r and r["share"] >= 1 else None,
            "heroes": sorted(heroes_for.get(iid, []), key=lambda h: -h[1])[:8],
        }
    open(os.path.join(site, "itemdb.js"), "w", encoding="utf-8").write(
        "// Item database made by tools/make_itemdb.py from api.deadlock-api.com.\n"
        "// heroes = [hero id, % of that hero's games it's bought in, win % when bought]\n"
        "window.ITEMDB = " + json.dumps({"taken": time.strftime("%Y-%m-%d"), "days": days, "min_badge": badge, "items": out},
                                       separators=(",", ":"), ensure_ascii=False) + ";\n")
    graded = [v for v in out.values() if v["grade"]]
    print(len(out), "items,", len(graded), "graded;", {g: sum(1 for v in graded if v["grade"] == g) for g in "SABCD"})


if __name__ == "__main__":
    main()
