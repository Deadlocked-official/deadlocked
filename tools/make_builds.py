"""Turn per-hero item stats (from fetch_item_stats.py) into a build for every hero.

How a build is made, per hero:
  * share  = % of this hero's games where the item was bought
  * delta  = item win rate minus the average win rate of popular items in the same tier
             (comparing inside a tier removes most of the "late items look strong" bias)
  * score  = share + 3 * delta   -> what lots of good players buy, nudged toward what wins
  Lane = best 4 tier-1 items, Core = 4 tier-2, Mid game = 3 tier-3, Late = 3 tier-4+,
  each phase ordered by when players buy the item. Situational = up to 4 more items
  that win clearly above their tier but are bought less often.

Usage: python tools/make_builds.py <stats_dir> <items_js_out_dir>
Writes builds.js next to the site.
"""
import json, os, sys

PHASES = [("Lane", [1], 4), ("Core", [2], 4), ("Mid game", [3], 3), ("Late game", [4, 5], 3)]


def main():
    src, out_dir = sys.argv[1], sys.argv[2]
    meta = json.load(open(os.path.join(src, "_meta.json")))
    items_js = open(os.path.join(out_dir, "items.js"), encoding="utf-8").read()
    items = {int(k): v for k, v in json.loads(items_js.split("=", 1)[1].strip().rstrip(";")).items()}
    games = {int(s["hero_id"]): s["matches"] for s in meta["hero_stats"]}
    builds = {}
    for h in meta["heroes"]:
        hid = int(h["id"])
        path = os.path.join(src, f"{hid}.json")
        if not os.path.exists(path) or not games.get(hid):
            continue
        rows = []
        for s in json.load(open(path)):
            it = items.get(int(s["item_id"]))
            if not it or not s["matches"]:
                continue
            rows.append({"id": int(s["item_id"]), "tier": it[2], "slot": it[1],
                         "share": 100 * s["matches"] / games[hid], "wr": 100 * s["wins"] / s["matches"],
                         "t": s.get("avg_buy_time_s") or 0, "sold": 100 * (s.get("sold") or 0) / s["matches"]})
        tier_avg, tier_time = {}, {}
        for t in {r["tier"] for r in rows}:
            pop = [r for r in rows if r["tier"] == t and r["share"] >= 3]
            n = sum(r["share"] for r in pop)
            tier_avg[t] = sum(r["wr"] * r["share"] for r in pop) / n if n else 50
            tier_time[t] = sum(r["t"] * r["share"] for r in pop) / n if n else 0
        for r in rows:
            # Items bought later than usual for their tier mostly appear in long, already-won games:
            # take off 0.5 win-rate points per minute later than the tier's typical buy time.
            late_min = (r["t"] - tier_time[r["tier"]]) / 60
            r["delta"] = r["wr"] - tier_avg[r["tier"]] - 0.5 * max(0, late_min)
            r["score"] = r["share"] + 3 * r["delta"]
        used, phases = set(), []
        for name, tiers, n in PHASES:
            pool = [r for r in rows if r["tier"] in tiers and r["share"] >= 4 and r["id"] not in used
                    and (name != "Lane" or r["t"] <= 12 * 60)]
            pick = sorted(pool, key=lambda r: -r["score"])[:n]
            pick.sort(key=lambda r: r["t"])
            used.update(r["id"] for r in pick)
            phases.append({"name": name, "items": [pack(r) for r in pick]})
        extra = [r for r in rows if r["tier"] >= 2 and r["id"] not in used and r["share"] >= 5 and r["delta"] >= 1.5]
        extra.sort(key=lambda r: -r["delta"])
        slots = {}
        for p in phases[1:]:
            for i in p["items"]:
                slots[items[i[0]][1]] = slots.get(items[i[0]][1], 0) + 1
        gun, spirit = slots.get("weapon", 0), slots.get("spirit", 0)
        style = "Gun" if gun >= spirit + 3 else "Spirit" if spirit >= gun + 3 else "Hybrid"
        builds[hid] = {"style": style, "games": games[hid], "phases": phases, "situational": [pack(r) for r in extra[:4]]}
    data = {"taken": meta["taken"], "days": meta["days"], "min_badge": meta["min_badge"], "builds": builds}
    open(os.path.join(out_dir, "builds.js"), "w", encoding="utf-8").write(
        "// Builds made by tools/make_builds.py from api.deadlock-api.com item stats.\n"
        "// item = [item id, % of games bought, win %, avg buy minute, % sold later]\n"
        "window.BUILDS = " + json.dumps(data, separators=(",", ":")) + ";\n")
    print(len(builds), "builds")


def pack(r):
    return [r["id"], round(r["share"], 1), round(r["wr"], 1), round(r["t"] / 60, 1), round(r["sold"])]


if __name__ == "__main__":
    main()
