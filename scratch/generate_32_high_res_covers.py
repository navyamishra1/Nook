import PIL.Image as Image
import PIL.ImageFilter as ImageFilter
import PIL.ImageEnhance as ImageEnhance
import os

p1 = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789125978012.jpg'
p2 = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789125978135.jpg'

im1 = Image.open(p1).convert('RGB')
im2 = Image.open(p2).convert('RGB')

out_dir = r'd:\Nook\frontend\assets\covers'
os.makedirs(out_dir, exist_ok=True)

TARGET_W, TARGET_H = 1600, 2400

# Sheet 1: 16 covers
sheet1_cols = [(3, 166), (174, 337), (344, 508), (515, 680)]
sheet1_rows = [(2, 252), (258, 506), (513, 746), (752, 1022)]
sheet1_books = [
    # Row 1
    ('the-phantom-of-the-opera', 'The Phantom of the Opera', 'Gaston Leroux'),
    ('the-yellow-wallpaper', 'The Yellow Wallpaper', 'Charlotte Perkins Gilman'),
    ('the-scarlet-letter', 'The Scarlet Letter', 'Nathaniel Hawthorne'),
    ('the-house-of-the-seven-gables', 'The House of the Seven Gables', 'Nathaniel Hawthorne'),
    # Row 2
    ('the-adventures-of-sherlock-holmes', 'The Adventures of Sherlock Holmes', 'Arthur Conan Doyle'),
    ('the-hound-of-the-baskervilles', 'The Hound of the Baskervilles', 'Arthur Conan Doyle'),
    ('a-study-in-scarlet', 'A Study in Scarlet', 'Arthur Conan Doyle'),
    ('the-sign-of-the-four', 'The Sign of the Four', 'Arthur Conan Doyle'),
    # Row 3
    ('the-memoirs-of-sherlock-holmes', 'The Memoirs of Sherlock Holmes', 'Arthur Conan Doyle'),
    ('the-return-of-sherlock-holmes', 'The Return of Sherlock Holmes', 'Arthur Conan Doyle'),
    ('the-mysterious-affair-at-styles', 'The Mysterious Affair at Styles', 'Agatha Christie'),
    ('the-secret-adversary', 'The Secret Adversary', 'Agatha Christie'),
    # Row 4
    ('the-murder-on-the-links', 'The Murder on the Links', 'Agatha Christie'),
    ('the-man-in-the-brown-suit', 'The Man in the Brown Suit', 'Agatha Christie'),
    ('the-secret-of-chimneys', 'The Secret of Chimneys', 'Agatha Christie'),
    ('the-murder-of-roger-ackroyd', 'The Murder of Roger Ackroyd', 'Agatha Christie')
]

# Sheet 2: 16 covers
sheet2_cols = [(3, 165), (172, 336), (344, 509), (516, 680)]
sheet2_rows = [(2, 251), (257, 506), (513, 748), (755, 1022)]
sheet2_books = [
    # Row 1
    ('the-moonstone', 'The Moonstone', 'Wilkie Collins'),
    ('the-woman-in-white', 'The Woman in White', 'Wilkie Collins'),
    ('the-island-of-doctor-moreau', 'The Island of Doctor Moreau', 'H. G. Wells'),
    ('twenty-thousand-leagues-under-the-sea', 'Twenty Thousand Leagues Under the Sea', 'Jules Verne'),
    # Row 2
    ('journey-to-the-center-of-the-earth', 'Journey to the Center of the Earth', 'Jules Verne'),
    ('around-the-world-in-eighty-days', 'Around the World in Eighty Days', 'Jules Verne'),
    ('the-lost-world', 'The Lost World', 'Arthur Conan Doyle'),
    ('peter-and-wendy', 'Peter and Wendy', 'J. M. Barrie'),
    # Row 3
    ('little-men', 'Little Men', 'Louisa May Alcott'),
    ('jos-boys', "Jo's Boys", 'Louisa May Alcott'),
    ('anne-of-avonlea', 'Anne of Avonlea', 'L. M. Montgomery'),
    ('little-women', 'Little Women', 'Louisa May Alcott'),
    # Row 4
    ('anne-of-the-island', 'Anne of the Island', 'L. M. Montgomery'),
    ('the-second-jungle-book', 'The Second Jungle Book', 'Rudyard Kipling'),
    ('treasure-island', 'Treasure Island', 'Robert Louis Stevenson'),
    ('kidnapped', 'Kidnapped', 'Robert Louis Stevenson')
]

def process_sheet(im, rows, cols, books, sheet_label):
    idx = 0
    for r, (y1, y2) in enumerate(rows):
        for c, (x1, x2) in enumerate(cols):
            bid, title, author = books[idx]
            idx += 1
            crop = im.crop((x1, y1, x2, y2))
            
            # High-quality upscale to 1600x2400 using Lanczos resampling
            upscaled = crop.resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)
            
            # Subtle unsharp masking and contrast enhancement
            sharpened = upscaled.filter(ImageFilter.UnsharpMask(radius=2.5, percent=140, threshold=2))
            enhancer = ImageEnhance.Contrast(sharpened)
            final_img = enhancer.enhance(1.05)
            
            webp_path = os.path.join(out_dir, f"{bid}.webp")
            png_path = os.path.join(out_dir, f"{bid}.png")
            
            final_img.save(webp_path, "WEBP", quality=95, method=6)
            final_img.save(png_path, "PNG", optimize=True)
            
            print(f"[{sheet_label}] {bid} -> {webp_path} ({TARGET_W}x{TARGET_H}) & {png_path}")

print("Processing Sheet 1 (16 covers)...")
process_sheet(im1, sheet1_rows, sheet1_cols, sheet1_books, "Sheet 1")

print("Processing Sheet 2 (16 covers)...")
process_sheet(im2, sheet2_rows, sheet2_cols, sheet2_books, "Sheet 2")

print("All 32 high-resolution covers generated successfully.")
