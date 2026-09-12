import PIL.Image as Image
import PIL.ImageFilter as ImageFilter
import PIL.ImageEnhance as ImageEnhance
import os

img_path = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789124686723.jpg'
img = Image.open(img_path).convert('RGB')
out_dir = r'd:\Nook\frontend\assets\covers'
os.makedirs(out_dir, exist_ok=True)

TARGET_W, TARGET_H = 1600, 2400

books_batch = [
    # Row 1 (y: 2..250)
    {
        'id': 'pride-and-prejudice',
        'title': 'Pride and Prejudice',
        'author': 'Jane Austen',
        'box': (3, 2, 167, 250)
    },
    {
        'id': 'frankenstein',
        'title': 'Frankenstein',
        'author': 'Mary Shelley',
        'box': (176, 2, 337, 250)
    },
    {
        'id': 'alices-adventures-in-wonderland',
        'title': "Alice's Adventures in Wonderland",
        'author': 'Lewis Carroll',
        'box': (347, 2, 506, 250)
    },
    {
        'id': 'the-great-gatsby',
        'title': 'The Great Gatsby',
        'author': 'F. Scott Fitzgerald',
        'box': (515, 2, 679, 250)
    },
    
    # Row 2 (y: 257..503)
    {
        'id': 'jane-eyre',
        'title': 'Jane Eyre',
        'author': 'Charlotte Brontë',
        'box': (3, 257, 167, 503)
    },
    {
        'id': 'wuthering-heights',
        'title': 'Wuthering Heights',
        'author': 'Emily Brontë',
        'box': (176, 257, 337, 503)
    },
    {
        'id': 'emma',
        'title': 'Emma',
        'author': 'Jane Austen',
        'box': (347, 257, 506, 503)
    },
    {
        'id': 'persuasion',
        'title': 'Persuasion',
        'author': 'Jane Austen',
        'box': (515, 257, 679, 503)
    },
    
    # Row 3 (y: 510..746)
    {
        'id': 'northanger-abbey',
        'title': 'Northanger Abbey',
        'author': 'Jane Austen',
        'box': (3, 510, 167, 746)
    },
    {
        'id': 'mansfield-park',
        'title': 'Mansfield Park',
        'author': 'Jane Austen',
        'box': (176, 510, 337, 746)
    },
    {
        'id': 'the-tenant-of-wildfell-hall',
        'title': 'The Tenant of Wildfell Hall',
        'author': 'Anne Brontë',
        'box': (347, 510, 506, 746)
    },
    {
        'id': 'a-room-with-a-view',
        'title': 'A Room with a View',
        'author': 'E. M. Forster',
        'box': (515, 510, 679, 746)
    },
    
    # Row 4 (y: 753..1014)
    {
        'id': 'the-age-of-innocence',
        'title': 'The Age of Innocence',
        'author': 'Edith Wharton',
        'box': (3, 753, 167, 1014)
    },
    {
        'id': 'the-house-of-mirth',
        'title': 'The House of Mirth',
        'author': 'Edith Wharton',
        'box': (176, 753, 337, 1014)
    },
    {
        'id': 'dracula',
        'title': 'Dracula',
        'author': 'Bram Stoker',
        'box': (347, 753, 506, 1014)
    },
    {
        'id': 'the-turn-of-the-screw',
        'title': 'The Turn of the Screw',
        'author': 'Henry James',
        'box': (515, 753, 679, 1014)
    }
]

for cfg in books_batch:
    b_id = cfg['id']
    x1, y1, x2, y2 = cfg['box']
    crop = img.crop((x1, y1, x2, y2))
    
    # High-quality upscale to preferred 1600x2400 using Lanczos resampling
    upscaled = crop.resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)
    
    # Subtle unsharp masking and contrast enhancement
    sharpened = upscaled.filter(ImageFilter.UnsharpMask(radius=2.5, percent=140, threshold=2))
    enhancer = ImageEnhance.Contrast(sharpened)
    final_img = enhancer.enhance(1.05)
    
    webp_path = os.path.join(out_dir, f"{b_id}.webp")
    png_path = os.path.join(out_dir, f"{b_id}.png")
    
    final_img.save(webp_path, "WEBP", quality=95, method=6)
    final_img.save(png_path, "PNG", optimize=True)
    
    print(f"Generated {b_id} -> {webp_path} ({TARGET_W}x{TARGET_H}) & {png_path}")

print("Batch of 16 high-resolution covers generated successfully.")
