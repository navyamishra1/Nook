import PIL.Image as Image
import numpy as np

p1 = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789125978012.jpg'
p2 = r'C:\Users\hp\.gemini\antigravity-ide\brain\fc23f026-09fd-424b-a43f-ef1178db2bd0\.user_uploaded\media_1789125978135.jpg'

im1 = Image.open(p1).convert('RGB')
im2 = Image.open(p2).convert('RGB')

print(f"File 1 ({p1}): size={im1.size}")
print(f"File 2 ({p2}): size={im2.size}")

# Save top-left 200x200 crops to identify them
im1.crop((0, 0, 200, 250)).save('d:/Nook/scratch/p1_top_left.png')
im2.crop((0, 0, 200, 250)).save('d:/Nook/scratch/p2_top_left.png')
print("Saved top left crops")
