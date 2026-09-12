import os
from PIL import Image, ImageEnhance, ImageFilter

SHEET1_PATH = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789145725111.jpg'
SHEET2_PATH = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789145725185.jpg'
OUTPUT_DIR = r'd:\Nook\frontend\assets\covers'

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Grid definition for Sheet 1 (959x1024)
sheet1_cols = [
    (3, 190),
    (196, 381),
    (388, 573),
    (579, 763),
    (770, 956)
]
sheet1_rows = [
    (2, 252),
    (258, 508),
    (514, 764),
    (770, 1020)
]

# Grid definition for Sheet 2 (960x1024)
sheet2_cols = [
    (3, 191),
    (197, 383),
    (389, 573),
    (579, 765),
    (771, 957)
]
sheet2_rows = [
    (2, 251),
    (257, 507),
    (513, 757),
    (764, 1019)
]

# Sheet 1: 16 covers
sheet1_books = [
    # Row 1
    (0, 0, 'the-sea-wolf', 'The Sea-Wolf'),
    (0, 1, 'the-count-of-monte-cristo', 'The Count of Monte Cristo'),
    (0, 2, 'the-three-musketeers', 'The Three Musketeers'),
    (0, 3, 'twenty-years-after', 'Twenty Years After'),
    (0, 4, 'the-prince-and-the-pauper', 'The Prince and the Pauper'),
    # Row 2
    (1, 0, 'moby-dick', 'Moby-Dick; or, the Whale'),
    (1, 1, 'bartleby-the-scrivener', 'Bartleby, the Scrivener'),
    (1, 2, 'crime-and-punishment', 'Crime and Punishment'),
    (1, 3, 'notes-from-underground', 'Notes from Underground'),
    (1, 4, 'the-brothers-karamazov', 'The Brothers Karamazov'),
    # Row 3
    (2, 0, 'the-idiot', 'The Idiot'),
    (2, 1, 'war-and-peace', 'War and Peace'),
    (2, 2, 'anna-karenina', 'Anna Karenina'),
    (2, 3, 'the-death-of-ivan-ilyich', 'The Death of Ivan Ilyich'),
    (2, 4, 'madame-bovary', 'Madame Bovary'),
    # Row 4
    (3, 0, 'les-miserables', 'Les Misérables'),
]

# Sheet 2: 20 covers
sheet2_books = [
    # Row 1
    (0, 0, 'the-hunchback-of-notre-dame', 'The Hunchback of Notre-Dame'),
    (0, 1, 'great-expectations', 'Great Expectations'),
    (0, 2, 'a-tale-of-two-cities', 'A Tale of Two Cities'),
    (0, 3, 'david-copperfield', 'David Copperfield'),
    (0, 4, 'oliver-twist', 'Oliver Twist'),
    # Row 2
    (1, 0, 'a-christmas-carol', 'A Christmas Carol'),
    (1, 1, 'the-metamorphosis', 'The Metamorphosis'),
    (1, 2, 'the-trial', 'The Trial'),
    (1, 3, 'dubliners', 'Dubliners'),
    (1, 4, 'a-portrait-of-the-artist-as-a-young-man', 'A Portrait of the Artist as a Young Man'),
    # Row 3
    (2, 0, 'the-awakening', 'The Awakening'),
    (2, 1, 'heart-of-darkness', 'Heart of Darkness'),
    (2, 2, 'the-secret-agent', 'The Secret Agent'),
    (2, 3, 'tess-of-the-durbervilles', "Tess of the d'Urbervilles"),
    (2, 4, 'far-from-the-madding-crowd', 'Far from the Madding Crowd'),
    # Row 4
    (3, 0, 'the-mayor-of-casterbridge', 'The Mayor of Casterbridge'),
    (3, 1, 'the-odyssey', 'The Odyssey'),
    (3, 2, 'the-iliad', 'The Iliad'),
    (3, 3, 'meditations', 'Meditations'),
    (3, 4, 'the-importance-of-being-earnest', 'The Importance of Being Earnest'),
]

TARGET_W, TARGET_H = 1600, 2400

def process_cover(img, r_idx, c_idx, cols, rows, book_id, title, sheet_label):
    x1, x2 = cols[c_idx]
    y1, y2 = rows[r_idx]
    
    crop = img.crop((x1, y1, x2, y2))
    
    # Resize to exact 2:3 target (1600x2400) using Lanczos
    resized = crop.resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)
    
    # Subtle enhancement: slight contrast and gentle unsharp mask to preserve crisp typography without artifacting
    enhancer = ImageEnhance.Contrast(resized)
    enhanced = enhancer.enhance(1.03)
    
    sharpness = ImageEnhance.Sharpness(enhanced)
    enhanced = sharpness.enhance(1.08)
    
    # Unsharp mask for crisp edges
    unsharp = enhanced.filter(ImageFilter.UnsharpMask(radius=1.2, percent=115, threshold=3))
    
    # Save WebP and PNG
    webp_path = os.path.join(OUTPUT_DIR, f"{book_id}.webp")
    png_path = os.path.join(OUTPUT_DIR, f"{book_id}.png")
    
    unsharp.save(webp_path, "WEBP", quality=95, method=6)
    unsharp.save(png_path, "PNG", optimize=True)
    print(f"[{sheet_label}] {book_id} -> {webp_path} ({TARGET_W}x{TARGET_H})")

print(f"Processing Sheet 1 ({len(sheet1_books)} covers)...")
im1 = Image.open(SHEET1_PATH).convert('RGB')
for r_idx, c_idx, book_id, title in sheet1_books:
    process_cover(im1, r_idx, c_idx, sheet1_cols, sheet1_rows, book_id, title, "Sheet 1")

print(f"\nProcessing Sheet 2 ({len(sheet2_books)} covers)...")
im2 = Image.open(SHEET2_PATH).convert('RGB')
for r_idx, c_idx, book_id, title in sheet2_books:
    process_cover(im2, r_idx, c_idx, sheet2_cols, sheet2_rows, book_id, title, "Sheet 2")

print("\nAll 36 high-resolution covers generated successfully.")
