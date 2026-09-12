import PIL.Image as Image
import numpy as np

img_path = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789121978977.jpg'
img = Image.open(img_path).convert('RGB')
arr = np.array(img)
h, w, c = arr.shape
print(f"Source Image Dimensions: {w} x {h}")

# Let's inspect horizontal projections to find exact row breaks and margins
# Calculate gradient / variance along horizontal lines
horiz_diff = np.mean(np.abs(np.diff(arr.astype(float), axis=0)), axis=(1, 2))
vert_diff = np.mean(np.abs(np.diff(arr.astype(float), axis=1)), axis=(0, 2))

# Find row splits around y = 250, 500, 750
print("Horizontal lines around y=240..270:")
for y in range(245, 265):
    row_rgb = np.mean(arr[y, :, :], axis=0)
    print(f"y={y}: mean RGB={row_rgb}, horiz diff={horiz_diff[y]:.2f}")

print("\nHorizontal lines around y=500..525:")
for y in range(500, 520):
    row_rgb = np.mean(arr[y, :, :], axis=0)
    print(f"y={y}: mean RGB={row_rgb}, horiz diff={horiz_diff[y]:.2f}")

print("\nHorizontal lines around y=755..775:")
for y in range(755, 775):
    row_rgb = np.mean(arr[y, :, :], axis=0)
    print(f"y={y}: mean RGB={row_rgb}, horiz diff={horiz_diff[y]:.2f}")

print("\nTop and Bottom:")
for y in range(0, 10):
    print(f"y={y}: mean RGB={np.mean(arr[y, :, :], axis=0)}")
for y in range(h-10, h):
    print(f"y={y}: mean RGB={np.mean(arr[y, :, :], axis=0)}")
