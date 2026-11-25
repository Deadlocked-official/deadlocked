"""Write changes.js: what moved since last week's refresh.

Compares last week's tiers.js, builds.js and itemdb.js (saved by the weekly job before it rebuilds)
with the new ones: heroes that changed skill tier, items added to or dropped from each build, and items
whose grade changed.

Usage: python tools/make_changes.py <old_dir> <site_dir>
If there's no old copy yet, it writes an empty changes.js that says the first comparison is coming.
"""
import json, os, sys, time


def read(path, var):
    if not os.path.exists(path):
        return None
    text = open(path, encoding="utf-8").read()
    marker = f"window.{var} = "
    if marker not in text:
        return None
    return json.loads(text.split(marker, 1)[1].strip().rstrip(";"))


def tier_map(t):
    out = {}
    for letter, _, heroes in (t or {}).get("tiers", []):
        for name, score, *_ in heroes:
            out[name] = (letter, score)
    return out


def build_items(b):
    return {int(hid): {i[0] for p in v["phases"] for i in p["items"]} for hid, v in (b or {}).get("builds", {}).items()}


def main():
    old_dir, site = sys.argv[1], sys.argv[2]
    new_t, new_b, new_i = read(os.path.join(site, "tiers.js"), "TIERS"), read(os.path.join(site, "builds.js"), "BUILDS"), read(os.path.join(site, "itemdb.js"), "ITEMDB")
    old_t, old_b, old_i = read(os.path.join(old_dir, "tiers.js"), "TIERS"), read(os.path.join(old_dir, "builds.js"), "BUILDS"), read(os.path.join(old_dir, "itemdb.js"), "ITEMDB")
    data = {"made": time.strftime("%Y-%m-%d"), "first": old_t is None and old_b is None,
            "from": (old_b or old_t or {}).get("taken"), "to": (new_b or new_t or {}).get("taken"),
            "tiers": [], "builds": [], "items": []}
    order = "SABCDF"
    if old_t and new_t:
        o, n = tier_map(old_t), tier_map(new_t)
        for name, (letter, score) in n.items():
            if name in o and o[name][0] != letter:
                data["tiers"].append([name, o[name][0], letter, o[name][1], score, "harder" if order.index(letter) < order.index(o[name][0]) else "easier"])
    if old_b and new_b:
        o, n = build_items(old_b), build_items(new_b)
        for hid, items in n.items():
            if hid in o:
                added, removed = sorted(items - o[hid]), sorted(o[hid] - items)
                if added or removed:
                    data["builds"].append([hid, added, removed])
    if old_i and new_i:
        for iid, v in new_i["items"].items():
            ov = old_i["items"].get(iid)
            if ov and ov.get("grade") and v.get("grade") and ov["grade"] != v["grade"]:
                data["items"].append([int(iid), ov["grade"], v["grade"], ov.get("delta"), v.get("delta")])
    open(os.path.join(site, "changes.js"), "w", encoding="utf-8").write(
        "// What changed since last week's refresh, made by tools/make_changes.py.\n"
        "window.CHANGES = " + json.dumps(data, separators=(",", ":"), ensure_ascii=False) + ";\n")
    print("changes:", "first run" if data["first"] else f"{len(data['tiers'])} tier moves, {len(data['builds'])} builds changed, {len(data['items'])} item grades")


if __name__ == "__main__":
    main()
