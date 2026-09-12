import json
import os
from PIL import Image
import numpy as np

ROOT_DIR = r"d:\Nook"
IMG_PATH = r"C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789147667298.png"

with open(os.path.join(ROOT_DIR, "data", "seed", "books.json"), "r", encoding="utf-8") as f:
    books = json.load(f)

expected_5 = [
    'silas-marner',
    'the-first-men-in-the-moon',
    'the-red-badge-of-courage',
    'the-scarlet-pimpernel',
    'the-prisoner-of-zenda'
]

for exp in expected_5:
    b = next((x for x in books if x['id'] == exp), None)
    if b:
        print(f"Found {exp}: '{b['title']}' by {b['author']}, current cover: {b.get('cover')}")
    else:
        print(f"NOT FOUND: {exp}")

im = Image.open(IMG_PATH).convert('RGB')
arr = np.array(im)
h, w, _ = arr.shape
print(f"\nImage size: {w}x{h}")

# Inspect vertical column separators across x
# 5 columns -> 1024 / 5 ~ 204.8 px nominal width
col_profile = arr[20:320, :, :].mean(axis=(0, 2))
row_profile = arr[:, 20:1000, :].mean(axis=(1, 2))

print(f"Row top 15: {[round(x, 1) for x in row_profile[:15]]}")
print(f"Row bottom 15: {[round(x, 1) for x in row_profile[-15:]]}")

for i, (start_x, end_x) in enumerate([(0, 15), (190, 215), (395, 420), (600, 625), (810, 835), (1010, w)]):
    slice_vals = col_profile[start_x:end_x]
    print(f"Col zone {i} ({start_x}..{end_x}): {[(start_x + idx, round(val, 1)) for idx, val in enumerate(slice_vals)]}")
