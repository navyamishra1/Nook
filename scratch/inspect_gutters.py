import PIL.Image as Image
import numpy as np

img = Image.open(r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789121978977.jpg')
arr = np.array(img)
w, h = img.size

# Let's inspect horizontal lines and vertical lines to see where the gutter lines are:
# In 682 width:
# Gutter 1 between col 0 and 1
# Gutter 2 between col 1 and 2
# Gutter 3 between col 2 and 3
# In 1024 height:
# Gutter 1 between row 0 and 1
# Gutter 2 between row 1 and 2
# Gutter 3 between row 2 and 3

bg_color = np.array([243, 243, 235])

# Let's check pixel columns around 170, 341, 511
print('Col borders around 170:', [arr[50, x].tolist() for x in range(165, 176)])
print('Col borders around 341:', [arr[50, x].tolist() for x in range(336, 347)])
print('Col borders around 511:', [arr[50, x].tolist() for x in range(506, 517)])

print('Row borders around 256:', [arr[y, 50].tolist() for y in range(250, 262)])
print('Row borders around 512:', [arr[y, 50].tolist() for y in range(506, 518)])
print('Row borders around 768:', [arr[y, 50].tolist() for y in range(762, 774)])
