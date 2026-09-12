import PIL.Image as Image
import numpy as np

img_path = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789121978977.jpg'
img = Image.open(img_path).convert('RGB')
arr = np.array(img)

# Let's check horizontal gutters for each of the 4 rows
# For row 1 (y=20..200):
for r_name, y_mid in [("Row 1", 100), ("Row 2", 380), ("Row 3", 620), ("Row 4", 880)]:
    print(f"\n=== {r_name} (y={y_mid}) ===")
    print("Col 0-1 split (x=165..180):")
    for x in range(165, 180):
        print(f"  x={x}: {arr[y_mid, x, :]}")
    print("Col 1-2 split (x=334..348):")
    for x in range(334, 348):
        print(f"  x={x}: {arr[y_mid, x, :]}")
    print("Col 2-3 split (x=500..516):")
    for x in range(500, 516):
        print(f"  x={x}: {arr[y_mid, x, :]}")
