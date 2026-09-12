"""
Nook 105-Book Bespoke SVG Cover Asset Generator
Generates 105 original, cohesive, lightweight vector SVG covers
with literary motifs, rich boutique cloth/paper palettes, and serif display typography.
"""

import json
import os
import re
from pathlib import Path
import html

DATA_FILE = Path("data/seed/books.json")
FRONTEND_COVERS_DIR = Path("frontend/assets/covers")
ROOT_COVERS_DIR = Path("assets/covers")

FRONTEND_COVERS_DIR.mkdir(parents=True, exist_ok=True)
ROOT_COVERS_DIR.mkdir(parents=True, exist_ok=True)

with open(DATA_FILE, "r", encoding="utf-8") as f:
    books = json.load(f)

# Comprehensive vector motif library tailored to literary classics
MOTIF_SVGS = {
    "botanical-filigree": """
        <!-- Delicate Regency Botanical Filigree & Quill -->
        <g stroke="{foil}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 230 330 C 260 300, 340 300, 370 330" />
            <path d="M 300 280 C 300 320, 300 360, 300 390" />
            <path d="M 270 310 C 285 295, 315 295, 330 310" />
            <path d="M 250 345 C 270 335, 300 345, 300 370 C 300 345, 330 335, 350 345" />
            <circle cx="300" cy="275" r="4" fill="{foil}" />
            <circle cx="230" cy="330" r="3" fill="{foil}" />
            <circle cx="370" cy="330" r="3" fill="{foil}" />
            <path d="M 285 365 C 270 380, 240 390, 220 385" />
            <path d="M 315 365 C 330 380, 360 390, 380 385" />
        </g>
    """,
    "vintage-engraving": """
        <!-- Galvanic Spark & Laboratory Flask -->
        <g stroke="{foil}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 285 270 L 315 270 L 315 300 L 345 365 C 350 375, 345 385, 335 385 L 265 385 C 255 385, 250 375, 255 365 L 285 300 Z" />
            <line x1="275" y1="355" x2="325" y2="355" stroke-dasharray="3,3" />
            <path d="M 300 240 L 300 260 M 275 245 L 285 260 M 325 245 L 315 260" />
            <polygon points="300,295 306,310 294,318 303,335 290,323 302,315" fill="{foil}" />
            <circle cx="300" cy="235" r="3" fill="{foil}" />
        </g>
    """,
    "pocket-watch": """
        <!-- Antique Pocket Watch & Loop -->
        <g stroke="{foil}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="300" cy="330" r="55" />
            <circle cx="300" cy="330" r="48" stroke-dasharray="2,6" />
            <circle cx="300" cy="262" r="12" />
            <rect x="296" y="274" width="8" height="4" fill="{foil}" />
            <line x1="300" y1="330" x2="300" y2="298" stroke-width="3" />
            <line x1="300" y1="330" x2="325" y2="330" stroke-width="2.5" />
            <circle cx="300" cy="330" r="4" fill="{foil}" />
            <circle cx="300" cy="288" r="2" fill="{foil}" />
            <circle cx="342" cy="330" r="2" fill="{foil}" />
            <circle cx="300" cy="372" r="2" fill="{foil}" />
            <circle cx="258" cy="330" r="2" fill="{foil}" />
        </g>
    """,
    "art-deco-sunburst": """
        <!-- 1920s Art-Deco Geometric Sunburst -->
        <g stroke="{foil}" stroke-width="2" fill="none" stroke-linecap="round">
            <path d="M 230 360 L 300 260 L 370 360 Z" stroke-width="2.5" />
            <path d="M 245 360 L 300 280 L 355 360 Z" />
            <path d="M 260 360 L 300 300 L 340 360 Z" />
            <line x1="300" y1="240" x2="300" y2="215" stroke-width="2.5" />
            <line x1="270" y1="248" x2="250" y2="230" stroke-width="2" />
            <line x1="330" y1="248" x2="350" y2="230" stroke-width="2" />
            <line x1="245" y1="270" x2="220" y2="260" stroke-width="2" />
            <line x1="355" y1="270" x2="380" y2="260" stroke-width="2" />
            <circle cx="300" cy="360" r="5" fill="{foil}" />
        </g>
    """,
    "english-manor": """
        <!-- Thornfield Gothic Manor Silhouette -->
        <g stroke="{foil}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 240 370 L 240 320 L 270 285 L 300 320 L 300 370 Z" />
            <path d="M 300 370 L 300 310 L 330 270 L 360 310 L 360 370 Z" />
            <path d="M 270 310 L 270 335 L 260 335 L 260 310 Z" />
            <path d="M 330 295 L 330 325 L 320 325 L 320 295 Z" />
            <line x1="220" y1="370" x2="380" y2="370" stroke-width="2.5" />
            <circle cx="300" cy="250" r="3" fill="{foil}" />
        </g>
    """,
    "moor-wind": """
        <!-- Windswept Yorkshire Moorland & Grasses -->
        <g stroke="{foil}" stroke-width="2.2" fill="none" stroke-linecap="round">
            <path d="M 220 360 Q 270 310 330 350 T 380 340" />
            <path d="M 230 340 Q 280 365 340 325 T 380 360" stroke-width="1.8" />
            <path d="M 280 330 C 270 290 260 270 250 260" />
            <path d="M 280 330 C 285 295 295 275 310 265" />
            <path d="M 320 340 C 330 300 345 280 365 270" />
            <circle cx="300" cy="245" r="4" fill="{foil}" />
        </g>
    """,
    "magnifying-glass": """
        <!-- Victorian Detective Magnifying Lens -->
        <g stroke="{foil}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="285" cy="305" r="45" stroke-width="3" />
            <circle cx="285" cy="305" r="36" stroke-dasharray="3,3" />
            <line x1="318" y1="338" x2="365" y2="385" stroke-width="6" />
            <line x1="285" y1="280" x2="285" y2="330" stroke-width="1.5" />
            <line x1="260" y1="305" x2="310" y2="305" stroke-width="1.5" />
            <circle cx="285" cy="305" r="3" fill="{foil}" />
        </g>
    """,
    "gothic-tower": """
        <!-- Gothic Cathedral Arches & Window -->
        <g stroke="{foil}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 255 375 L 255 300 C 255 255 300 240 300 240 C 300 240 345 255 345 300 L 345 375 Z" />
            <path d="M 270 375 L 270 315 C 270 285 300 270 300 270 C 300 270 330 285 330 315 L 330 375" />
            <circle cx="300" cy="290" r="10" />
            <line x1="300" y1="300" x2="300" y2="375" />
            <line x1="240" y1="375" x2="360" y2="375" stroke-width="3" />
        </g>
    """,
    "hourglass-filigree": """
        <!-- Celestial Chronometer & Hourglass -->
        <g stroke="{foil}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="260" y1="260" x2="340" y2="260" stroke-width="4" />
            <line x1="260" y1="380" x2="340" y2="380" stroke-width="4" />
            <path d="M 268 260 C 268 310, 295 320, 300 320 C 305 320, 332 310, 332 260 Z" />
            <path d="M 268 380 C 268 330, 295 320, 300 320 C 305 320, 332 330, 332 380 Z" />
            <circle cx="300" cy="320" r="2.5" fill="{foil}" />
            <circle cx="300" cy="355" r="5" fill="{foil}" />
            <path d="M 240 320 C 240 280, 360 280, 360 320" stroke-dasharray="2,4" />
        </g>
    """,
    "harpoon-mast": """
        <!-- Whaling Harpoon & Ocean Waves -->
        <g stroke="{foil}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="245" y1="375" x2="355" y2="265" stroke-width="3" />
            <path d="M 355 265 L 340 260 L 348 275 L 365 260 L 350 278 Z" fill="{foil}" />
            <path d="M 220 365 Q 250 350 280 365 T 340 365 T 380 365" />
            <path d="M 240 380 Q 270 368 300 380 T 360 380" stroke-width="1.8" />
            <circle cx="300" cy="240" r="4" fill="{foil}" />
        </g>
    """,
    "chateau-dif": """
        <!-- Château d'If Fortress & Crossed Swords -->
        <g stroke="{foil}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 260 360 L 260 290 L 275 290 L 275 300 L 290 300 L 290 290 L 310 290 L 310 300 L 325 300 L 325 290 L 340 290 L 340 360 Z" />
            <line x1="240" y1="360" x2="360" y2="360" stroke-width="3" />
            <path d="M 290 330 C 290 320, 310 320, 310 330 L 310 360 L 290 360 Z" />
            <circle cx="300" cy="255" r="10" stroke-dasharray="2,3" />
            <circle cx="300" cy="255" r="3" fill="{foil}" />
        </g>
    """,
    "greek-galley": """
        <!-- Ancient Greek Trireme Galley & Waves -->
        <g stroke="{foil}" stroke-width="2.3" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 230 335 Q 260 340 300 340 Q 345 340 375 315 L 360 345 Q 300 360 240 350 Z" fill="{foil}" fill-opacity="0.2" />
            <line x1="300" y1="340" x2="300" y2="265" stroke-width="3" />
            <path d="M 300 270 L 345 290 L 300 310 Z" fill="{foil}" fill-opacity="0.3" />
            <line x1="260" y1="345" x2="250" y2="365" />
            <line x1="280" y1="345" x2="270" y2="365" />
            <line x1="300" y1="345" x2="290" y2="365" />
            <line x1="320" y1="345" x2="310" y2="365" />
            <path d="M 220 375 Q 260 365 300 375 T 380 375" />
        </g>
    """,
    "trojan-helm": """
        <!-- Trojan War Crested Helmet -->
        <g stroke="{foil}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 260 320 C 260 270 340 270 340 320 L 335 360 L 310 350 L 300 375 L 290 350 L 265 360 Z" />
            <path d="M 285 270 C 285 235 315 235 315 270" stroke-width="3" />
            <path d="M 270 245 C 300 225 330 245 330 245" stroke-dasharray="2,3" />
            <circle cx="300" cy="315" r="4" fill="{foil}" />
            <line x1="280" y1="325" x2="320" y2="325" />
        </g>
    """,
    "stoic-column": """
        <!-- Classical Roman Stoic Column & Laurel -->
        <g stroke="{foil}" stroke-width="2.3" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="260" y1="270" x2="340" y2="270" stroke-width="4" />
            <line x1="270" y1="280" x2="330" y2="280" stroke-width="3" />
            <line x1="280" y1="280" x2="280" y2="360" stroke-width="2" />
            <line x1="293" y1="280" x2="293" y2="360" stroke-width="2" />
            <line x1="307" y1="280" x2="307" y2="360" stroke-width="2" />
            <line x1="320" y1="280" x2="320" y2="360" stroke-width="2" />
            <line x1="265" y1="360" x2="335" y2="360" stroke-width="3" />
            <line x1="255" y1="370" x2="345" y2="370" stroke-width="4" />
            <circle cx="300" cy="245" r="12" stroke-dasharray="3,3" />
        </g>
    """,
    "st-petersburg-scales": """
        <!-- Scales of Justice & Spire -->
        <g stroke="{foil}" stroke-width="2.3" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="300" y1="250" x2="300" y2="375" stroke-width="3" />
            <line x1="250" y1="275" x2="350" y2="275" stroke-width="3" />
            <path d="M 250 275 L 235 320 L 265 320 Z" />
            <path d="M 350 275 L 335 320 L 365 320 Z" />
            <path d="M 230 320 C 230 335 270 335 270 320 Z" fill="{foil}" fill-opacity="0.3" />
            <path d="M 330 320 C 330 335 370 335 370 320 Z" fill="{foil}" fill-opacity="0.3" />
            <circle cx="300" cy="250" r="4" fill="{foil}" />
            <line x1="275" y1="375" x2="325" y2="375" stroke-width="4" />
        </g>
    """,
    "secret-gate": """
        <!-- Wrought Iron Secret Garden Gate & Key -->
        <g stroke="{foil}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 250 375 L 250 280 C 250 245 300 235 300 235 C 300 235 350 245 350 280 L 350 375" />
            <line x1="300" y1="235" x2="300" y2="375" />
            <path d="M 250 310 C 275 295 325 295 350 310" />
            <circle cx="275" cy="340" r="10" />
            <circle cx="325" cy="340" r="10" />
            <circle cx="300" cy="340" r="4" fill="{foil}" />
            <line x1="235" y1="375" x2="365" y2="375" stroke-width="3" />
        </g>
    """,
    "hot-air-balloon": """
        <!-- Victorian Passenger Balloon -->
        <g stroke="{foil}" stroke-width="2.3" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 300 235 C 245 235 245 295 285 330 L 315 330 C 355 295 355 235 300 235 Z" />
            <line x1="300" y1="235" x2="300" y2="330" />
            <path d="M 270 245 Q 285 280 290 330" />
            <path d="M 330 245 Q 315 280 310 330" />
            <rect x="290" y="345" width="20" height="15" />
            <line x1="288" y1="330" x2="293" y2="345" />
            <line x1="312" y1="330" x2="307" y2="345" />
        </g>
    """,
    "nautilus-submarine": """
        <!-- Vintage Diving Helmet & Nautilus Propeller -->
        <g stroke="{foil}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="300" cy="305" r="45" />
            <circle cx="300" cy="305" r="22" stroke-width="3" />
            <line x1="278" y1="305" x2="322" y2="305" />
            <line x1="300" y1="283" x2="300" y2="327" />
            <path d="M 265 345 C 265 370 335 370 335 345" />
            <circle cx="300" cy="250" r="6" />
        </g>
    """,
    "pirate-schooner": """
        <!-- Three-Masted Galleon & Crossed Cutlasses -->
        <g stroke="{foil}" stroke-width="2.3" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 240 335 C 270 345 330 345 360 335 L 345 355 C 300 365 260 355 240 335 Z" fill="{foil}" fill-opacity="0.25" />
            <line x1="270" y1="335" x2="270" y2="265" stroke-width="2.5" />
            <line x1="300" y1="335" x2="300" y2="250" stroke-width="3" />
            <line x1="330" y1="335" x2="330" y2="270" stroke-width="2.5" />
            <path d="M 270 270 L 290 280 L 270 290 Z" />
            <path d="M 300 255 L 325 270 L 300 285 Z" />
            <path d="M 330 275 L 348 285 L 330 295 Z" />
            <path d="M 225 370 Q 265 360 300 370 T 375 370" />
        </g>
    """,
    "ruritanian-crown": """
        <!-- Ruritanian Royal Crown & Crossed Sabers -->
        <g stroke="{foil}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 255 350 L 260 305 L 280 325 L 300 290 L 320 325 L 340 305 L 345 350 Z" fill="{foil}" fill-opacity="0.2" />
            <line x1="245" y1="350" x2="355" y2="350" stroke-width="4" />
            <circle cx="300" cy="285" r="4" fill="{foil}" />
            <circle cx="260" cy="300" r="3" fill="{foil}" />
            <circle cx="340" cy="300" r="3" fill="{foil}" />
            <circle cx="300" cy="330" r="4" fill="{foil}" />
            <circle cx="280" cy="335" r="3" fill="{foil}" />
            <circle cx="320" cy="335" r="3" fill="{foil}" />
        </g>
    """,
    "victorian-handbag": """
        <!-- Victorian Gladstone Handbag -->
        <g stroke="{foil}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 250 365 L 260 295 L 340 295 L 350 365 Z" fill="{foil}" fill-opacity="0.15" />
            <path d="M 280 295 C 280 265 320 265 320 295" stroke-width="3" />
            <line x1="245" y1="365" x2="355" y2="365" stroke-width="3" />
            <circle cx="300" cy="315" r="5" fill="{foil}" />
            <line x1="300" y1="295" x2="300" y2="365" stroke-dasharray="3,3" />
        </g>
    """,
    "default-ornament": """
        <!-- Classical Library Book & Laurel Emblem -->
        <g stroke="{foil}" stroke-width="2.3" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 245 350 C 275 340 295 345 300 355 C 305 345 325 340 355 350 L 355 285 C 325 275 305 280 300 290 C 295 280 275 275 245 285 Z" fill="{foil}" fill-opacity="0.15" />
            <line x1="300" y1="290" x2="300" y2="355" stroke-width="2.5" />
            <circle cx="300" cy="255" r="6" />
            <circle cx="300" cy="255" r="2" fill="{foil}" />
            <path d="M 270 255 C 270 240 330 240 330 255" stroke-dasharray="2,3" />
        </g>
    """
}

