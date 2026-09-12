import json
import re

# Set 2 IDs
set_2_ids = {
    'sense-and-sensibility': 'sense-and-sensibility',
    'the-picture-of-dorian-gray': 'the-picture-of-dorian-gray',
    'the-secret-garden': 'the-secret-garden',
    'the-time-machine': 'the-time-machine',
    'the-war-of-the-worlds': 'the-war-of-the-worlds',
    'the-invisible-man': 'the-invisible-man',
    'the-strange-case-of-dr-jekyll-and-mr-hyde': 'the-strange-case-of-dr-jekyll-and-mr-hyde',
    'the-adventures-of-tom-sawyer': 'the-adventures-of-tom-sawyer',
    'adventures-of-huckleberry-finn': 'adventures-of-huckleberry-finn',
    'a-little-princess': 'a-little-princess',
    'the-wind-in-the-willows': 'the-wind-in-the-willows',
    'the-call-of-the-wild': 'the-call-of-the-wild',
    'white-fang': 'white-fang',
    'the-wonderful-wizard-of-oz': 'the-wonderful-wizard-of-oz',
    'anne-of-green-gables': 'anne-of-green-gables',
    'the-jungle-book': 'the-jungle-book'
}

# Update data/seed/books.json
with open("data/seed/books.json", "r", encoding="utf-8") as f:
    books = json.load(f)

for b in books:
    if b["id"] in set_2_ids:
        b["cover"] = f"assets/covers/{b['id']}.webp"

with open("data/seed/books.json", "w", encoding="utf-8") as f:
    json.dump(books, f, indent=2, ensure_ascii=False)

print("Updated data/seed/books.json successfully.")

# Update frontend/js/catalog-data.js
# Let's read the js file and update the cover fields
with open("frontend/js/catalog-data.js", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the cover line for each set 2 id
for bid in set_2_ids:
    old_line = f'"cover": "assets/covers/{bid}.svg"'
    new_line = f'"cover": "assets/covers/{bid}.webp"'
    if old_line in content:
        content = content.replace(old_line, new_line)
        print(f"Replaced {bid} in catalog-data.js")
    else:
        print(f"Warning: {old_line} not found in catalog-data.js")

with open("frontend/js/catalog-data.js", "w", encoding="utf-8") as f:
    f.write(content)

print("Updated frontend/js/catalog-data.js successfully.")
