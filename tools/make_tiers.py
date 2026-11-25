"""Recalculate the skill tier list and write tiers.js.

Score (0-10) per hero:
  base = 60% Valve's in-game complexity (1-4 -> 2, 5, 8, 10)
       + 40% the deadlock-boosting difficulty guide (Very easy 1 ... Very hard 10)
       + 1 point for heroes widely called high-skill-ceiling
  then real matches nudge it by up to +-2 points:
       gap = win rate after 51-150 games on the hero minus win rate in the first 10 games
       mod = 0.4 * (gap - average gap), capped at +-2
Heroes the guide doesn't cover yet (new releases) use Valve's rating for both parts.

Usage: python tools/make_tiers.py <site_dir>
"""
import json, os, sys, time, urllib.request

API = "https://api.deadlock-api.com"
UA = {"User-Agent": "deadlocked-site-tiers/1.0"}

VALVE = {1: 2, 2: 5, 3: 8, 4: 10}
GUIDE_POINTS = {"Very easy": 1, "Easy": 3, "Medium": 5, "Hard": 7.5, "Very hard": 10}
# deadlock-boosting.com/blog/deadlock-characters, read Nov 2026
GUIDE = {
    "Very easy": ["Paige", "Graves", "Seven", "Haze", "Lady Geist", "Infernus", "Grey Talon", "McGinnis", "Warden"],
    "Easy": ["Victor", "Wraith", "Abrams", "Vindicta", "Bebop", "Mirage", "Nurse Harrow", "Baba", "Solomon", "Violet"],
    "Medium": ["Kelvin", "Dynamo", "Drifter", "Venator", "Calico", "Paradox", "The Doorman", "Viscous", "Deadman Danny"],
    "Hard": ["Ivy", "Lash", "Mo & Krill", "Celeste", "Apollo", "Vyper", "Silver", "Pocket", "Rat King"],
    "Very hard": ["Holliday", "Yamato", "Rem", "Mina", "Billy", "Sinclair", "Shiv"],
}
HIGH_CEILING = {"Yamato", "Shiv", "Mina", "Ivy", "Lash", "Mo & Krill", "Celeste", "Paradox", "Mirage", "The Doorman", "Viscous"}
TIERS = [("S", "Mastery", 9.5), ("A", "Very hard", 8), ("B", "Hard", 6.5), ("C", "Medium", 5), ("D", "Easy", 3), ("F", "Very easy", -1)]


def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
                return json.load(r)
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(5)


def learning_curve():
    # The bucketed query is heavy, so start with a short window and shrink it if the API times out.
    for days in (5, 4, 3, 2):
        since = int(time.time()) - days * 86400
        try:
            rows = get(f"{API}/v1/analytics/hero-stats?min_unix_timestamp={since}&hero_matches_total_buckets=1,11,51,151", tries=2)
            if isinstance(rows, list) and rows:
                return rows, days
        except Exception as e:
            print(f"learning-curve query for {days} days failed: {e}")
    raise SystemExit("Could not get learning-curve data")


def main():
    site = sys.argv[1]
    guide = {h: GUIDE_POINTS[g] for g, hs in GUIDE.items() for h in hs}
    heroes = [h for h in get(API + "/v1/assets/heroes") if h.get("player_selectable") and not h.get("disabled")]
    rows, days = learning_curve()
    wr = {}
    for r in rows:
        if r["matches"]:
            wr.setdefault(r["hero_id"], {})[r["bucket"]] = r["wins"] / r["matches"]
    gaps = {h["id"]: 100 * (wr[h["id"]][51] - wr[h["id"]][1]) for h in heroes if 1 in wr.get(h["id"], {}) and 51 in wr.get(h["id"], {})}
    mean = sum(gaps.values()) / len(gaps)
    scored = []
    for h in heroes:
        name, valve = h["name"], VALVE.get(int(h.get("complexity") or 2), 5)
        base = 0.6 * valve + 0.4 * guide.get(name, valve) + (1 if name in HIGH_CEILING else 0)
        gap = gaps.get(h["id"])
        mod = max(-2, min(2, 0.4 * (gap - mean))) if gap is not None else 0
        scored.append((name, round(max(0, min(10, base + mod)), 1), round(gap, 1) if gap is not None else None))
    scored.sort(key=lambda x: -x[1])
    tiers = []
    for letter, label, floor in TIERS:
        taken = [s for s in scored if s[1] >= floor and not any(s in t[2] for t in tiers)]
        tiers.append([letter, label, taken])
    tiers = [[t[0], t[1], [[n, s, g if g is not None else 0] for n, s, g in t[2]]] for t in tiers]
    data = {"taken": time.strftime("%Y-%m-%d"), "curve_days": days, "tiers": tiers}
    open(os.path.join(site, "tiers.js"), "w", encoding="utf-8").write(
        "// Skill tiers made by tools/make_tiers.py. hero = [name, score /10, win-rate gain from first 10 to 51-150 games]\n"
        "window.TIERS = " + json.dumps(data, separators=(",", ":"), ensure_ascii=False) + ";\n")
    print("tiers:", {t[0]: len(t[2]) for t in tiers}, "curve days:", days)


if __name__ == "__main__":
    main()
