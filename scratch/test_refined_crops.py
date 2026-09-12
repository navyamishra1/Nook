import PIL.Image as Image
import os

img_path = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789121978977.jpg'
img = Image.open(img_path).convert('RGB')

# Let's define the 4 rows (y ranges) and 4 columns (x ranges)
# Let's inspect each row and column precisely:
col_ranges = [
    (4, 168),     # Col 1
    (176, 337),   # Col 2
    (345, 503),   # Col 3
    (511, 679)    # Col 4
]

row_ranges = [
    (2, 248),     # Row 1
    (257, 503),   # Row 2
    (511, 765),   # Row 3
    (772, 1020)   # Row 4
]

out_dir = r'd:\Nook\scratch\refined_crops'
os.makedirs(out_dir, exist_ok=True)

titles = [
    ['sense-and-sensibility', 'the-picture-of-dorian-gray', 'the-secret-garden', 'the-time-machine'],
    ['the-war-of-the-worlds', 'the-invisible-man', 'the-strange-case-of-dr-jekyll-and-mr-hyde', 'the-adventures-of-tom-sawyer'],
    ['adventures-of-huckleberry-finn', 'a-little-princess', 'the-wind-in-the-willows', 'the-call-of-the-wild'],
    ['white-fang', 'the-wonderful-wizard-of-oz', 'anne-of-green-gables', 'the-jungle-book']
]

for r_idx, (y1, y2) in enumerate(row_ranges):
    for c_idx, (x1, x2) in enumerate(col_ranges):
        bid = titles[r_idx][c_idx]
        crop = img.crop((x1, y1, x2, y2))
        crop.save(os.path.join(out_dir, f"{bid}.png"))
        print(f"Saved {bid}: ({x1}, {y1}, {x2}, {y2}), size={crop.size}")
