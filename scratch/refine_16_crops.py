import PIL.Image as Image
import numpy as np
import os

img_path = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789119748110.png'
img = Image.open(img_path).convert('RGB')
arr = np.array(img)
bg_color = np.array([248, 243, 235])

# Let's inspect each of the 16 books individually to find tight bounding boxes without any background bleed
# Row 1 and Row 2 approximate boxes:
r1_books = [
    'pride-and-prejudice',
    'frankenstein',
    'alices-adventures-in-wonderland',
    'the-adventures-of-sherlock-holmes',
    'the-great-gatsby',
    'moby-dick',
    'little-women',
    'dracula'
]

r2_books = [
    'jane-eyre',
    'wuthering-heights',
    'great-expectations',
    'the-count-of-monte-cristo',
    'the-odyssey',
    'the-iliad',
    'meditations',
    'the-importance-of-being-earnest'
]

# Exact measured column centers
# Let's refine per book
# In 1024 width:
# 8 books:
# 0: x in [6, 122]
# 1: x in [134, 250]
# 2: x in [262, 378]
# 3: x in [390, 506]
# 4: x in [518, 633]
# 5: x in [646, 762]
# 6: x in [774, 889]
# 7: x in [902, 1018]

# Row 1: y in [7, 180] (height 173)
# Row 2: y in [194, 367] (height 173)

refined_r1 = [
    (6, 7, 122, 180),
    (134, 7, 250, 180),
    (262, 7, 378, 180),
    (390, 7, 506, 180),
    (518, 7, 633, 180),
    (646, 7, 762, 180),
    (774, 7, 889, 180),
    (902, 7, 1018, 180)
]

refined_r2 = [
    (6, 194, 122, 367),
    (134, 194, 250, 367),
    (262, 194, 378, 367),
    (390, 194, 506, 367),
    (518, 194, 633, 367),
    (646, 194, 762, 367),
    (774, 194, 889, 367),
    (902, 194, 1018, 367)
]

out_dir = r'd:\Nook\frontend\assets\covers'

for idx, book_id in enumerate(r1_books):
    x1, y1, x2, y2 = refined_r1[idx]
    crop = img.crop((x1, y1, x2, y2))
    resized = crop.resize((600, 900), Image.Resampling.LANCZOS)
    resized.save(os.path.join(out_dir, f'{book_id}.png'), 'PNG', optimize=True)
    resized.save(os.path.join(out_dir, f'{book_id}.webp'), 'WEBP', quality=95)
    print(f'Refined R1 {book_id}: ({x1},{y1})-({x2},{y2})')

for idx, book_id in enumerate(r2_books):
    x1, y1, x2, y2 = refined_r2[idx]
    crop = img.crop((x1, y1, x2, y2))
    resized = crop.resize((600, 900), Image.Resampling.LANCZOS)
    resized.save(os.path.join(out_dir, f'{book_id}.png'), 'PNG', optimize=True)
    resized.save(os.path.join(out_dir, f'{book_id}.webp'), 'WEBP', quality=95)
    print(f'Refined R2 {book_id}: ({x1},{y1})-({x2},{y2})')
