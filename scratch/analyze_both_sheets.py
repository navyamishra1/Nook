import PIL.Image as Image
import numpy as np

p1 = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789125978012.jpg'
p2 = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789125978135.jpg'

for name, path in [("Sheet 1", p1), ("Sheet 2", p2)]:
    img = Image.open(path).convert('RGB')
    arr = np.array(img)
    h, w, c = arr.shape
    print(f"\n================ {name} ({w}x{h}) ================")
    
    # Horiz gutters around y=240..265, y=495..520, y=745..770
    print("Horizontal lines around y=245..262:")
    for y in range(245, 262):
        print(f"y={y}: mean RGB={np.mean(arr[y, :, :], axis=0).round(1)}")

    print("\nHorizontal lines around y=500..518:")
    for y in range(500, 518):
        print(f"y={y}: mean RGB={np.mean(arr[y, :, :], axis=0).round(1)}")

    print("\nHorizontal lines around y=745..765:")
    for y in range(745, 765):
        print(f"y={y}: mean RGB={np.mean(arr[y, :, :], axis=0).round(1)}")

    print("\nTop and bottom:")
    for y in range(0, 8):
        print(f"y={y}: mean RGB={np.mean(arr[y, :, :], axis=0).round(1)}")
    for y in range(h-8, h):
        print(f"y={y}: mean RGB={np.mean(arr[y, :, :], axis=0).round(1)}")

    print("\nVertical splits around x=163..180, x=334..350, x=505..520:")
    for x in range(165, 178):
        print(f"x={x}: mean RGB={np.mean(arr[:, x, :], axis=0).round(1)}")
    for x in range(336, 348):
        print(f"x={x}: mean RGB={np.mean(arr[:, x, :], axis=0).round(1)}")
    for x in range(506, 518):
        print(f"x={x}: mean RGB={np.mean(arr[:, x, :], axis=0).round(1)}")