def format_title_lines(title: str, max_chars: int = 18):
    """Splits book title into balanced lines for elegant serif display."""
    clean = re.sub(r";\s*or,.*$", "", title, flags=re.IGNORECASE)
    words = clean.split()
    lines = []
    curr = []
    curr_len = 0
    for w in words:
        if curr_len + len(w) + (1 if curr else 0) <= max_chars:
            curr.append(w)
            curr_len += len(w) + (1 if curr else 0)
        else:
            if curr:
                lines.append(" ".join(curr))
            curr = [w]
            curr_len = len(w)
    if curr:
        lines.append(" ".join(curr))
    return lines[:4] # Max 4 lines


def generate_svg_cover(book: dict) -> str:
    bid = book["id"]
    title = book.get("title", "Untitled")
    author = book.get("author", "Unknown Author")
    year = book.get("publication_year", 1900)
    year_str = f"{abs(year)} BCE" if year < 0 else str(year)
    cats = book.get("categories", ["Classics"])
    primary_cat = cats[0].upper() if cats else "CLASSICS"

    cover_cfg = book.get("cover_config", {})
    palette = cover_cfg.get("palette", {})
    bg_color = palette.get("bg", "#7B8E6D")
    foil_color = palette.get("foil", "#F7F3EB")
    text_color = palette.get("text", "#FFFFFF")
    motif_key = cover_cfg.get("motif", "default-ornament")

    # Match motif SVG or fallback
    motif_svg_template = MOTIF_SVGS.get(motif_key, MOTIF_SVGS["default-ornament"])
    motif_svg = motif_svg_template.replace("{foil}", foil_color)

    title_lines = format_title_lines(title)
    
    # Calculate title Y start
    title_font_size = 32 if len(title_lines) <= 2 else (28 if len(title_lines) == 3 else 24)
    line_height = title_font_size * 1.3
    start_y = 510 - ((len(title_lines) - 1) * line_height / 2)

    title_spans = []
    for i, line in enumerate(title_lines):
        y_pos = start_y + (i * line_height)
        title_spans.append(f'<text x="300" y="{y_pos:.1f}" text-anchor="middle" fill="{foil_color}" font-family="Newsreader, Georgia, serif" font-size="{title_font_size}" font-weight="600" letter-spacing="-0.01em">{html.escape(line)}</text>')

    title_svg_block = "\n        ".join(title_spans)

    author_clean = re.sub(r"\s+", " ", author).strip()

    svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" width="100%" height="100%">
    <defs>
        <!-- Subtle paper & cloth grain textures -->
        <linearGradient id="clothSheen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.12" />
            <stop offset="40%" stop-color="#FFFFFF" stop-opacity="0.0" />
            <stop offset="100%" stop-color="#000000" stop-opacity="0.15" />
        </linearGradient>
        <radialGradient id="centerGlow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.08" />
            <stop offset="100%" stop-color="#000000" stop-opacity="0.12" />
        </radialGradient>
        <filter id="subtleShadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.25" />
        </filter>
    </defs>

    <!-- Base Book Cloth Background -->
    <rect width="600" height="900" fill="{bg_color}" />
    <rect width="600" height="900" fill="url(#centerGlow)" />
    <rect width="600" height="900" fill="url(#clothSheen)" />

    <!-- Spine Crease Shadow (Left Edge) -->
    <rect x="0" y="0" width="18" height="900" fill="#000000" fill-opacity="0.14" />
    <line x1="18" y1="0" x2="18" y2="900" stroke="{foil_color}" stroke-opacity="0.15" stroke-width="1" />

    <!-- Outer Inset Gilded / Cream Foil Frame -->
    <rect x="36" y="36" width="528" height="828" fill="none" stroke="{foil_color}" stroke-width="2" stroke-opacity="0.85" rx="4" />
    <rect x="44" y="44" width="512" height="812" fill="none" stroke="{foil_color}" stroke-width="1" stroke-opacity="0.45" stroke-dasharray="4,4" />

    <!-- Corner Filigree Accents -->
    <path d="M 44 64 L 64 44 M 44 74 L 74 44" stroke="{foil_color}" stroke-width="1.5" stroke-opacity="0.7" />
    <path d="M 556 64 L 536 44 M 556 74 L 526 44" stroke="{foil_color}" stroke-width="1.5" stroke-opacity="0.7" />
    <path d="M 44 836 L 64 856 M 44 826 L 74 856" stroke="{foil_color}" stroke-width="1.5" stroke-opacity="0.7" />
    <path d="M 556 836 L 536 856 M 556 826 L 526 856" stroke="{foil_color}" stroke-width="1.5" stroke-opacity="0.7" />

    <!-- Header Category Tag -->
    <text x="300" y="115" text-anchor="middle" fill="{foil_color}" fill-opacity="0.9" font-family="Inter, -apple-system, sans-serif" font-size="12" font-weight="600" letter-spacing="0.25em">{html.escape(primary_cat)}</text>
    <line x1="220" y1="135" x2="380" y2="135" stroke="{foil_color}" stroke-opacity="0.4" stroke-width="1" />
    <circle cx="300" cy="135" r="2.5" fill="{foil_color}" fill-opacity="0.8" />

    <!-- Central Bespoke Vector Literary Motif -->
    <g transform="translate(0, 0)">
        {motif_svg}
    </g>

    <!-- Book Title -->
    <g id="coverTitle">
        {title_svg_block}
    </g>

    <!-- Elegant Hairline Rule -->
    <line x1="250" y1="675" x2="350" y2="675" stroke="{foil_color}" stroke-opacity="0.65" stroke-width="1.5" />
    <circle cx="300" cy="675" r="3" fill="{foil_color}" fill-opacity="0.85" />

    <!-- Author Name -->
    <text x="300" y="725" text-anchor="middle" fill="{foil_color}" font-family="Newsreader, Georgia, serif" font-size="20" font-style="italic" font-weight="400" letter-spacing="0.03em">{html.escape(author_clean)}</text>

    <!-- Footer: Year & Nook Classic Edition -->
    <line x1="200" y1="785" x2="400" y2="785" stroke="{foil_color}" stroke-opacity="0.3" stroke-width="1" />
    <text x="300" y="815" text-anchor="middle" fill="{foil_color}" fill-opacity="0.8" font-family="Inter, -apple-system, sans-serif" font-size="11" font-weight="500" letter-spacing="0.18em">NOOK EDITION · {html.escape(year_str)}</text>
</svg>"""

    return svg_content


def main():
    print(f"Generating 105 bespoke SVG covers...")
    generated_count = 0
    for b in books:
        bid = b["id"]
        svg_code = generate_svg_cover(b)
        
        fe_path = FRONTEND_COVERS_DIR / f"{bid}.svg"
        root_path = ROOT_COVERS_DIR / f"{bid}.svg"

        with open(fe_path, "w", encoding="utf-8") as f:
            f.write(svg_code)
        with open(root_path, "w", encoding="utf-8") as f:
            f.write(svg_code)

        generated_count += 1

    print(f"Successfully generated {generated_count}/105 SVG covers in:")
    print(f" - {FRONTEND_COVERS_DIR}")
    print(f" - {ROOT_COVERS_DIR}")


if __name__ == "__main__":
    main()
