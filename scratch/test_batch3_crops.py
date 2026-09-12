import PIL.Image as Image
import os

img_path = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789124686723.jpg'
img = Image.open(img_path).convert('RGB')

col_ranges = [
    (3, 167),     # Col 1
    (176, 337),   # Col 2
    (347, 506),   # Col 3
    (515, 679)    # Col 4
]

row_ranges = [
    (2, 250),     # Row 1
    (257, 503),   # Row 2
    (510, 746),   # Row 3
    (753, 1014)   # Row 4
]

out_dir = r'd:\Nook\scratch\crops_batch3'
os.makedirs(out_dir, exist_ok=True)

titles = [
    ['pride-and-prejudice', 'frankenstein', 'alices-adventures-in-wonderland', 'the-great-gatsby'],
    ['jane-eyre', 'wuthering-heights', 'emma', 'persuasion'],
    ['northanger-abbey', 'mansfield-park', 'the-tenant-of-wildfell-hall', 'a-room-with-a-view'],
    ['the-age-of-innocence', 'the-house-of-mirth', 'dracula', 'the-turn-of-the-screw']
]

for r_idx, (y1, y2) in enumerate(row_ranges):
    for c_idx, (x1, x2) in enumerate(col_ranges):
        bid = titles[r_idx][c_idx]
        crop = img.crop((x1, y1, x2, y2))
        crop.save(os.path.join(out_dir, f"{bid}.png"))
        print(f"Saved {bid}: ({x1}, {y1}, {x2}, {y2}), size={crop.size}")
