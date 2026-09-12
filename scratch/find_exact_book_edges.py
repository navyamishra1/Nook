import PIL.Image as Image
import numpy as np

img_path = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789121978977.jpg'
img = Image.open(img_path).convert('RGB')
arr = np.array(img)

# Let's check the Call of the Wild column 4 (x=511..679) around y=710..770
print("Call of the Wild bottom edge (col 4, y=715..765):")
for y in range(715, 765):
    row_rgb = np.mean(arr[y, 520:670, :], axis=0)
    print(f"y={y}: RGB={row_rgb}")

print("\nRow 1 bottom edge (col 1, y=240..255):")
for y in range(240, 255):
    row_rgb = np.mean(arr[y, 10:160, :], axis=0)
    print(f"y={y}: RGB={row_rgb}")

print("\nRow 2 bottom edge (col 1, y=490..510):")
for y in range(490, 510):
    row_rgb = np.mean(arr[y, 10:160, :], axis=0)
    print(f"y={y}: RGB={row_rgb}")
