import json
import os
from pathlib import Path

books_file = Path("data/seed/books.json")
frontend_books_file = Path("frontend/data/seed/books.json")
catalog_js_file = Path("frontend/js/catalog-data.js")

with open(books_file, "r", encoding="utf-8") as f:
    books = json.load(f)

total_count = len(books)
seen_ids = set()
duplicate_ids = []
missing_content = []
failed_books = []
suspicious_books = []
complete_books = []

for idx, b in enumerate(books):
    bid = b.get("id")
    title = b.get("title", "Unknown")
    author = b.get("author", "Unknown")
    meta_words = b.get("word_count", 0)

    # 1. Duplicate ID check
    if bid in seen_ids:
        duplicate_ids.append(bid)
    else:
        seen_ids.add(bid)

    # 2. Content existence check
    data_content_path = Path(f"data/books/{bid}/content.json")
    fe_content_path = Path(f"frontend/data/books/{bid}/content.json")

    if not data_content_path.exists() or not fe_content_path.exists():
        missing_content.append(bid)
        failed_books.append((bid, "Missing content.json in data/books or frontend/data/books"))
        continue

    # 3. Read content
    try:
        with open(data_content_path, "r", encoding="utf-8") as f:
            content = json.load(f)
    except Exception as e:
        failed_books.append((bid, f"Corrupted content.json: {e}"))
        continue

    chapters = content.get("chapters", [])
    if not chapters:
        failed_books.append((bid, "Zero chapters in content.json"))
        continue

    # Check chapters and word count
    total_actual_words = 0
    has_empty_chapter = False
    has_placeholder = False

    for ch in chapters:
        ch_text = ch.get("content", "")
        if not ch_text or not ch_text.strip():
            has_empty_chapter = True
        words = len(ch_text.split())
        total_actual_words += words
        # Check placeholder keywords
        lower = ch_text.lower()
        if "lorem ipsum" in lower or "placeholder text" in lower or "content coming soon" in lower:
            has_placeholder = True

    if has_empty_chapter:
        failed_books.append((bid, "Contains empty chapter"))
        continue

    if has_placeholder:
        failed_books.append((bid, "Contains placeholder stub text"))
        continue

    # 4. Provenance and rights check
    source = b.get("source")
    source_url = b.get("source_url")
    source_id = b.get("source_identifier")
    license_rights = b.get("license_or_rights")

    if not source or not source_url or not source_id or not license_rights:
        failed_books.append((bid, "Missing source/provenance/rights metadata"))
        continue

    # 5. Metadata word_count consistency check (within 5% tolerance)
    diff = abs(meta_words - total_actual_words)
    diff_pct = (diff / max(1, total_actual_words)) * 100
    if diff_pct > 5.0 and diff > 50:
        suspicious_books.append({
            "id": bid,
            "title": title,
            "reason": f"Word count mismatch: meta={meta_words:,}, actual={total_actual_words:,} (diff={diff_pct:.1f}%)"
        })

    # 6. Flag suspiciously below 5,000 words
    if total_actual_words < 5000:
        suspicious_books.append({
            "id": bid,
            "title": title,
            "reason": f"Low word count (<5,000 words): {total_actual_words:,} words (Short story/Novella)"
        })

    complete_books.append({
        "id": bid,
        "title": title,
        "author": author,
        "chapters": len(chapters),
        "actual_words": total_actual_words,
        "meta_words": meta_words,
        "source": source
    })

print(f"Total: {total_count}")
print(f"Complete: {len(complete_books)}")
print(f"Failed: {len(failed_books)}")
print(f"Suspicious: {len(suspicious_books)}")
print(f"Missing content: {len(missing_content)}")
print(f"Duplicate IDs: {len(duplicate_ids)}")

if suspicious_books:
    print("\nSuspicious items detail:")
    for s in suspicious_books:
        print(f"  - {s['id']}: {s['reason']}")

if failed_books:
    print("\nFailed items detail:")
    for f in failed_books:
        print(f"  - {f[0]}: {f[1]}")
