#!/usr/bin/env python3
"""בונה את ספריית האיורים של DALI PAY מתמונות המקור שבתיקיית design-source/.

חשוב: זה חיתוך, ניקוי והגדלה של איורי המקור. אין כאן יצירת איורים חדשים.
הרצה: python3 scripts/build_assets.py   (דורש Pillow)
"""
import json
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'design-source')
OUT = os.path.join(ROOT, 'assets', 'sprites')
PUSH = os.path.join(ROOT, 'push')
os.makedirs(OUT, exist_ok=True)
os.makedirs(PUSH, exist_ok=True)

collage = Image.open(os.path.join(SRC, 'collage-characters.png')).convert('RGB')
tiles = Image.open(os.path.join(SRC, 'ui-tiles.jpg')).convert('RGB')
poster = Image.open(os.path.join(SRC, 'poster.png')).convert('RGB')

# ───── הגדרות: key -> (מקור, תיבת חיתוך, רדיוס פינות יחסי, תווית בעברית, קטגוריה, האם בגלריית ההודעות) ─────
C = 'collage'
T = 'tiles'
# אזור האיור בכל אריח (בלי תווית הטקסט הצהובה שבתחתיתו ובלי המסגרת הזוהרת)
COLS = [(7, 200), (219, 410), (429, 620), (639, 829), (847, 1036), (1054, 1247)]
ROW1, ROW2, ROW3, ROW4 = (393, 566), (635, 762), (833, 980), (1045, 1196)


def tile(r, c):
    return (COLS[c][0], r[0], COLS[c][1], r[1])


