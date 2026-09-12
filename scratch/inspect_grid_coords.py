import PIL.Image as Image
import numpy as np

img = Image.open(r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789119115103.png').convert('RGB')
w, h = img.size
print(f'Reference Image size: {w} x {h}')

# Let's find background color
arr = np.array(img)
bg_sample = arr[0, 0]
print(f'Top-left pixel RGB: {bg_sample}')

# Let's inspect rows:
# Row 1: y from ~10 to ~180
# Row 2: y from ~190 to ~365
# In 1024 width, 8 columns with margins:
# Each column is approximately 1024 / 8 = 128 px wide.
# Let's detect column boundaries by inspecting vertical projection or column borders.
row1_y1, row1_y2 = 14, 180
row2_y1, row2_y2 = 194, 360

print(f'Row 1 height: {row1_y2 - row1_y1}, Row 2 height: {row2_y2 - row2_y1}')

# Let's inspect column slices
for col in range(8):
    # approximate x
    x1 = int(col * (w / 8.0))
    x2 = int((col + 1) * (w / 8.0))
    print(f'Col {col}: x in [{x1}, {x2}]')
