import PIL.Image as Image
import os

img = Image.open(r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789119115103.png').convert('RGB')
os.makedirs('scratch/ref_crops', exist_ok=True)

row1_books = [
    'pride-and-prejudice',
    'frankenstein',
    'alices-adventures-in-wonderland',
    'the-adventures-of-sherlock-holmes',
    'the-great-gatsby',
    'moby-dick',
    'little-women',
    'dracula'
]

row2_books = [
    'jane-eyre',
    'wuthering-heights',
    'great-expectations',
    'the-count-of-monte-cristo',
    'the-odyssey',
    'the-iliad',
    'meditations',
    'the-importance-of-being-earnest'
]

# Exact boxes adjusted for book boundaries (trimming background margins)
# Row 1 Y: ~5 to ~181 (height 176)
# Row 2 Y: ~192 to ~368 (height 176)
# Each box width is ~117-119 px, 117.33 * 1.5 = 176 -> 2:3 ratio!

r1_cols = [
    (5, 122),
    (133, 250),
    (261, 378),
    (389, 506),
    (517, 634),
    (645, 762),
    (773, 890),
    (901, 1018)
]

r2_cols = [
    (5, 122),
    (133, 250),
    (261, 378),
    (389, 506),
    (517, 634),
    (645, 762),
    (773, 890),
    (901, 1018)
]

r1_y = (5, 181)
r2_y = (192, 368)

for idx, book_id in enumerate(row1_books):
    x1, x2 = r1_cols[idx]
    y1, y2 = r1_y
    crop = img.crop((x1, y1, x2, y2))
    # Resize to standard 600x900 2:3 ratio with high quality Lanczos filter
    resized = crop.resize((600, 900), Image.Resampling.LANCZOS)
    resized.save(f'scratch/ref_crops/{book_id}.webp', 'WEBP', quality=95)
    resized.save(f'scratch/ref_crops/{book_id}.png', 'PNG')
    print(f'Cropped R1 {book_id}: ({x1},{y1})-({x2},{y2}) -> 600x900')

for idx, book_id in enumerate(row2_books):
    x1, x2 = r2_cols[idx]
    y1, y2 = r2_y
    crop = img.crop((x1, y1, x2, y2))
    resized = crop.resize((600, 900), Image.Resampling.LANCZOS)
    resized.save(f'scratch/ref_crops/{book_id}.webp', 'WEBP', quality=95)
    resized.save(f'scratch/ref_crops/{book_id}.png', 'PNG')
    print(f'Cropped R2 {book_id}: ({x1},{y1})-({x2},{y2}) -> 600x900')
