import PIL.Image as Image
import numpy as np

img_path = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789121978977.jpg'
img = Image.open(img_path).convert('RGB')
arr = np.array(img)

# Let's inspect the top and bottom of each row for each of the 4 columns
# 4 columns:
# Col 0 (x ~ 4..168)
# Col 1 (x ~ 176..337)
# Col 2 (x ~ 345..503)
# Col 3 (x ~ 511..679)

cols = [
    (4, 168),
    (176, 337),
    (345, 503),
    (511, 679)
]

# Let's test Row 1 (y=2..248)
# Let's test Row 2 (y=256..502)
# Let's test Row 3 (y=510..745)
# Let's test Row 4 (y=754..1015)

print("Row 4 top check (y=745..760):")
for col_idx, (x1, x2) in enumerate(cols):
    print(f"\nCol {col_idx} (x={x1}..{x2}):")
    for y in range(746, 758):
        rgb = np.mean(arr[y, x1+10:x2-10, :], axis=0)
        print(f"  y={y}: {rgb.round(1)}")

print("\nRow 4 bottom check (y=990..1024):")
for col_idx, (x1, x2) in enumerate(cols):
    print(f"\nCol {col_idx} (x={x1}..{x2}):")
    for y in range(995, 1024, 2):
        rgb = np.mean(arr[y, x1+10:x2-10, :], axis=0)
        print(f"  y={y}: {rgb.round(1)}")
