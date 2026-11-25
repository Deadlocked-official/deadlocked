"""Write items.js: every shop item's name, slot, tier, cost and icon from api.deadlock-api.com.

Usage: python tools/make_items.py <site_dir>
"""
import json, os, sys, urllib.request

URL = "https://api.deadlock-api.com/v1/assets/items/by-type/upgrade"


def main():
    req = urllib.request.Request(URL, headers={"User-Agent": "deadlocked-site-items/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        items = json.load(r)
    out = {}
    for it in items:
        if not it.get("shopable") or it.get("disabled"):
            continue
        img = it.get("shop_image_webp") or it.get("shop_image") or it.get("image_webp") or it.get("image")
        out[int(it["id"])] = [it["name"], it.get("item_slot_type"), int(it.get("item_tier") or 0), int(it.get("cost") or 0), img]
    if len(out) < 50:
        raise SystemExit(f"Only {len(out)} items came back; keeping the old items.js")
    open(os.path.join(sys.argv[1], "items.js"), "w", encoding="utf-8").write(
        "// Shop items from api.deadlock-api.com: id -> [name, slot, tier, cost, image]\n"
        "window.ITEMS = " + json.dumps(out, separators=(",", ":"), ensure_ascii=False) + ";\n")
    print(len(out), "items")


if __name__ == "__main__":
    main()
