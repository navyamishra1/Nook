import json

with open("data/seed/books.json", "r", encoding="utf-8") as f:
    books = json.load(f)

for b in books[:20]:
    print(f"{b['id']}: {b.get('cover')}")
