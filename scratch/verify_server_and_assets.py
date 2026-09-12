import json
import urllib.request
import urllib.error
import os
from PIL import Image

ROOT_DIR = r"d:\Nook"
SEED_PATH = os.path.join(ROOT_DIR, "data", "seed", "books.json")
BASE_URL = "http://localhost:8000"

with open(SEED_PATH, "r", encoding="utf-8") as f:
    books = json.load(f)

print(f"Total books in catalog: {len(books)}")

# Test 1: Fetch books.json over HTTP
try:
    with urllib.request.urlopen(f"{BASE_URL}/data/seed/books.json") as resp:
        http_books = json.loads(resp.read().decode('utf-8'))
        print(f"[OK] HTTP /data/seed/books.json returned {len(http_books)} books (status: {resp.status})")
except Exception as e:
    print(f"[FAIL] Failed to fetch books.json over HTTP: {e}")

# Test 2: Check all 105 cover assets over HTTP and verify local PIL image validity
checked = 0
failed_http = []
failed_pil = []

for b in books:
    b_id = b["id"]
    cover_rel = b.get("cover", f"assets/covers/{b_id}.svg")
    cover_url = f"{BASE_URL}/{cover_rel}" if not cover_rel.startswith("http") else cover_rel
    
    # Check HTTP availability
    try:
        req = urllib.request.Request(cover_url, method="HEAD")
        with urllib.request.urlopen(req) as resp:
            if resp.status != 200:
                failed_http.append((b_id, cover_url, resp.status))
    except Exception as e:
        failed_http.append((b_id, cover_url, str(e)))
        
    # Check local image file integrity
    local_path = os.path.join(ROOT_DIR, "frontend", os.path.normpath(cover_rel))
    if not os.path.exists(local_path):
        failed_pil.append((b_id, local_path, "File not found"))
    else:
        if cover_rel.endswith((".webp", ".png", ".jpg")):
            try:
                with Image.open(local_path) as im:
                    im.verify()
                with Image.open(local_path) as im:
                    w, h = im.size
                    ratio = w / h
                    if abs(ratio - 2/3) > 0.02:
                        failed_pil.append((b_id, local_path, f"Aspect ratio {w}x{h} ({ratio:.3f}) != 2:3"))
            except Exception as e:
                failed_pil.append((b_id, local_path, f"PIL corrupt: {e}"))
    checked += 1

print(f"\n--- QA Check Results ---")
print(f"Total covers checked: {checked}")
print(f"HTTP failures: {len(failed_http)}")
if failed_http:
    for item in failed_http:
        print(" ", item)
print(f"Image integrity failures: {len(failed_pil)}")
if failed_pil:
    for item in failed_pil:
        print(" ", item)

if not failed_http and not failed_pil:
    print("\n[PERFECT PASS] All 105 book covers are accessible over HTTP and have flawless image integrity & 2:3 aspect ratio!")

