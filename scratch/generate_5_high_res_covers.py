import os
from PIL import Image, ImageEnhance, ImageFilter

IMG_PATH = r"C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789147667298.png"
OUTPUT_DIR = r"d:\Nook\frontend\assets\covers"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# 5 covers bounding boxes (x1, x2) and y range (y1, y2)
cols_5 = [
    (2, 201),    # 1. Silas Marner
    (208, 406),  # 2. The First Men in the Moon
    (414, 612),  # 3. The Red Badge of Courage
    (620, 818),  # 4. The Scarlet Pimpernel
    (827, 1022)  # 5. The Prisoner of Zenda
]
y1, y2 = 2, 330

books_5 = [
    ('silas-marner', 'Silas Marner'),
    ('the-first-men-in-the-moon', 'The First Men in the Moon'),
    ('the-red-badge-of-courage', 'The Red Badge of Courage'),
    ('the-scarlet-pimpernel', 'The Scarlet Pimpernel'),
    ('the-prisoner-of-zenda', 'The Prisoner of Zenda')
]

TARGET_W, TARGET_H = 1600, 2400

im = Image.open(IMG_PATH).convert('RGB')

print("Processing 5 new covers...")
for idx, (b_id, title) in enumerate(books_5):
    x1, x2 = cols_5[idx]
    crop = im.crop((x1, y1, x2, y2))
    
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
    webp_path = os.path.join(OUTPUT_DIR, f"{b_id}.webp")
    png_path = os.path.join(OUTPUT_DIR, f"{b_id}.png")
    
    unsharp.save(webp_path, "WEBP", quality=95, method=6)
    unsharp.save(png_path, "PNG", optimize=True)
    print(f"[Generated] {b_id} -> {webp_path} ({TARGET_W}x{TARGET_H}) & {png_path}")

print("\nAll 5 high-resolution covers generated successfully.")
