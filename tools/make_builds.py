"""Turn the data from fetch_item_stats.py into a reasoned build for every hero (writes builds.js).

Item choice, per hero:
  share  = % of this hero's high-rank games where the item was bought
  delta  = item win rate minus the share-weighted win rate of popular items in the same tier,
           minus 0.5 points per minute the item is bought later than usual for its tier
           (late buys mostly happen in long games that are already won)
  score  = share + 3 * delta
  Lane = 4 tier-1 items bought in the first 12 minutes, Core = 4 tier-2, Mid game = 3 tier-3,
  Late game = 3 tier-4+; each phase in buying order. Situational = items that win clearly above
  their tier but are bought less often.

Game reasoning added on top:
  * each item gets its key stats, its effect, and a short reason tied to the hero's kit
    (which abilities scale with spirit power, gun vs spirit style, lane vs late game)
  * upgrade paths: an item that is a component of a later pick "builds into" it
  * end-of-game inventory: everything except components that were upgraded and items usually sold
  * skill order: which ability high-rank players max first, and how that does
  * counter items: for the hero's two hardest matchups, items that win clearly more in that matchup

Usage: python tools/make_builds.py <data_dir> <site_dir>
"""
import glob, html, json, os, re, sys

PHASES = [("Lane", [1], 4), ("Core", [2], 5), ("Mid game", [3], 5), ("Late game", [4, 5], 5)]
MAX_HELD = 16  # a full late-game inventory
NOT_DAMAGE = {"AbilityCooldown", "AbilityDuration", "AbilityCastRange", "AbilityChannelTime", "AbilityCastDelay",
              "AbilityCharges", "AbilityCooldownBetweenCharge", "Radius", "AbilityUnitTargetLimit"}


def load(path):
    return json.load(open(path, encoding="utf-8"))


def clean(text):
    text = re.sub(r"<svg.*?</svg>", "", text or "", flags=re.S)
    text = re.sub(r"<br\s*/?>", " ", text)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def first_sentence(text, limit=150):
    text = clean(text)
    if not text:
        return ""
    m = re.match(r"(.+?[.!?])(\s|$)", text)
    s = m.group(1) if m else text
    return s if len(s) <= limit else s[:limit - 1].rsplit(" ", 1)[0] + "…"


def fmt_prop(p):
    v = str(p.get("value", "")).strip()
    try:
        num = float(re.sub(r"[^\d.\-]", "", v) or "x")
    except ValueError:
        return None
    if num == 0:
        return None
    post = p.get("postfix") or ""
    sign = "+" if "{s:sign}" in (p.get("prefix") or "") and not v.startswith("-") else ""
    if post and v.endswith(post):
        post = ""
    label = p.get("label") or p.get("postvalue_label") or ""
    return f"{sign}{v}{post} {label}".strip() if label else None


def tooltip_props(it):
    """Property names shown on the item's tooltip, with whether they sit in the always-on (innate) part."""
    # Highlighted stats first (the big numbers on the in-game tooltip), then important ones, then the rest.
    names = []
    for key in ("elevated_properties", "important_properties", "properties"):
        for sec in it.get("tooltip_sections") or []:
            innate = sec.get("section_type") == "innate"
            for attr in sec.get("section_attributes") or []:
                for n in attr.get(key) or []:
                    if n not in [x for x, _ in names]:
                        names.append((n, innate))
    return names


def key_stats(it):
    props = it.get("properties") or {}
    out = []
    for n, innate in tooltip_props(it):
        p = props.get(n)
        if not isinstance(p, dict) or (p.get("label") or "") in ("Duration", "Charge Delay"):
            continue
        s = fmt_prop(p)
        if not s:
            continue
        # A negative resist in an effect section is something you do to the enemy.
        if not innate and s.startswith("-") and "Resist" in s:
            s = s.replace(" ", " enemy ", 1)
        if s not in out:
            out.append(s)
        if len(out) == 3:
            break
    return out


def effect(it):
    d = it.get("description")
    d = d.get("desc") if isinstance(d, dict) else d
    if d:
        return first_sentence(d)
    for sec in it.get("tooltip_sections") or []:
        for attr in sec.get("section_attributes") or []:
            if attr.get("loc_string"):
                return first_sentence(attr["loc_string"])
    return ""


