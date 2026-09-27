"""Cuts the two display fonts down to the characters the game uses, then renames them.

The full Smiley Sans is several megabytes of CJK the game never draws, so it ships as a subset.
The subset has to be cut again whenever strings are added: the last one was cut before later
content and missed 147 characters, among them all three of the game's own title, 塌缩带, which then
fell back to a system face in the one place the heading font matters most. The unit test
`tests/unit/fonts.test.ts` fails when a string uses a character the subset lacks.

    python3 scripts/subset-fonts.py

The sources are the upstream releases, fetched into .cache/fonts (not committed):
  Smiley Sans 2.0.1  https://github.com/atelier-anchor/smiley-sans/releases/tag/v2.0.1
  Orbitron           https://github.com/google/fonts/tree/main/ofl/orbitron
"""

import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "fonts"
OUT = ROOT / "public" / "assets" / "fonts"

SOURCES = {
    "smiley": (
        "https://github.com/atelier-anchor/smiley-sans/releases/download/v2.0.1/smiley-sans-v2.0.1.zip",
        "SmileySans-Oblique.ttf",
    ),
    "orbitron": ("https://raw.githubusercontent.com/google/fonts/main/ofl/orbitron/Orbitron%5Bwght%5D.ttf", None),
}


def fetch() -> dict:
    CACHE.mkdir(parents=True, exist_ok=True)
    smiley = CACHE / "smiley" / "SmileySans-Oblique.ttf"
    if not smiley.exists():
        archive = CACHE / "smiley.zip"
        urllib.request.urlretrieve(SOURCES["smiley"][0], archive)
        with zipfile.ZipFile(archive) as z:
            z.extract(SOURCES["smiley"][1], CACHE / "smiley")
    orbitron = CACHE / "orbitron.ttf"
    if not orbitron.exists():
        urllib.request.urlretrieve(SOURCES["orbitron"][0], orbitron)
    return {"smiley": smiley, "orbitron": orbitron}


def characters() -> str:
    """Every character in src/, which covers both string tables and anything hard-coded."""
    chars = {chr(c) for c in range(0x20, 0x7F)}
    for path in (ROOT / "src").rglob("*.ts"):
        chars.update(path.read_text(encoding="utf-8"))
    return "".join(sorted(c for c in chars if c.isprintable() or c == " "))


def cut(source: Path, target: Path, text: str) -> None:
    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    font = subset.load_font(str(source), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    subset.save_font(font, str(target), options)
    print(f"{target.relative_to(ROOT)}: {target.stat().st_size // 1024} KB")


if __name__ == "__main__":
    src = fetch()
    text = characters()
    cut(src["smiley"], OUT / "CFHeading-subset.ttf", text)
    cut(src["orbitron"], OUT / "CFDisplay-subset.ttf", text)
    subprocess.run([sys.executable, str(ROOT / "scripts" / "font-names.py")], cwd=ROOT, check=True)
