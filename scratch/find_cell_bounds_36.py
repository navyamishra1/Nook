from PIL import Image
import numpy as np

p1 = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789145725111.jpg'
p2 = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789145725185.jpg'

def find_gutters(img_path, num_cols=5, num_rows=4):
    im = Image.open(img_path).convert('RGB')
    arr = np.array(im)
    h, w, _ = arr.shape
    
    # We know the background is cream / light near borders (RGB ~ 240-255)
    # Let's inspect row 1 y range, row 2 y range, etc.
    # In Sheet 2, there are 4 full rows and 5 full columns.
    
    print(f"\n--- Finding gutters for {img_path} ({w}x{h}) ---")
    
    # Let's examine vertical gutters by looking at average lightness in vertical stripes
    # Horizontal line profile between rows
    row_means = arr.mean(axis=(1, 2))
    # Vertical line profile between cols
    col_means = arr.mean(axis=(0, 2))
    
    # Let's find columns by checking x coordinates
    # Let's estimate nominal widths: 960 / 5 = 192 px per column.
    # Estimated nominal heights: 1024 / 4 = 256 px per row.
    
    # Let's inspect the borders around estimated col boundaries
    print("Col boundary search around x ~ 0, 192, 384, 576, 768, 960:")
    for est_x in [0, 192, 384, 576, 768, 960]:
        x_min = max(0, est_x - 15)
        x_max = min(w, est_x + 15)
        sub = arr[50:200, x_min:x_max, :].mean(axis=(0, 2))
        print(f"Around x={est_x}: min={sub.min():.1f}, max={sub.max():.1f}, xs={list(range(x_min, x_max))}")

    print("\nRow boundary search around y ~ 0, 256, 512, 768, 1024:")
    for est_y in [0, 256, 512, 768, 1024]:
        y_min = max(0, est_y - 15)
        y_max = min(h, est_y + 15)
        sub = arr[y_min:y_max, 50:200, :].mean(axis=(1, 2))
        print(f"Around y={est_y}: min={sub.min():.1f}, max={sub.max():.1f}")

find_gutters(p1)
find_gutters(p2)
