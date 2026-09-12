import PIL.Image as Image
import numpy as np

img = Image.open(r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789119748110.png').convert('RGB')
arr = np.array(img)

# The background color is approximately [248, 243, 235]
bg_color = np.array([248, 243, 235])

# Let's find the exact top, bottom, left, right for each book in row 1 and row 2.
# Let's inspect the 8 books in Row 1:
# Row 1 roughly: y from 5 to 181
# Row 2 roughly: y from 192 to 368

# Let's do a vertical slice analysis across each column region
col_approx = [
    (0, 130),
    (125, 260),
    (255, 385),
    (385, 515),
    (515, 640),
    (640, 770),
    (770, 895),
    (895, 1024)
]

def get_exact_box(x_range, y_range):
    sub = arr[y_range[0]:y_range[1], x_range[0]:x_range[1]]
    diff = np.sqrt(np.sum((sub.astype(float) - bg_color.astype(float))**2, axis=2))
    mask = diff > 20 # Book pixels
    
    # Find active rows & cols
    rows = np.where(np.mean(mask, axis=1) > 0.05)[0]
    cols = np.where(np.mean(mask, axis=0) > 0.05)[0]
    
    if len(rows) == 0 or len(cols) == 0:
        return None
    
    y1 = y_range[0] + rows[0]
    y2 = y_range[0] + rows[-1]
    x1 = x_range[0] + cols[0]
    x2 = x_range[0] + cols[-1]
    
    w = x2 - x1 + 1
    h = y2 - y1 + 1
    return (x1, y1, x2, y2, w, h, w/h)

print('--- ROW 1 COVERS ---')
for i, ca in enumerate(col_approx):
    res = get_exact_box(ca, (0, 185))
    print(f'R1 Book {i+1}: box=({res[0]}, {res[1]}, {res[2]}, {res[3]}), size={res[4]}x{res[5]}, ratio={res[6]:.3f}')

print('\n--- ROW 2 COVERS ---')
for i, ca in enumerate(col_approx):
    res = get_exact_box(ca, (185, 372))
    print(f'R2 Book {i+1}: box=({res[0]}, {res[1]}, {res[2]}, {res[3]}), size={res[4]}x{res[5]}, ratio={res[6]:.3f}')
