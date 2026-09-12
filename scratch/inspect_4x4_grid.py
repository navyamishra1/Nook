import PIL.Image as Image
import numpy as np

img = Image.open(r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789121978977.jpg')
w, h = img.size
print(f'Width: {w}, Height: {h}')

arr = np.array(img)
# Let's inspect the background/border colors
# Top left pixel
print('Corner pixel:', arr[0, 0])

# In 682x1024, 4 cols and 4 rows:
# Let's inspect the horizontal gaps and vertical gaps
# Rows:
# Row 0: y ~ 0 to 256
# Row 1: y ~ 256 to 512
# Row 2: y ~ 512 to 768
# Row 3: y ~ 768 to 1024
# Cols:
# Col 0: x ~ 0 to 170
# Col 1: x ~ 170 to 341
# Col 2: x ~ 341 to 511
# Col 3: x ~ 511 to 682

for r in range(4):
    for c in range(4):
        x1 = int(c * w / 4.0)
        x2 = int((c + 1) * w / 4.0)
        y1 = int(r * h / 4.0)
        y2 = int((r + 1) * h / 4.0)
        print(f'R{r} C{c}: ({x1}, {y1}) - ({x2}, {y2}) size=({x2-x1}x{y2-y1}) ratio={(x2-x1)/(y2-y1):.3f}')
