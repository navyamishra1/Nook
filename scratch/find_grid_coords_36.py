from PIL import Image
import numpy as np

p1 = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789145725111.jpg'
p2 = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789145725185.jpg'

def analyze_sheet(path, name):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    arr = np.array(im)
    print(f"=== {name} ({w}x{h}) ===")
    
    # Check horizontal gutters (rows)
    row_diffs = np.mean(np.abs(arr[:, 1:, :] - arr[:, :-1, :]), axis=(1, 2))
    row_means = np.mean(arr, axis=(1, 2))
    
    # Check vertical gutters (cols)
    col_diffs = np.mean(np.abs(arr[1:, :, :] - arr[:-1, :, :]), axis=(0, 2))
    col_means = np.mean(arr, axis=(0, 2))
    
    print(f"Sample col means across width: start={col_means[:10]}, end={col_means[-10:]}")
    print(f"Sample row means across height: start={row_means[:10]}, end={row_means[-10:]}")

analyze_sheet(p1, "Sheet 1")
analyze_sheet(p2, "Sheet 2")
