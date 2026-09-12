from PIL import Image
import numpy as np

p1 = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789145725111.jpg'

im = Image.open(p1).convert('RGB')
arr = np.array(im)
h, w, _ = arr.shape

print(f"=== Sheet 1 Slices ===")
# Row 1/2 col profile
col_profile = arr[20:500, :, :].mean(axis=(0, 2))
for i, (start_x, end_x) in enumerate([(0, 15), (180, 205), (375, 400), (565, 590), (755, 780), (945, w)]):
    slice_vals = col_profile[start_x:end_x]
    print(f"Col zone {i} ({start_x}..{end_x}): {[(start_x + idx, round(val, 1)) for idx, val in enumerate(slice_vals)]}")

row_profile = arr[:, 20:500, :].mean(axis=(1, 2))
for j, (start_y, end_y) in enumerate([(0, 15), (245, 270), (500, 525), (755, 780), (1010, h)]):
    slice_vals = row_profile[start_y:end_y]
    print(f"Row zone {j} ({start_y}..{end_y}): {[(start_y + idx, round(val, 1)) for idx, val in enumerate(slice_vals)]}")