ITEMS = {
    # ── מהקולאז' הראשון (הבעות ומצבים) ──
    'think_who': (C, (12, 12, 175, 188), .22, 'מי חייב למי?', 'mood', True),
    'think_howmuch': (C, (182, 12, 346, 188), .22, 'כמה אני חייב?', 'mood', True),
    'paid_cash': (C, (845, 12, 1033, 190), .22, 'שילמתי!', 'money', True),
    'closed': (C, (1042, 12, 1240, 190), .22, 'החוב נסגר!', 'debt', True),
    'sleeping': (C, (2, 250, 196, 425), .22, 'נרדם בינתיים', 'mood', True),
    'new_debt': (C, (202, 238, 410, 428), .22, 'חוב חדש', 'debt', True),
    'waiting': (C, (832, 250, 1035, 428), .22, 'ממתין לתשלום', 'debt', True),
    'reminder_sent': (C, (1042, 250, 1246, 430), .22, 'שלחתי תזכורת', 'debt', True),
    'drinks': (C, (6, 490, 215, 648), .22, 'חלוקת הוצאה', 'mood', True),
    'split_done': (C, (224, 485, 445, 648), .22, 'חילקנו', 'mood', True),
    'moneybag': (C, (884, 482, 1246, 680), .22, 'עשירים', 'money', True),
    'shrug_a': (C, (6, 698, 155, 838), .22, 'עדיין חייב', 'mood', True),
    'shrug_b': (C, (160, 698, 316, 838), .22, 'לא ברור', 'mood', True),
    'cake': (C, (318, 688, 570, 832), .22, 'יום תשלום', 'mood', True),
    'calendar': (C, (578, 692, 745, 836), .22, 'תזכורת לתשלום', 'debt', True),
    'card': (C, (754, 698, 872, 836), .22, 'משלם עכשיו', 'money', True),
    'binoculars': (C, (880, 698, 1055, 836), .22, 'איפה הכסף?', 'money', True),
    'balanced': (C, (1060, 698, 1250, 836), .22, 'מאזן מאוזן', 'debt', True),
    'money_rain': (C, (2, 882, 225, 1018), .22, 'קיבלתי תשלום!', 'money', True),
    'piggy': (C, (232, 882, 430, 1018), .22, 'חוסכים לפעם הבאה', 'money', True),
    'burger': (C, (436, 882, 625, 1018), .22, 'זמן לאכול', 'mood', True),
    'facepalm': (C, (632, 882, 815, 1018), .22, 'שכחתי…', 'mood', True),
    'flying_money': (C, (822, 882, 1050, 1018), .22, 'הכסף עף', 'money', True),
    'receipt': (C, (1058, 882, 1250, 1018), .22, 'בוא נסדר את זה', 'debt', True),
    'gamepad': (C, (4, 1062, 276, 1204), .22, 'המשחק מתחיל', 'mood', True),
    'hoodies': (C, (282, 1062, 536, 1204), .22, 'מעדכנים חוב', 'debt', True),
    'coffee': (C, (722, 1062, 948, 1204), .22, 'שוב חוב על קפה', 'mood', True),
    'relax': (C, (958, 1062, 1250, 1204), .22, 'הכול בסדר', 'mood', True),
    # ── מהגיליון החדש (הדמויות החדשות, עם הכובע) ──
    'close_debt': (T, tile(ROW1, 0), .12, 'סגירת חוב', 'debt', True),
    'owed_to_me': (T, tile(ROW1, 1), .12, 'חייב לי', 'debt', True),
    'i_owe': (T, tile(ROW1, 2), .12, 'אני חייב', 'debt', True),
    'friends': (T, tile(ROW1, 3), .12, 'חברים', 'mood', True),
    'my_products': (T, tile(ROW1, 4), .12, 'המוצרים שלי', 'product', True),
    'inventory': (T, tile(ROW1, 5), .12, 'מלאי', 'product', True),
    'search': (T, tile(ROW2, 0), .12, 'מחפשים', 'mood', True),
    'summary': (T, tile(ROW2, 1), .12, 'סיכום', 'debt', True),
    'history': (T, tile(ROW2, 3), .12, 'היסטוריה', 'debt', True),
    'backup': (T, tile(ROW2, 4), .12, 'גיבוי ושחזור', 'icon', False),
    'settings': (T, tile(ROW2, 5), .12, 'הגדרות', 'icon', False),
    'open_debt': (T, tile(ROW3, 0), .12, 'חוב פתוח', 'debt', True),
    'closed_debt': (T, tile(ROW3, 1), .12, 'חוב סגור', 'debt', True),
    'product': (T, tile(ROW3, 2), .12, 'מוצר', 'product', True),
    'product_list': (T, tile(ROW3, 3), .12, 'רשימת מוצרים', 'product', True),
    'notes': (T, tile(ROW3, 4), .12, 'הערות', 'mood', True),
    'export_data': (T, tile(ROW3, 5), .12, 'ייצוא נתונים', 'icon', False),
    'import_data': (T, tile(ROW4, 0), .12, 'ייבוא נתונים', 'icon', False),
    'delete_product': (T, tile(ROW4, 1), .12, 'מחיקת מוצר', 'icon', False),
    'add_friend': (T, tile(ROW4, 2), .12, 'הוספת חבר', 'icon', False),
    'transfer_debt': (T, tile(ROW4, 3), .12, 'העברת חוב', 'debt', True),
    'add_product': (T, tile(ROW4, 4), .12, 'הוספת מוצר', 'product', True),
    'remove_product': (T, tile(ROW4, 5), .12, 'הסרת מוצר', 'product', True),
    # ── כרזות ──
    'banner': (T, (402, 8, 1246, 372), .06, 'DALI PAY', 'icon', False),
}


def rounded(img, radius_ratio):
    w, h = img.size
    m = Image.new('L', (w * 4, h * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * 4 - 1, h * 4 - 1), radius=int(min(w, h) * radius_ratio * 4), fill=255)
    out = img.convert('RGBA')
    out.putalpha(m.resize((w, h), Image.LANCZOS))
    return out


def upscale(img, factor=3, cap=640):
    w, h = img.size
    big = img.resize((w * factor, h * factor), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.6, percent=70, threshold=2))
    s = cap / max(big.size)
    if s < 1:
        big = big.resize((round(big.size[0] * s), round(big.size[1] * s)), Image.LANCZOS)
    return big


# ───── 1. איורים ─────
ratios, catalog = {}, []
for key, (src, box, rad, label, cat, gallery) in ITEMS.items():
    base = collage if src == C else tiles
    art = base.crop(box)
    img = upscale(art)
    out = rounded(img, rad)
    out.save(os.path.join(OUT, key + '.webp'), quality=88, method=6)
    ratios[key] = round(out.size[0] / out.size[1], 3)
    catalog.append({'key': key, 'label': label, 'cat': cat, 'gallery': gallery})