CATEGORY_WORDS = [  # checked in this order against each stat label
    ("melee", ("melee",)),
    ("spirit", ("spirit power", "spirit amp")),
    ("gun", ("weapon damage", "fire rate", "ammo", "bullet damage", "headshot", "bullet velocity")),
    ("damage", ("damage per second", "pulse damage", "shock damage", "spirit damage", "bonus damage",
                "explosion damage", "impact damage", "current health bonus damage")),
    ("duration", ("ability duration",)),
    ("range", ("ability range", "cast range")),
    ("cooldown", ("cooldown reduction", "charge cooldown")),
    ("sustain", ("lifesteal", "regen", "healing from", "heal on")),
    ("defense", ("bonus health", "bullet resist", "spirit resist", "max health", "barrier", "base health")),
    ("mobility", ("move speed", "sprint speed", "stamina", "dash")),
]


def tags(it):
    """The item's main purpose (first entry) plus side effects, read from its tooltip stats."""
    props = it.get("properties") or {}
    shown = tooltip_props(it) or [(n, True) for n in props]
    labels, special = [], []
    for n, innate in shown:
        p = props.get(n)
        if not isinstance(p, dict) or not fmt_prop(p):
            continue
        lab = (p.get("label") or "").lower()
        labels.append(lab)
        if "death immunity" in lab:
            special.append("cheatdeath")
        elif "vs. npcs" in lab or "vs npcs" in lab:
            special.append("farm")
        elif "incoming healing" in lab:
            special.append("antiheal")
        elif "debuff resist" in lab:
            special.append("anticc")
        elif str(p.get("value", "")).startswith("-") and "resist" in lab and (not innate or " on " in lab):
            special.append("shred")
    if "anti_cc" in (it.get("shop_filters") or []):
        special.insert(0, "anticc")
    out = list(dict.fromkeys(special))
    if "cooldown" in it.get("class_name", "") and "cooldown" not in out:
        labels.insert(0, "cooldown reduction")
    for lab in labels:
        for cat, words in CATEGORY_WORDS:
            if any(w in lab for w in words) and cat not in out and not (cat == "gun" and "farm" in out):
                out.append(cat)
                break
    return out


def ability_info(hero, abilities_by_class):
    out = []
    for slot in ("signature1", "signature2", "signature3", "signature4"):
        a = abilities_by_class.get((hero.get("items") or {}).get(slot))
        if not a:
            continue
        scales = False
        for n, p in (a.get("properties") or {}).items():
            f = p.get("scale_function") if isinstance(p, dict) else None
            if n in NOT_DAMAGE or not isinstance(f, dict):
                continue
            if f.get("specific_stat_scale_type") == "ETechPower" and (f.get("stat_scale") or 0) > 0:
                scales = True
        out.append({"id": a["id"], "name": a["name"], "img": a.get("image_webp") or a.get("image"), "spirit": scales})
    return out


def reason(name, t, phase, style, n_spirit, is_active):
    """One short sentence on why this item fits this hero at this point of the game, from its main purpose."""
    main = t[0] if t else None
    early = phase in ("Lane", "Core")
    if main == "cheatdeath":
        return "Stops you from dying for a few seconds, so focus fire can't finish you."
    if main == "damage":
        return "Adds its own damage on hit, on top of your gun and abilities."
    if main == "antiheal":
        return "Cuts enemy healing. Keep it against healers and lifesteal."
    if main == "anticc":
        return "Protects you from stuns, roots and silences, so you can't be locked down in fights."
    if main == "shred":
        return "Lowers the enemy's resist when you hit them, so all your damage lands harder."
    if main == "farm":
        return "Clears troopers and camps faster, so you out-farm your lane opponent."
    if main == "melee":
        return f"{name} wants to fight up close, and this makes melee hits count."
    if main == "spirit":
        if n_spirit >= 2:
            return f"{n_spirit} of {name}'s 4 abilities hit harder with spirit power."
        return "Raises spirit power, which also boosts the spirit damage on your items."
    if main == "gun":
        if style == "Gun":
            return f"{name}'s damage comes mostly from the gun, so gun stats pay off most."
        return "Adds gun damage between ability cooldowns."
    if main == "duration":
        return "Your abilities last longer, so stuns, buffs and damage over time do more."
    if main == "range":
        return "Lets you cast abilities from further away and stay out of danger."
    if main == "cooldown":
        return "Lets you use your abilities more often."
    if main == "sustain":
        return "Heals you back up in lane so you can stay and farm." if phase == "Lane" else "Keeps you alive through long fights."
    if main == "defense":
        return "Extra health and resist to survive the early fights." if early else "Makes you harder to burst once enemies have their big items."
    if main == "mobility":
        return "Helps you chase, escape and rotate between lanes."
    if is_active:
        return "An active effect you press at the right moment in fights."
    return "A popular pick at this point of the game."


