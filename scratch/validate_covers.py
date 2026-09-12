"""
Validation script for Nook 105-Book Custom SVG Covers
"""

import json
from pathlib import Path
import xml.etree.ElementTree as ET

DATA_FILE = Path("data/seed/books.json")
FRONTEND_COVERS_DIR = Path("frontend/assets/covers")

with open(DATA_FILE, "r", encoding="utf-8") as f:
    books = json.load(f)

assert len(books) == 105, f"Expected 105 books, got {len(books)}"

seen_paths = set()
missing_covers = []
invalid_svgs = []

for b in books:
    bid = b["id"]
    cover_file = FRONTEND_COVERS_DIR / f"{bid}.svg"

    if not cover_file.exists():
        missing_covers.append(bid)
        continue

    if str(cover_file) in seen_paths:
        raise ValueError(f"Duplicate cover path: {cover_file}")
    seen_paths.add(str(cover_file))

    # Validate XML / SVG integrity
    try:
        content = cover_file.read_text(encoding="utf-8")
        assert "<svg" in content, "Missing <svg tag"
        assert "</svg>" in content, "Missing </svg> tag"
        root = ET.fromstring(content)
        assert root.tag.endswith("svg"), "Root is not svg"
    except Exception as e:
        invalid_svgs.append((bid, str(e)))

print("==================================================")
print("NOOK 105 CUSTOM COVERS VALIDATION REPORT")
print("==================================================")
print(f"Total Books Checked: {len(books)}")
print(f"Total Covers Found:   {len(seen_paths)}")
print(f"Missing Covers:       {len(missing_covers)}")
print(f"Invalid SVGs:         {len(invalid_svgs)}")

if missing_covers:
    print("Missing covers:", missing_covers)
if invalid_svgs:
    print("Invalid SVGs:", invalid_svgs)

assert len(seen_paths) == 105, f"Expected 105 covers, got {len(seen_paths)}"
assert len(missing_covers) == 0, f"Missing covers: {missing_covers}"
assert len(invalid_svgs) == 0, f"Invalid SVGs: {invalid_svgs}"

print("RESULT: ALL 105 COVERS PASS VALIDATION (100% SUCCESS)")
print("==================================================")
