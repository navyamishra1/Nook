import json
from pathlib import Path

books_file = Path("data/seed/books.json")
frontend_books_file = Path("frontend/data/seed/books.json")
catalog_js_file = Path("frontend/js/catalog-data.js")

assert books_file.exists(), "data/seed/books.json missing"
assert frontend_books_file.exists(), "frontend/data/seed/books.json missing"
assert catalog_js_file.exists(), "frontend/js/catalog-data.js missing"

with open(books_file, "r", encoding="utf-8") as f:
    books = json.load(f)

print(f"Total books in data/seed/books.json: {len(books)}")
assert len(books) == 105, f"Expected 105 books, got {len(books)}"

seen_ids = set()
total_word_count = 0
sources_count = {}
categories_count = {}

for idx, b in enumerate(books):
    bid = b["id"]
    assert bid not in seen_ids, f"Duplicate ID: {bid}"
    seen_ids.add(bid)

    assert b.get("reading_availability") == "hostable", f"{bid} not hostable"
    assert b.get("word_count", 0) >= 1000, f"{bid} word count too low: {b.get('word_count')}"
    assert b.get("estimated_reading_time", 0) > 0, f"{bid} reading time missing"
    assert b.get("cover_config"), f"{bid} cover_config missing"
    assert b.get("source") in ("standard-ebooks", "project-gutenberg", "gutenberg"), f"{bid} unexpected source {b.get('source')}"
    assert b.get("source_url"), f"{bid} source_url missing"
    assert b.get("license_or_rights"), f"{bid} license_or_rights missing"

    src = b["source"]
    sources_count[src] = sources_count.get(src, 0) + 1
    for cat in b.get("categories", []):
        categories_count[cat] = categories_count.get(cat, 0) + 1

    total_word_count += b["word_count"]

    # Check content files
    c1 = Path("data/books") / bid / "content.json"
    c2 = Path("frontend/data/books") / bid / "content.json"
    assert c1.exists(), f"Missing content file {c1}"
    assert c2.exists(), f"Missing content file {c2}"

    with open(c1, "r", encoding="utf-8") as cf:
        cpayload = json.load(cf)

    chapters = cpayload.get("chapters", [])
    assert len(chapters) >= 1, f"{bid} has no chapters"
    for ch in chapters:
        assert ch.get("title"), f"{bid} chapter {ch.get('number')} has no title"
        assert ch.get("content", "").strip(), f"{bid} chapter {ch.get('number')} has empty content"

# Verify 4 original seed books preserved
seed_checks = {
    "pride-and-prejudice": (61, 121497),
    "frankenstein": (30, 77682),
    "alices-adventures-in-wonderland": (12, 27272),
    "the-great-gatsby": (9, 48096)
}
for sid, (exp_ch, exp_w) in seed_checks.items():
    sbook = next(b for b in books if b["id"] == sid)
    cpath = Path("data/books") / sid / "content.json"
    with open(cpath, "r", encoding="utf-8") as f:
        cdata = json.load(f)
    assert len(cdata["chapters"]) == exp_ch, f"{sid} chapters expected {exp_ch}, got {len(cdata['chapters'])}"
    assert sbook["word_count"] == exp_w, f"{sid} word count expected {exp_w}, got {sbook['word_count']}"

print("==================================================")
print("ALL 105 BOOKS PASSED FULL-TEXT INTEGRITY VERIFICATION")
print(f"Total Catalog Word Count: {total_word_count:,} words")
print(f"Sources Breakdown: {sources_count}")
print(f"Unique Categories/Genres: {len(categories_count)}")
print("4 Original Seed Books Verified Intact.")
print("==================================================")