ACTIVE_WORDS = [  # (words in the active's effect text, reason)
    (("barrier", "shield"), "Active: a shield you pop to survive burst, or to save a teammate."),
    (("heal",), "Active: a burst of healing to turn a fight around."),
    (("teleport", "blink", "warp"), "Active: an instant reposition to escape or jump onto a target."),
    (("stun", "silence", "sleep", "root", "disarm", "knock"), "Active: locks an enemy down so your team can kill them."),
    (("slow",), "Active: slows enemies so they can't chase you or get away."),
    (("immune", "invulnerab", "untargetable", "invisible", "evasion"), "Active: makes you hard to hit for a moment, so you survive focus."),
    (("speed", "dash", "jump"), "Active: a burst of speed to chase, escape or rotate."),
    (("damage",), "Active: extra burst damage when you go in."),
]


def active_reason(it):
    text = effect(it).lower()
    for words, why in ACTIVE_WORDS:
        if any(w in text for w in words):
            return why
    return None


def point_order(orders, kit_ids, priority):
    """Most common ability point path: at each step, the next pick most high-rank players make after the
    same earlier picks. Returns [[ability id, level (0 = unlock, 1-3 = upgrade), minute or None, % following]].
    If the data runs out before all 16 points, the rest follow the max-first priority."""
    orders = [o for o in orders if o.get("matches") and o.get("abilities")]
    total0 = sum(o["matches"] for o in orders) or 1
    prefix, steps, count = [], [], {a: 0 for a in kit_ids}
    for step in range(4 * len(kit_ids)):
        tally, times, n = {}, {}, 0
        for o in orders:
            ab = o["abilities"]
            if len(ab) > step and ab[:step] == prefix and ab[step] in count and count[ab[step]] < 4:
                tally[ab[step]] = tally.get(ab[step], 0) + o["matches"]
                t = (o.get("avg_upgrade_times_s") or [None] * len(ab))
                if step < len(t) and t[step] is not None:
                    w, s = times.get(ab[step], (0, 0))
                    times[ab[step]] = (w + o["matches"], s + o["matches"] * t[step])
                n += o["matches"]
        if not tally or n < 200:
            break
        pick = max(tally, key=tally.get)
        w, s = times.get(pick, (0, 0))
        steps.append([pick, count[pick], round(s / w / 60, 1) if w else None, round(100 * tally[pick] / total0, 1)])
        count[pick] += 1
        prefix.append(pick)
    for a in priority + [k for k in kit_ids if k not in priority]:
        while count.get(a, 4) < 4:
            steps.append([a, count[a], None, None])
            count[a] += 1
    return steps


def pick_slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower().replace("&", "and")).strip("-")


