import PIL.Image as Image
import numpy as np

img = Image.open(r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789121978977.jpg')
w, h = img.size

# Each cell has:
# Left spine edge (approx 8-10px) on the book mockup
# Let's inspect the 4 columns:
# Col 0: x ~ 4 to 166 (width ~162)
# Col 1: x ~ 174 to 337 (width ~163)
# Col 2: x ~ 345 to 507 (width ~162)
# Col 3: x ~ 515 to 678 (width ~163)
# Rows:
# Row 0: y ~ 0 to 253 (height ~253)
# Row 1: y ~ 256 to 509 (height ~253)
# Row 2: y ~ 512 to 765 (height ~253)
# Row 3: y ~ 768 to 1021 (height ~253)

# 163 * 1.5 = 244.5 (~245-250) -> Exact 2:3 ratio!

cols = [
    (5, 168),
    (175, 338),
    (346, 508),
    (516, 678)
]

rows = [
    (2, 252),
    (258, 508),
    (514, 764),
    (770, 1020)
]

for r_idx, (y1, y2) in enumerate(rows):
    for c_idx, (x1, x2) in enumerate(cols):
        cw = x2 - x1
        ch = y2 - y1
        print(f'R{r_idx} C{c_idx}: ({x1}, {y1}) - ({x2}, {y2}) -> {cw}x{ch} (ratio: {cw/ch:.3f})')
