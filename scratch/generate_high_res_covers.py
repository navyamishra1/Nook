import PIL.Image as Image
import PIL.ImageFilter as ImageFilter
import PIL.ImageEnhance as ImageEnhance
import os

img_path = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789121978977.jpg'
img = Image.open(img_path).convert('RGB')
out_dir = r'd:\Nook\frontend\assets\covers'
os.makedirs(out_dir, exist_ok=True)

TARGET_W, TARGET_H = 1600, 2400

# 16 books grid definitions with exact, pixel-measured bounding boxes
books_config = [
    # Row 1 (y: 2..248)
    {
        'id': 'sense-and-sensibility',
        'box': (4, 2, 168, 248)
    },
    {
        'id': 'the-picture-of-dorian-gray',
        'box': (177, 2, 336, 248)
    },
    {
        'id': 'the-secret-garden',
        'box': (345, 2, 502, 248)
    },
    {
        'id': 'the-time-machine',
        'box': (511, 2, 678, 248)
    },
    
    # Row 2 (y: 256..502)
    {
        'id': 'the-war-of-the-worlds',
        'box': (4, 256, 168, 502)
    },
    {
        'id': 'the-invisible-man',
        'box': (177, 256, 336, 502)
    },
    {
        'id': 'the-strange-case-of-dr-jekyll-and-mr-hyde',
        'box': (345, 256, 502, 502)
    },
    {
        'id': 'the-adventures-of-tom-sawyer',
        'box': (511, 256, 678, 502)
    },
    
    # Row 3 (y: 510..745)
    {
        'id': 'adventures-of-huckleberry-finn',
        'box': (4, 510, 168, 745)
    },
    {
        'id': 'a-little-princess',
        'box': (177, 510, 336, 745)
    },
    {
        'id': 'the-wind-in-the-willows',
        'box': (345, 510, 502, 745)
    },
    {
        'id': 'the-call-of-the-wild',
        'box': (511, 510, 678, 745)
    },
    
    # Row 4 (y: 753..1008)
    {
        'id': 'white-fang',
        'box': (4, 753, 168, 1008)
    },
    {
        'id': 'the-wonderful-wizard-of-oz',
        'box': (177, 753, 336, 1008)
    },
    {
        'id': 'anne-of-green-gables',
        'box': (345, 753, 502, 1008)
    },
    {
        'id': 'the-jungle-book',
        'box': (511, 753, 678, 1008)
    }
]

for cfg in books_config:
    b_id = cfg['id']
    x1, y1, x2, y2 = cfg['box']
    crop = img.crop((x1, y1, x2, y2))
    
    # High-quality upscale to 1600x2400 using Lanczos resampling
    upscaled = crop.resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)
    
    # Apply subtle unsharp masking and contrast enhancement to ensure crispness
    sharpened = upscaled.filter(ImageFilter.UnsharpMask(radius=2.5, percent=140, threshold=2))
    enhancer = ImageEnhance.Contrast(sharpened)
    final_img = enhancer.enhance(1.05)
    
    # Save optimized WebP and PNG
    webp_path = os.path.join(out_dir, f"{b_id}.webp")
    png_path = os.path.join(out_dir, f"{b_id}.png")
    
    final_img.save(webp_path, "WEBP", quality=95, method=6)
    final_img.save(png_path, "PNG", optimize=True)
    
    print(f"Generated {b_id} -> {webp_path} ({TARGET_W}x{TARGET_H}) & {png_path}")

print("All 16 high-resolution covers generated successfully.")
