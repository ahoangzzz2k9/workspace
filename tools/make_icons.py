from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
base = Image.open(root / "tools" / "icon-512-base.png").convert("RGB")
maskable = Image.open(root / "tools" / "icon-maskable-base.png").convert("RGB")
out = root / "public" / "icons"
out.mkdir(parents=True, exist_ok=True)

targets = {
    "icon-512.png": 512,
    "icon-192.png": 192,
    "apple-touch-icon-180.png": 180,
    "favicon-32.png": 32,
}
for name, size in targets.items():
    image = base.resize((size, size), Image.LANCZOS)
    image.save(out / name, optimize=True)

maskable.resize((512, 512), Image.LANCZOS).save(out / "icon-maskable-512.png", optimize=True)
print("created", ", ".join(sorted(p.name for p in out.glob("*.png"))))
