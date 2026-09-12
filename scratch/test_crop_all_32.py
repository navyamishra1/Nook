import PIL.Image as Image
import os

p1 = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789125978012.jpg'
p2 = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789125978135.jpg'

im1 = Image.open(p1).convert('RGB')
im2 = Image.open(p2).convert('RGB')

out_dir = r'd:\Nook\scratch\test_32_crops'
os.makedirs(out_dir, exist_ok=True)

# Sheet 1 config
sheet1_cols = [(3, 166), (174, 337), (344, 508), (515, 680)]
sheet1_rows = [(2, 252), (258, 506), (513, 746), (752, 1022)]
sheet1_ids = [
    ['the-phantom-of-the-opera', 'the-yellow-wallpaper', 'the-scarlet-letter', 'the-house-of-the-seven-gables'],
    ['the-adventures-of-sherlock-holmes', 'the-hound-of-the-baskervilles', 'a-study-in-scarlet', 'the-sign-of-the-four'],
    ['the-memoirs-of-sherlock-holmes', 'the-return-of-sherlock-holmes', 'the-mysterious-affair-at-styles', 'the-secret-adversary'],
    ['the-murder-on-the-links', 'the-man-in-the-brown-suit', 'the-secret-of-chimneys', 'the-murder-of-roger-ackroyd']
]

for r, (y1, y2) in enumerate(sheet1_rows):
    for c, (x1, x2) in enumerate(sheet1_cols):
        bid = sheet1_ids[r][c]
        crop = im1.crop((x1, y1, x2, y2))
        crop.save(os.path.join(out_dir, f"{bid}.png"))
        print(f"Sheet 1: {bid} ({x1},{y1},{x2},{y2}) size={crop.size}")

# Sheet 2 config
sheet2_cols = [(3, 165), (172, 336), (344, 509), (516, 680)]
sheet2_rows = [(2, 251), (257, 506), (513, 748), (755, 1022)]
sheet2_ids = [
    ['the-moonstone', 'the-woman-in-white', 'the-island-of-doctor-moreau', 'twenty-thousand-leagues-under-the-sea'],
    ['journey-to-the-center-of-the-earth', 'around-the-world-in-eighty-days', 'the-lost-world', 'peter-and-wendy'],
    ['little-men', 'jos-boys', 'anne-of-avonlea', 'little-women'],
    ['anne-of-the-island', 'the-second-jungle-book', 'treasure-island', 'kidnapped']
]

for r, (y1, y2) in enumerate(sheet2_rows):
    for c, (x1, x2) in enumerate(sheet2_cols):
        bid = sheet2_ids[r][c]
        crop = im2.crop((x1, y1, x2, y2))
        crop.save(os.path.join(out_dir, f"{bid}.png"))
        print(f"Sheet 2: {bid} ({x1},{y1},{x2},{y2}) size={crop.size}")
