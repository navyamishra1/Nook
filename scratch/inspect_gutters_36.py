from PIL import Image
import numpy as np

p1 = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789145725111.jpg'
p2 = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789145725185.jpg'

def get_gutters(img_path):
    im = Image.open(img_path).convert('RGB')
    arr = np.array(im)
    h, w, _ = arr.shape
    
    print(f"\n==================== {img_path} ====================")
    
    # 1. Vertical columns (5 columns)
    # Check vertical lines across y in [50..220] (Row 1) and [300..480] (Row 2)
    col_profile = arr[20:500, :, :].mean(axis=(0, 2))
    
    # Let's inspect x slices around each separator
    # Left edge: 0..10
    # Sep 1: 180..205
    # Sep 2: 375..400
    # Sep 3: 565..590
    # Sep 4: 755..780
    # Right edge: 945..960
    
    # Find peaks in lightness (gutters are white/cream ~ > 230)
    # or find exact step changes
    for i, (start_x, end_x) in enumerate([(0, 15), (180, 205), (375, 400), (565, 590), (755, 780), (945, w)]):
        slice_vals = col_profile[start_x:end_x]
        print(f"Col zone {i} ({start_x}..{end_x}): {[(start_x + idx, round(val, 1)) for idx, val in enumerate(slice_vals)]}")
        
    # 2. Horizontal rows (4 rows)
    row_profile = arr[:, 20:500, :].mean(axis=(1, 2))
    for j, (start_y, end_y) in enumerate([(0, 15), (245, 270), (500, 525), (755, 780), (1010, h)]):
        slice_vals = row_profile[start_y:end_y]
        print(f"Row zone {j} ({start_y}..{end_y}): {[(start_y + idx, round(val, 1)) for idx, val in enumerate(slice_vals)]}")

get_gutters(p1)
get_gutters(p2)
