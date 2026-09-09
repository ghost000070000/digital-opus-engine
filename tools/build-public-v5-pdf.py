import json, os
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import ImageReader
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output'/'pdf'/'FINAL-28-GAME-PUBLIC-REVIEW-V5.pdf'
CAT=json.loads((ROOT/'games'/'catalog.json').read_text(encoding='utf-8'))
W,H=landscape(letter)

def fit(c,p,x,y,w,h):
    with Image.open(p) as im: iw,ih=im.size
    s=min(w/iw,h/ih); dw,dh=iw*s,ih*s
    c.setFillColor(HexColor('#05090f')); c.rect(x,y,w,h,fill=1,stroke=0)
    c.drawImage(ImageReader(str(p)),x+(w-dw)/2,y+(h-dh)/2,dw,dh,mask='auto')

def label(c,text,x,y,w):
    c.setFillColor(HexColor('#07111d')); c.rect(x,y-16,w,16,fill=1,stroke=0)
    c.setFillColor(HexColor('#b7c7d9')); c.setFont('Helvetica-Bold',7.5); c.drawString(x+6,y-11,text)

def clipped(s,n=150):
    s=str(s or 'None identified').replace('\u2011','-').replace('\u2013','-').replace('\u2014','-')
    return s if len(s)<=n else s[:n-3]+'...'

OUT.parent.mkdir(parents=True,exist_ok=True)
c=canvas.Canvas(str(OUT),pagesize=(W,H),pageCompression=1)
for i,g in enumerate(CAT['games'],1):
    gid=g['id']; d=ROOT/'public-showcase-review-v5'/gid; featured=g['qualityTier']=='featured'
    c.setFillColor(HexColor('#08101a')); c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(HexColor('#62e6d1')); c.setFont('Helvetica-Bold',8); c.drawString(28,H-26,f"{g['qualityTier'].upper()}  |  PUBLIC REVIEW V5")
    c.setFillColor(white); c.setFont('Helvetica-Bold',22); c.drawString(28,H-51,clipped(g['title'],48))
    qr=g['qualityReview']; score='  '.join([f"Visual {qr['visual']}",f"Clarity {qr['gameplayClarity']}",f"Layout {qr['levelComposition']}",f"Audio {qr['audio']}",f"Presentation {qr['presentation']}",f"Unique {qr['uniqueness']}"])
    c.setFillColor(HexColor('#b7c7d9')); c.setFont('Helvetica',8); c.drawString(28,H-68,score)
    top=H-84; bottom=70; gap=8; usable=top-bottom
    if featured:
        h1=usable*.50; h2=usable-h1-gap
        fit(c,d/'v4.png',28,bottom+h2+gap,225,h1); label(c,'V4 REFERENCE',28,bottom+h2+gap+h1,225)
        fit(c,d/'opening.png',261,bottom+h2+gap,W-289,h1); label(c,'V5 OPENING',261,bottom+h2+gap+h1,W-289)
        half=(W-64)/2
        fit(c,d/'gameplay.png',28,bottom,half,h2); label(c,'V5 GAMEPLAY',28,bottom+h2,half)
        fit(c,d/'highlight.png',36+half,bottom,half,h2); label(c,'V5 HIGHLIGHT',36+half,bottom+h2,half)
    else:
        left=248; right=W-292; half=(usable-gap)/2
        fit(c,d/'v4.png',28,bottom,left,usable); label(c,'V4 REFERENCE',28,bottom+usable,left)
        fit(c,d/'opening.png',284,bottom+half+gap,right,half); label(c,'V5 OPENING',284,bottom+half+gap+half,right)
        fit(c,d/'gameplay.png',284,bottom,right,half); label(c,'V5 GAMEPLAY',284,bottom+half,right)
    c.setFillColor(HexColor('#c8d5e3')); c.setFont('Helvetica',7.5)
    c.drawString(28,48,'Capability: '+clipped(g.get('purpose'),112))
    c.drawString(28,34,'Remaining weakness: '+clipped(qr.get('remainingGaps'),105))
    c.setFillColor(HexColor('#71869b')); c.drawRightString(W-28,25,f'{i} / {len(CAT["games"])}')
    c.showPage()
c.save()
print(OUT)
