"""Tile stills into a contact sheet: contact.py out.png a.png b.png ... (labels = file names)."""
import sys
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
cols = min(4, len(files)); rows = (len(files) + cols - 1) // cols
w, h = 360, 640
sheet = Image.new("RGB", (cols * w, rows * (h + 24)), "white")
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((w, h), Image.LANCZOS)
    x, y = (i % cols) * w, (i // cols) * (h + 24)
    sheet.paste(im, (x, y + 24)); d.text((x + 6, y + 6), f.split("/")[-1], fill="black")
sheet.save(out)
