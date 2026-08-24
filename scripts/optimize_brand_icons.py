from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    ROOT / "assets/images/icon.png",
    ROOT / "assets/images/splash-icon.png",
    ROOT / "assets/images/favicon.png",
    ROOT / "assets/images/android-icon-foreground.png",
]

for path in FILES:
    image = Image.open(path).convert("RGBA")
    image.thumbnail((768, 768), Image.Resampling.LANCZOS)
    alpha = image.getchannel("A")
    rgb = Image.new("RGB", image.size, (255, 255, 255))
    rgb.paste(image, mask=alpha)
    palette = rgb.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    palette.save(path, optimize=True, compress_level=9)
    print(f"{path.name}: {path.stat().st_size} bytes, {image.width}x{image.height}")
