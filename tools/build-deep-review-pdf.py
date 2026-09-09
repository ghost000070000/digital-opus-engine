from pathlib import Path
import json, re, textwrap
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public-showcase-review-v4" / "DEEP-28-GAME-REVIEW-V4.pdf"
CATALOG = json.loads((ROOT / "games" / "catalog.json").read_text(encoding="utf-8"))
W, H = landscape(letter)

def ascii_text(value):
    return str(value).replace("\u2192", "->").replace("\u2013", "-").replace("\u2014", "-").encode("ascii", "replace").decode("ascii")

def lines(value, width):
    return textwrap.wrap(ascii_text(value), width=width, break_long_words=False, break_on_hyphens=False)

c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
c.setTitle("Digital Opus Engine - Deep 28-Game Review V4")
for index, game in enumerate(CATALOG["games"], 1):
    q = game["qualityReview"]
    role = "FEATURED" if game.get("featured") else game["qualityTier"].upper()
    c.setFillColorRGB(.025, .055, .08)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColorRGB(.45, .9, .78)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(26, H - 25, f"DIGITAL OPUS ENGINE / DEEP REDESIGN V4 / {role}")
    c.setFillColorRGB(.94, .97, .98)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(26, H - 52, ascii_text(game["title"]))
    score_keys = ["visual", "gameplayClarity", "levelComposition", "audio", "presentation", "uniqueness"]
    score_line = "  |  ".join(f"{k.replace('gameplayClarity','clarity').replace('levelComposition','layout')}: {q[k]}" for k in score_keys)
    c.setFont("Helvetica", 8)
    c.setFillColorRGB(.72, .8, .84)
    c.drawString(26, H - 68, score_line)
    names = [("baseline", "BASELINE"), ("previous", "PREVIOUS"), ("v3", "V3"), ("current", "V4 CURRENT")]
    x0, top, gap = 26, H - 88, 10
    iw, ih = (W - 52 - gap) / 2, 176
    for pos, (filename, label) in enumerate(names):
        col, row = pos % 2, pos // 2
        x, y = x0 + col * (iw + gap), top - (row + 1) * (ih + 20)
        src = ROOT / "public-showcase-review-v4" / game["id"] / f"{filename}.png"
        if not src.exists():
            raise FileNotFoundError(src)
        c.drawImage(ImageReader(str(src)), x, y + 14, iw, ih, preserveAspectRatio=True, anchor="c", mask="auto")
        c.setFillColorRGB(.45, .9, .78) if filename == "current" else c.setFillColorRGB(.72, .8, .84)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(x, y + 3, label)
    note = re.sub(r"^Deep redesign:\s*", "", q.get("notes", ""))
    c.setFillColorRGB(.94, .97, .98)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(26, 48, "REDESIGN")
    c.setFont("Helvetica", 7.5)
    for i, line in enumerate(lines(note, 145)[:2]):
        c.drawString(82, 48 - i * 9, line)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(26, 24, "REMAINING")
    c.setFont("Helvetica", 7.5)
    for i, line in enumerate(lines(q.get("remainingGaps", "None recorded"), 125)[:2]):
        c.drawString(82, 24 - i * 9, line)
    c.setFillColorRGB(.55, .64, .68)
    c.setFont("Helvetica", 7)
    c.drawRightString(W - 26, 14, f"{index} / {len(CATALOG['games'])} - local pre-release review - no deployment")
    c.showPage()
c.save()
print(f"Wrote {OUT} ({OUT.stat().st_size} bytes, {len(CATALOG['games'])} pages)")
