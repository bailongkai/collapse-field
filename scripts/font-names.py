"""Renames the subset display fonts so they may be distributed.

Both faces the interface uses are SIL OFL fonts with Reserved Font Names: "Smiley" and "得意黑" for
Smiley Sans, "Orbitron" for Orbitron. Clause 3 of the OFL says a Modified Version may not use a
Reserved Font Name, and a subset is a Modified Version. So after subsetting, each file is given a
name of its own before it ships. The copyright notice is kept as it is, and the licence fields
(name IDs 13 and 14) say what the licence is; the full text ships next to the fonts in
public/assets/fonts.

Run after any re-subset:

    python3 scripts/font-names.py

It is idempotent: it rewrites the names every time from the table below.
"""

from fontTools.ttLib import TTFont

FONTS = {
    # file: (family, subfamily, source it was cut from)
    "public/assets/fonts/CFHeading-subset.ttf": ("CF Heading", "Oblique", "Smiley Sans 2.0.1"),
    "public/assets/fonts/CFDisplay-subset.ttf": ("CF Display", "Regular", "Orbitron 2.001"),
}
# every name record but the copyright notice is scrubbed of these, including a variable font's
# named instances (IDs 256 and up), which carry postscript names like "Orbitron-Bold"
RESERVED = ("Smiley Sans", "Smiley", "得意黑", "Orbitron")
LICENSE = "This Font Software is licensed under the SIL Open Font License, Version 1.1."
LICENSE_URL = "https://openfontlicense.org"

# the names that present the font: family, subfamily, unique id, full name, postscript name,
# typographic family and subfamily, WWS family and subfamily
RENAMED = (1, 2, 3, 4, 6, 16, 17, 21, 22)


def rename(path: str, family: str, sub: str, source: str) -> None:
    font = TTFont(path)
    table = font["name"]
    full = f"{family} {sub}"
    postscript = f"{family.replace(' ', '')}-{sub}"
    values = {
        1: family,
        2: sub,
        3: f"{postscript};{source.split(' ')[-1]}",
        4: full,
        6: postscript,
        16: family,
        17: sub,
        21: family,
        22: sub,
        13: LICENSE,
        14: LICENSE_URL,
    }
    table.names = [r for r in table.names if r.nameID not in RENAMED + (13, 14)]
    for name_id, value in values.items():
        table.setName(value, name_id, 3, 1, 0x409)
        table.setName(value, name_id, 1, 0, 0)
    token = family.replace(" ", "")
    for record in table.names:
        if record.nameID == 0:
            continue
        text = record.toUnicode()
        for reserved in RESERVED:
            text = text.replace(reserved, token)
        record.string = text
    font.save(path)
    print(f"{path}: {full}")


if __name__ == "__main__":
    for path, (family, sub, source) in FONTS.items():
        rename(path, family, sub, source)
