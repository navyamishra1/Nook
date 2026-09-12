import PIL.Image as Image
import numpy as np

img_path = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789124686723.jpg'
img = Image.open(img_path).convert('RGB')
arr = np.array(img)

print("Vertical splits around x=160..185:")
for x in range(160, 185):
    print(f"x={x}: mean RGB={np.mean(arr[:, x, :], axis=0).round(1)}")

print("\nVertical splits around x=330..355:")
for x in range(330, 355):
    print(f"x={x}: mean RGB={np.mean(arr[:, x, :], axis=0).round(1)}")

print("\nVertical splits around x=500..525:")
for x in range(500, 525):
    print(f"x={x}: mean RGB={np.mean(arr[:, x, :], axis=0).round(1)}")

print("\nLeft and right edges:")
for x in range(0, 10):
    print(f"x={x}: mean RGB={np.mean(arr[:, x, :], axis=0).round(1)}")
for x in range(672, 682):
    print(f"x={x}: mean RGB={np.mean(arr[:, x, :], axis=0).round(1)}")
