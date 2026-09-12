import PIL.Image as Image
import os

img_path = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789121978977.jpg'
img = Image.open(img_path).convert('RGB')
os.makedirs('scratch/crops_next_16', exist_ok=True)

grid_mapping = [
    # Row 1
    ('sense-and-sensibility', (0, 0, 170, 256)),
    ('the-picture-of-dorian-gray', (170, 0, 341, 256)),
    ('the-secret-garden', (341, 0, 511, 256)),
    ('the-time-machine', (511, 0, 682, 256)),
    
    # Row 2
    ('the-war-of-the-worlds', (0, 256, 170, 512)),
    ('the-invisible-man', (170, 256, 341, 512)),
    ('the-strange-case-of-dr-jekyll-and-mr-hyde', (341, 256, 511, 512)),
    ('the-adventures-of-tom-sawyer', (511, 256, 682, 512)),
    
    # Row 3
    ('adventures-of-huckleberry-finn', (0, 512, 170, 768)),
    ('a-little-princess', (170, 512, 341, 768)),
    ('the-wind-in-the-willows', (341, 512, 511, 768)),
    ('the-call-of-the-wild', (511, 512, 682, 768)),
    
    # Row 4
    ('white-fang', (0, 768, 170, 1024)),
    ('the-wonderful-wizard-of-oz', (170, 768, 341, 1024)),
    ('anne-of-green-gables', (341, 768, 511, 1024)),
    ('the-jungle-book', (511, 768, 682, 1024))
]

for book_id, box in grid_mapping:
    crop = img.crop(box)
    crop.save(f'scratch/crops_next_16/{book_id}.png')
    print(f'Cropped {book_id}: {box} size={crop.size}')