# כרזת הפתיחה (הפוסטר הראשי): חיתוך שוליים ופינות מעוגלות
pm = poster.crop((12, 12, 1242, 1242))
hero = rounded(upscale(pm, factor=1, cap=900), .10)
hero.save(os.path.join(OUT, 'hero.webp'), quality=90, method=6)
ratios['hero'] = round(hero.size[0] / hero.size[1], 3)
catalog.append({'key': 'hero', 'label': 'DALI PAY', 'cat': 'icon', 'gallery': False})

# ───── 2. תמונות להתראות Push (יחס 2:1 — מתאים לתצוגת תמונה גדולה בהתראה) ─────
def gradient(w, h):
    g = Image.new('RGB', (w, h))
    px = g.load()
    stops = [(0, (91, 33, 182)), (.55, (59, 130, 246)), (1, (236, 72, 153))]
    for x in range(w):
        for y in range(h):
            t = x / w * .8 + y / h * .2
            for i in range(len(stops) - 1):
                if stops[i][0] <= t <= stops[i + 1][0]:
                    k = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0])
                    px[x, y] = tuple(int(stops[i][1][j] + (stops[i + 1][1][j] - stops[i][1][j]) * k) for j in range(3))
                    break
            else:
                px[x, y] = stops[-1][1]
    return g


bg = gradient(1024, 512)
n_push = 0
for item in catalog:
    if not item['gallery']:
        continue
    spr = Image.open(os.path.join(OUT, item['key'] + '.webp')).convert('RGBA')
    s = min(472 / spr.size[1], 960 / spr.size[0])
    spr = spr.resize((round(spr.size[0] * s), round(spr.size[1] * s)), Image.LANCZOS)
    canvas = bg.copy().convert('RGBA')
    canvas.alpha_composite(spr, ((1024 - spr.size[0]) // 2, (512 - spr.size[1]) // 2))
    canvas.convert('RGB').save(os.path.join(PUSH, item['key'] + '.jpg'), quality=84, optimize=True)
    n_push += 1

# ───── 3. אייקון האפליקציה ומסך פתיחה (מהפוסטר החדש) ─────
ico = rounded(poster.crop((10, 10, 1244, 1244)).resize((1024, 1024), Image.LANCZOS), .22)
ico.save(os.path.join(ROOT, 'assets', 'icon.png'))
fg = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))   # אייקון adaptive: הכול בתוך אזור הבטיחות (66/108)
inner = ico.resize((640, 640), Image.LANCZOS)
fg.alpha_composite(inner, (192, 192))
fg.save(os.path.join(ROOT, 'assets', 'adaptive-icon.png'))
spl = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
spl.alpha_composite(ico.resize((720, 720), Image.LANCZOS), (152, 152))
spl.save(os.path.join(ROOT, 'assets', 'splash-icon.png'))

# אייקון התראה (Android דורש סילואטה לבנה על רקע שקוף): חץ ה-Play של הלוגו
S = 4
n = Image.new('RGBA', (96 * S, 96 * S), (0, 0, 0, 0))
d = ImageDraw.Draw(n)
d.rounded_rectangle((18 * S, 14 * S, 80 * S, 82 * S), radius=20 * S, outline=(255, 255, 255, 255), width=8 * S)
d.polygon([(40 * S, 32 * S), (40 * S, 64 * S), (66 * S, 48 * S)], fill=(255, 255, 255, 255))
n.resize((96, 96), Image.LANCZOS).save(os.path.join(ROOT, 'assets', 'notification-icon.png'))

# ───── 4. רישום נכסים לקוד ─────
lines = ["// נוצר אוטומטית ע\"י scripts/build_assets.py — אין לערוך ידנית.",
         "export const SPRITES = {"]
lines += [f"  {k}: require('../assets/sprites/{k}.webp')," for k in ratios]
lines += ["};", "", "export const RATIO = {"]
lines += [f"  {k}: {v}," for k, v in ratios.items()]
lines += ["};", "", "// הגלריה לבחירה בהודעות (cat: debt | money | mood | product)", "export const STICKERS = " + json.dumps([c for c in catalog if c['gallery']], ensure_ascii=False, indent=2) + ";", ""]
open(os.path.join(ROOT, 'src', 'sprites.js'), 'w', encoding='utf-8').write("\n".join(lines))
print(f"sprites={len(ratios)} gallery={sum(1 for c in catalog if c['gallery'])} push={n_push}")
