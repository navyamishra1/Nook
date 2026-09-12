import json

batch_16_ids = [
    'pride-and-prejudice',
    'frankenstein',
    'alices-adventures-in-wonderland',
    'the-great-gatsby',
    'jane-eyre',
    'wuthering-heights',
    'emma',
    'persuasion',
    'northanger-abbey',
    'mansfield-park',
    'the-tenant-of-wildfell-hall',
    'a-room-with-a-view',
    'the-age-of-innocence',
    'the-house-of-mirth',
    'dracula',
    'the-turn-of-the-screw'
]

# Update data/seed/books.json
with open("data/seed/books.json", "r", encoding="utf-8") as f:
    books = json.load(f)

for b in books:
    if b["id"] in batch_16_ids:
        b["cover"] = f"assets/covers/{b['id']}.webp"

with open("data/seed/books.json", "w", encoding="utf-8") as f:
    json.dump(books, f, indent=2, ensure_ascii=False)

print("Updated data/seed/books.json successfully.")

# Update frontend/js/catalog-data.js
with open("frontend/js/catalog-data.js", "r", encoding="utf-8") as f:
    content = f.read()

for bid in batch_16_ids:
    # Replace either .svg or .png with .webp
    old_svg = f'"cover": "assets/covers/{bid}.svg"'
    old_png = f'"cover": "assets/covers/{bid}.png"'
    new_webp = f'"cover": "assets/covers/{bid}.webp"'
    if old_svg in content:
        content = content.replace(old_svg, new_webp)
        print(f"Replaced {bid} .svg -> .webp in catalog-data.js")
    elif old_png in content:
        content = content.replace(old_png, new_webp)
        print(f"Replaced {bid} .png -> .webp in catalog-data.js")
    elif new_webp in content:
        print(f"{bid} already using .webp in catalog-data.js")
    else:
        print(f"Warning: cover line for {bid} not found in catalog-data.js")

with open("frontend/js/catalog-data.js", "w", encoding="utf-8") as f:
    f.write(content)

print("Updated frontend/js/catalog-data.js successfully.")
