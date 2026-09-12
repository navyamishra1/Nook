import PIL.Image as Image
import numpy as np
import os

img = Image.open(r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789119115103.png').convert('RGB')
w, h = img.size
arr = np.array(img)

# Let's find horizontal gaps between books and vertical gaps between rows
# The background color is approximately [248, 243, 235]
bg_color = np.array([248, 243, 235])

# Let's inspect row 1 and row 2 Y boundaries:
# Compute distance from background per pixel
diff = np.sqrt(np.sum((arr.astype(float) - bg_color.astype(float))**2, axis=2))

# Row 1 mask: diff > 25
# Find y ranges for row 1 and row 2
row_mask = np.mean(diff > 25, axis=1) > 0.05
y_indices = np.where(row_mask)[0]

# Split y_indices into two clusters (row 1 and row 2)
split_idx = np.where(np.diff(y_indices) > 5)[0]
if len(split_idx) > 0:
    r1_y = (y_indices[0], y_indices[split_idx[0]])
    r2_y = (y_indices[split_idx[0]+1], y_indices[-1])
else:
    r1_y = (14, 180)
    r2_y = (194, 360)

print(f'Detected Row 1 Y: {r1_y}, Row 2 Y: {r2_y}')

# Now for each row, find the 8 columns
def find_columns(y1, y2):
    sub = diff[y1:y2, :]
    col_mask = np.mean(sub > 25, axis=0) > 0.05
    x_indices = np.where(col_mask)[0]
    # Split into 8 clusters
    splits = np.where(np.diff(x_indices) > 3)[0]
    cols = []
    prev = 0
    for s in splits:
        cols.append((x_indices[prev], x_indices[s]))
        prev = s + 1
    cols.append((x_indices[prev], x_indices[-1]))
    return cols

cols_r1 = find_columns(r1_y[0], r1_y[1])
cols_r2 = find_columns(r2_y[0], r2_y[1])

print(f'Row 1 cols count: {len(cols_r1)}')
for idx, (x1, x2) in enumerate(cols_r1):
    cw = x2 - x1 + 1
    ch = r1_y[1] - r1_y[0] + 1
    print(f'  R1 C{idx}: x=[{x1}, {x2}] ({cw}x{ch}, ratio={cw/ch:.3f})')

print(f'Row 2 cols count: {len(cols_r2)}')
for idx, (x1, x2) in enumerate(cols_r2):
    cw = x2 - x1 + 1
    ch = r2_y[1] - r2_y[0] + 1
    print(f'  R2 C{idx}: x=[{x1}, {x2}] ({cw}x{ch}, ratio={cw/ch:.3f})')