def main():
    src, site = sys.argv[1], sys.argv[2]
    meta = load(os.path.join(src, "_meta.json"))
    items = {int(i["id"]): i for i in load(os.path.join(src, "_items.json")) if i.get("shopable") and not i.get("disabled")}
    by_class = {i["class_name"]: k for k, i in items.items()}
    abilities = {a["class_name"]: a for a in load(os.path.join(src, "_abilities.json"))}
    names = {int(h["id"]): h["name"] for h in meta["heroes"]}
    games = {int(s["hero_id"]): s["matches"] for s in meta["hero_stats"]}
    builds = {}
    for h in meta["heroes"]:
        hid, name = int(h["id"]), h["name"]
        path = os.path.join(src, f"{hid}.json")
        if not os.path.exists(path) or not games.get(hid):
            continue
        rows, general = [], {}
        for s in load(path):
            it = items.get(int(s["item_id"]))
            if not it or not s["matches"]:
                continue
            r = {"id": int(s["item_id"]), "tier": int(it.get("item_tier") or 0), "slot": it.get("item_slot_type"),
                 "share": 100 * s["matches"] / games[hid], "wr": 100 * s["wins"] / s["matches"],
                 "t": s.get("avg_buy_time_s") or 0, "sold": 100 * (s.get("sold") or 0) / s["matches"],
                 "st": s.get("avg_sell_time_s") or 0}
            rows.append(r)
            general[r["id"]] = r
        tier_avg, tier_time = {}, {}
        for t in {r["tier"] for r in rows}:
            pop = [r for r in rows if r["tier"] == t and r["share"] >= 3]
            n = sum(r["share"] for r in pop)
            tier_avg[t] = sum(r["wr"] * r["share"] for r in pop) / n if n else 50
            tier_time[t] = sum(r["t"] * r["share"] for r in pop) / n if n else 0
        for r in rows:
            late_min = (r["t"] - tier_time[r["tier"]]) / 60
            r["delta"] = r["wr"] - tier_avg[r["tier"]] - 0.5 * max(0, late_min)
            r["score"] = r["share"] + 3 * r["delta"]

        used, phases = set(), []
        for pname, tiers, n in PHASES:
            pick = []
            for min_share in (4, 2):  # widen the pool only if a phase can't be filled
                pool = [r for r in rows if r["tier"] in tiers and r["share"] >= min_share and r["id"] not in used
                        and (pname != "Lane" or r["t"] <= 12 * 60)]
                pick = sorted(pool, key=lambda r: -r["score"])[:n]
                if len(pick) == n:
                    break
            pick.sort(key=lambda r: r["t"])
            for r in pick:
                r["phase"] = pname
            used.update(r["id"] for r in pick)
            phases.append((pname, pick))
        extra = [r for r in rows if r["tier"] >= 2 and r["id"] not in used and r["share"] >= 5 and r["delta"] >= 1.5]
        extra.sort(key=lambda r: -r["delta"])
        for r in extra:
            r["phase"] = "Situational"
        extra = extra[:4]

        # Kit and style.
        kit = ability_info(h, abilities)
        n_spirit = sum(1 for a in kit if a["spirit"])
        slots = {}
        for _, pick in phases[1:]:
            for r in pick:
                slots[r["slot"]] = slots.get(r["slot"], 0) + 1
        gun, spirit = slots.get("weapon", 0), slots.get("spirit", 0)
        style = "Gun" if gun >= spirit + 3 else "Spirit" if spirit >= gun + 3 else "Hybrid"
        scaling = f"None of {name}'s abilities scale with spirit power" if n_spirit == 0 else \
            f"Only {n_spirit} of {name}'s 4 abilities scales with spirit power" if n_spirit == 1 else \
            f"Only {n_spirit} of {name}'s 4 abilities scale with spirit power"
        why = {
            "Gun": f"{scaling}, and high-rank players fill up on weapon items. Your gun does the work; abilities set up kills.",
            "Spirit": f"{n_spirit} of {name}'s 4 abilities scale with spirit power, so high-rank players stack spirit items. Your abilities do the damage; the gun finishes.",
            "Hybrid": f"{n_spirit} of {name}'s 4 abilities scale with spirit power, and high-rank players mix weapon and spirit items. You need both your gun and your abilities.",
        }[style]

        # Upgrade paths inside the build.
        chosen = [r for _, pick in phases for r in pick] + extra
        chosen_ids = {r["id"] for r in chosen}
        builds_into = {}
        for r in chosen:
            for comp in items[r["id"]].get("component_items") or []:
                cid = by_class.get(comp)
                if cid in chosen_ids:
                    builds_into[cid] = r["id"]

        def pack(r):
            it = items[r["id"]]
            t = tags(it)
            why = active_reason(it) if it.get("is_active_item") and (not t or t[0] not in ("antiheal", "anticc")) else None
            note = {"why": why or reason(name, t, r["phase"], style, n_spirit, bool(it.get("is_active_item"))),
                    "stats": key_stats(it), "effect": effect(it)}
            flags = []
            if it.get("is_active_item"):
                flags.append("active")
            if "antiheal" in t:
                flags.append("anti-heal")
            if "anticc" in t:
                flags.append("anti-CC")
            if r["id"] in sell_late:
                flags.append("sell-late")
            comps = [by_class.get(c) for c in it.get("component_items") or []]
            return [r["id"], round(r["share"], 1), round(r["wr"], 1), round(r["t"] / 60, 1), round(r["sold"]),
                    note, flags, builds_into.get(r["id"]), [c for c in comps if c], round(r["st"] / 60, 1) if r["st"] else None]

        # End-of-game inventory: drop upgraded components and items that are usually sold,
        # then if it's still over a full inventory, sell the cheapest, least important items for late ones.
        final = [r for _, pick in phases for r in pick if r["id"] not in builds_into and r["sold"] < 50]
        final.sort(key=lambda r: (-r["tier"], -r["score"]))
        sell_late = set()
        if len(final) > MAX_HELD:
            sell_late = {r["id"] for r in final[MAX_HELD:]}
            final = final[:MAX_HELD]
        final.sort(key=lambda r: (-r["tier"], r["t"]))

        # Skill order.
        skill = None
        mf_path = os.path.join(src, f"{hid}_maxfirst.json")
        if os.path.exists(mf_path):
            mf = [m for m in load(mf_path) if m.get("ability_id") and m["matches"]]
            total = sum(m["matches"] for m in load(mf_path)) or 1
            kit_ids = {a["id"] for a in kit}
            mf = [m for m in mf if m["ability_id"] in kit_ids]
            mf.sort(key=lambda m: -m["matches"])
            if mf:
                skill = [[m["ability_id"], round(100 * m["matches"] / total, 1), round(100 * m["wins"] / m["matches"], 1)] for m in mf]

        # What to sell: build items high-rank players often sell (not ones they upgrade), in the order they
        # sell them, each matched with the late item usually bought around the same time.
        sells, taken = [], set()
        sellable = [r for _, pick in phases for r in pick
                    if r["sold"] >= 25 and r["id"] not in builds_into and r["st"] and r["tier"] <= 3]
        main_late = [r for _, pick in phases[2:] for r in pick]
        for r in sorted(sellable, key=lambda r: r["st"]):
            repl = None
            for pool in (main_late, extra):  # prefer the main build, then situational items
                near = [b for b in pool if b["id"] not in taken and b["tier"] > r["tier"] and abs(b["t"] - r["st"]) <= 4 * 60]
                if near:
                    repl = min(near, key=lambda b: abs(b["t"] - r["st"]))
                    break
            if repl:
                taken.add(repl["id"])
            sells.append([r["id"], round(r["sold"]), round(r["st"] / 60, 1), repl["id"] if repl else None])

        # Full ability point order.
        points = None
        order_path = os.path.join(src, f"{hid}_order.json")
        if os.path.exists(order_path) and kit:
            priority = [s[0] for s in (skill or [])]
            points = point_order(load(order_path), [a["id"] for a in kit], priority)

        # Counter items for the two hardest matchups.
        counters = []
        for f in sorted(glob.glob(os.path.join(src, f"{hid}_vs_*.json"))):
            enemy = int(f.rsplit("_vs_", 1)[1].split(".")[0])
            vs = load(f)
            total_vs = max((s["matches"] for s in vs if items.get(int(s["item_id"])) and items[int(s["item_id"])].get("item_tier") == 1), default=0)
            best = []
            for s in vs:
                g = general.get(int(s["item_id"]))
                it = items.get(int(s["item_id"]))
                if not g or not it or int(it.get("item_tier") or 0) < 2 or s["matches"] < 40 or not total_vs:
                    continue
                wr_vs = 100 * s["wins"] / s["matches"]
                share_vs = 100 * s["matches"] / total_vs
                lift = wr_vs - g["wr"]
                if share_vs >= 6 and lift >= 3:
                    best.append((lift, int(s["item_id"]), round(wr_vs, 1), round(lift, 1)))
            best.sort(reverse=True)
            if best:
                counters.append({"enemy": enemy, "items": [[b[1], b[2], b[3]] for b in best[:2]]})

        builds[hid] = {"style": style, "why": why, "games": games[hid], "kit": kit, "skill": skill, "points": points,
                       "phases": [{"name": p, "items": [pack(r) for r in pick]} for p, pick in phases],
                       "situational": [pack(r) for r in extra],
                       "final": [r["id"] for r in final], "counters": counters, "sells": sells}

    data = {"taken": meta["taken"], "days": meta["days"], "min_badge": meta["min_badge"], "builds": builds,
            "names": {k: v for k, v in names.items()}}
    open(os.path.join(site, "builds.js"), "w", encoding="utf-8").write(
        "// Builds made by tools/make_builds.py from api.deadlock-api.com data.\n"
        "// item = [id, % bought, win %, avg buy minute, % sold, {why, stats, effect}, flags, builds-into id, built-from ids]\n"
        "window.BUILDS = " + json.dumps(data, separators=(",", ":"), ensure_ascii=False) + ";\n")
    print(len(builds), "builds", os.path.getsize(os.path.join(site, "builds.js")) // 1024, "KB")


if __name__ == "__main__":
    main()
