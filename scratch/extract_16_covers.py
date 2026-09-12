import PIL.Image as Image
import os

img_path = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789119748110.png'
img = Image.open(img_path).convert('RGB')
w, h = img.size
print(f'Source reference image: {w}x{h}')

out_dir = r'd:\Nook\frontend\assets\covers'
os.makedirs(out_dir, exist_ok=True)

# Precise coordinates for the 16 books (tight crops around book artwork)
# Row 1 (y: 5 to 181, height = 176)
# Row 2 (y: 192 to 368, height = 176)

# Let's define the 8 columns for Row 1
r1_crops = {
    'pride-and-prejudice': (5, 5, 123, 181),
    'frankenstein': (133, 5, 251, 181),
    'alices-adventures-in-wonderland': (261, 5, 379, 181),
    'the-adventures-of-sherlock-holmes': (389, 5, 507, 181),
    'the-great-gatsby': (517, 5, 634, 181),
    'moby-dick': (645, 5, 763, 181),
    'little-women': (773, 5, 891, 181),
    'dracula': (901, 5, 1019, 181)
}

# Row 2
r2_crops = {
    'jane-eyre': (5, 192, 123, 368),
    'wuthering-heights': (133, 192, 251, 368),
    'great-expectations': (261, 192, 379, 368),
    'the-count-of-monte-cristo': (389, 192, 507, 368),
    'the-odyssey': (517, 192, 634, 368),
    'the-iliad': (645, 192, 763, 368),
    'meditations': (773, 192, 891, 368),
    'the-importance-of-being-earnest': (901, 192, 1019, 368)
}

all_crops = {**r1_crops, **r2_crops}

for book_id, (x1, y1, x2, y2) in all_crops.items():
    crop = img.crop((x1, y1, x2, y2))
    cw, ch = crop.size
    
    # Resize with high quality Lanczos filter to standard 600x900 (2:3)
    target_w, target_h = 600, 900
    resized = crop.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    # Save both PNG and WebP
    png_path = os.path.join(out_dir, f'{book_id}.png')
    webp_path = os.path.join(out_dir, f'{book_id}.webp')
    
    resized.save(png_path, 'PNG', optimize=True)
    resized.save(webp_path, 'WEBP', quality=95)
    
    print(f'Extracted {book_id}: crop=({x1},{y1})-({x2},{y2}) [{cw}x{ch}] -> Saved PNG & WEBP ({target_w}x{target_h})')

print(f'\nTotal extracted: {len(all_crops)}/16 covers')
