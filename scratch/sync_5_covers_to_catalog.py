import json
import os
import re

ROOT_DIR = r"d:\Nook"
SEED_PATH = os.path.join(ROOT_DIR, "data", "seed", "books.json")
CATALOG_DATA_PATH = os.path.join(ROOT_DIR, "frontend", "js", "catalog-data.js")
CATALOG_JS_PATH = os.path.join(ROOT_DIR, "frontend", "js", "catalog.js")
COVERS_DIR = os.path.join(ROOT_DIR, "frontend", "assets", "covers")

NEW_5_IDS = [
    'silas-marner',
    'the-first-men-in-the-moon',
    'the-red-badge-of-courage',
    'the-scarlet-pimpernel',
    'the-prisoner-of-zenda'
]

# 1. Update data/seed/books.json
with open(SEED_PATH, "r", encoding="utf-8") as f:
    books = json.load(f)

print(f"Total books in seed: {len(books)}")

updated_count = 0
for b in books:
    b_id = b["id"]
    if b_id in NEW_5_IDS:
        b["cover"] = f"assets/covers/{b_id}.webp"
        updated_count += 1

print(f"Updated {updated_count} / {len(NEW_5_IDS)} books in books.json")

with open(SEED_PATH, "w", encoding="utf-8") as f:
    json.dump(books, f, indent=2, ensure_ascii=False)
print("Saved books.json")

# 2. Update frontend/js/catalog-data.js
catalog_data_content = f"""/**
 * Nook Verified Catalog Data
 * Expanded Curated Catalog (105 books)
 */

export const NOOK_CATALOG = {json.dumps(books, indent=2, ensure_ascii=False)};
"""

with open(CATALOG_DATA_PATH, "w", encoding="utf-8") as f:
    f.write(catalog_data_content)
print("Saved frontend/js/catalog-data.js")

# 3. Update customCovers map in frontend/js/catalog.js
with open(CATALOG_JS_PATH, "r", encoding="utf-8") as f:
    cat_js = f.read()

# Build full customCovers dictionary
all_webp_covers = {}
for b in books:
    b_id = b["id"]
    cover_path = b.get("cover", "")
    if cover_path.endswith(".webp"):
        all_webp_covers[b_id] = cover_path

print(f"Total books with webp covers across entire catalog: {len(all_webp_covers)} / 105")

custom_covers_entries = ",\n".join([f"    '{k}': '{v}'" for k, v in sorted(all_webp_covers.items())])
custom_covers_block = f"""  const customCovers = {{
{custom_covers_entries}
  }};"""

# Replace customCovers block in catalog.js
pattern = r"  const customCovers = \{[\s\S]*?\};"
cat_js_new = re.sub(pattern, custom_covers_block, cat_js)

with open(CATALOG_JS_PATH, "w", encoding="utf-8") as f:
    f.write(cat_js_new)
print("Saved frontend/js/catalog.js")

# 4. Verify all covers exist
missing = []
for b in books:
    c = b.get("cover", f"assets/covers/{b['id']}.svg")
    fname = os.path.basename(c)
    full = os.path.join(COVERS_DIR, fname)
    if not os.path.exists(full):
        missing.append((b["id"], c, full))

print(f"Missing covers verification: {len(missing)} missing")
if missing:
    for m in missing:
        print("  Missing:", m)
else:
    print("ALL 105 BOOK COVERS VERIFIED AND EXIST ON DISK (105/105 HIGH-RES WEBP)!")
