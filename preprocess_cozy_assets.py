import os
import sys
import argparse
from pathlib import Path
from typing import List, Tuple

import numpy as np
from PIL import Image
from scipy import ndimage


# Chroma-key parameters for the Stitch asset sheets. The background is a solid
# bright green (#00FF00), but JPEG/PNG compression and anti-aliasing create a
# yellow-green fringe around objects. These parameters control the chromacut-
# style keyer that removes the green while preserving the sprite edges.
CHROMA_TOLERANCE = 35   # Green-excess value above which a pixel is fully transparent.
CHROMA_SOFTNESS = 15    # Green-excess value below which a pixel is fully opaque.
CHROMA_DILATE = 1       # Expand the transparent mask by N pixels to eat fringes.

# Minimum sticker size (width/height in pixels). Anything smaller is treated
# as compression/edge noise.
MIN_STICKER_WIDTH = 40
MIN_STICKER_HEIGHT = 40
MIN_STICKER_AREA = 2000

# Padding added around extracted stickers so they are not cropped hair-tight.
STICKER_PADDING = 10

# When looking for the white divider line in a split-view room image, only
# search within the middle 40-60% of the image width.
DIVIDER_SEARCH_MARGIN = 0.4

# Large layout/example scenes are filtered out by relative size.
MAX_STICKER_AREA_RATIO = 0.15
MAX_STICKER_WIDTH_RATIO = 0.5
MAX_STICKER_HEIGHT_RATIO = 0.5


def remove_green_background(
    image: Image.Image,
    tolerance: int = CHROMA_TOLERANCE,
    softness: int = CHROMA_SOFTNESS,
    dilate: int = CHROMA_DILATE,
) -> Image.Image:
    """
    Convert an image to RGBA and make the green-screen background transparent.

    Uses a chromacut-style algorithm that protects darker foreground greens
    (plants, green fabrics) while cleanly removing the bright lime-green screen
    and its anti-aliased fringe:
      1. Compute green excess: G - max(R, B).
      2. Treat only bright green pixels (green excess + high green channel) as
         background.
      3. Build a smooth alpha ramp for those background pixels.
      4. Dilate the transparent region to eat yellow-green fringes.
      5. Despill partially-transparent edge pixels.
      6. Preserve bright white outlines/borders added by the exporter.

    Args:
        image: Input image (any mode).
        tolerance: Green-excess value above which a bright-green pixel is fully
            transparent.
        softness: Green-excess value below which a bright-green pixel is fully
            opaque.
        dilate: Number of pixels to expand the transparent mask into fringes.

    Returns:
        RGBA PIL Image with the green background made transparent.
    """
    rgb = image.convert("RGB")
    arr = np.array(rgb, dtype=np.float32)

    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    green_excess = g - np.maximum(r, b)

    # Only bright lime-green pixels are treated as background. Darker greens
    # (leaves, green fabrics) stay opaque.
    is_bright_green_screen = (green_excess > softness) & (g > 180)

    denom = max(tolerance - softness, 1e-6)
    alpha = np.ones_like(green_excess)
    alpha[is_bright_green_screen] = 1.0 - np.clip(
        (green_excess[is_bright_green_screen] - softness) / denom, 0.0, 1.0
    )

    # Expand the transparent mask into the fringe so anti-aliased green edges
    # become transparent instead of leaving a green halo.
    if dilate > 0:
        transparent = alpha < 0.5
        expanded = ndimage.binary_dilation(transparent, iterations=dilate)
        new_fringe = expanded & (alpha >= 0.5)
        alpha[new_fringe] = 0.0

    # Edge-only despill: only touch pixels that are partially transparent.
    is_edge = (alpha > 1e-3) & (alpha < 1.0 - 1e-3) & (green_excess > 0)
    g_despilled = np.where(is_edge, np.maximum(r, b), g)

    # Preserve bright white borders/outlines added by the exporter.
    brightness = (r + g + b) / 3.0
    balance = np.std(arr, axis=2)
    is_white_outline = (brightness > 240) & (balance < 15)
    g_despilled = np.where(is_white_outline, g, g_despilled)

    rgba = np.zeros((arr.shape[0], arr.shape[1], 4), dtype=np.uint8)
    rgba[:, :, 0] = r.astype(np.uint8)
    rgba[:, :, 1] = g_despilled.astype(np.uint8)
    rgba[:, :, 2] = b.astype(np.uint8)
    rgba[:, :, 3] = (alpha * 255).astype(np.uint8)

    return Image.fromarray(rgba, mode="RGBA")


def find_vertical_divider(image: Image.Image) -> int:
    """Locate the white vertical divider in a room split-view asset sheet."""
    rgb = np.array(image.convert("RGB"))
    height, width = rgb.shape[:2]

    white_mask = (
        (rgb[:, :, 0] > 240)
        & (rgb[:, :, 1] > 240)
        & (rgb[:, :, 2] > 240)
    )
    col_counts = white_mask.sum(axis=0)

    left = int(width * DIVIDER_SEARCH_MARGIN)
    right = int(width * (1 - DIVIDER_SEARCH_MARGIN))
    divider = left + int(np.argmax(col_counts[left:right]))

    return divider


def trim_transparent(image: Image.Image) -> Image.Image:
    """Crop away fully-transparent borders from an RGBA image."""
    bbox = image.getbbox()
    if bbox is None:
        return image
    return image.crop(bbox)


def extract_stickers_from_sheet(
    image_path: Path,
    tolerance: int,
    softness: int,
    dilate: int,
) -> List[Tuple[int, int, Image.Image]]:
    """
    Extract individual stickers from one sticker sheet.

    Returns a list of (y, x, sticker_image) tuples, where y and x are the
    original top-left coordinates used for sorting.
    """
    image = Image.open(image_path)
    rgba = remove_green_background(image, tolerance, softness, dilate)
    arr = np.array(rgba)
    alpha = arr[:, :, 3]

    labeled, _ = ndimage.label(alpha > 128)
    slices = ndimage.find_objects(labeled)

    image_area = rgba.width * rgba.height
    stickers = []
    for label_id, slc in enumerate(slices, start=1):
        if slc is None:
            continue

        y_slice, x_slice = slc
        y1, y2 = y_slice.start, y_slice.stop
        x1, x2 = x_slice.start, x_slice.stop

        width = x2 - x1
        height = y2 - y1
        area = (labeled[y1:y2, x1:x2] == label_id).sum()

        if width < MIN_STICKER_WIDTH or height < MIN_STICKER_HEIGHT or area < MIN_STICKER_AREA:
            continue

        # Skip large example scenes/layouts.
        if (
            area > MAX_STICKER_AREA_RATIO * image_area
            or width > MAX_STICKER_WIDTH_RATIO * rgba.width
            or height > MAX_STICKER_HEIGHT_RATIO * rgba.height
        ):
            continue

        crop = rgba.crop((x1, y1, x2, y2))
        crop_arr = np.array(crop)
        label_crop = labeled[y1:y2, x1:x2]
        crop_arr[:, :, 3] = np.where(label_crop == label_id, crop_arr[:, :, 3], 0)
        crop = Image.fromarray(crop_arr, mode="RGBA")

        padded_size = (width + 2 * STICKER_PADDING, height + 2 * STICKER_PADDING)
        padded = Image.new("RGBA", padded_size, (0, 0, 0, 0))
        padded.paste(crop, (STICKER_PADDING, STICKER_PADDING), crop)

        stickers.append((y1, x1, padded))

    return stickers


def process_room_split(image_path: Path, output_dir: Path) -> None:
    """Split a room asset sheet into room_full.png and room_bare.png."""
    print(f"Processing room: {image_path}")
    image = Image.open(image_path)

    divider = find_vertical_divider(image)
    print(f"  Divider found at x={divider}")

    rgba = remove_green_background(image)
    left_half = rgba.crop((0, 0, divider, rgba.height))
    right_half = rgba.crop((divider, 0, rgba.width, rgba.height))

    room_full = trim_transparent(left_half)
    room_bare = trim_transparent(right_half)

    output_dir.mkdir(parents=True, exist_ok=True)
    room_full.save(output_dir / "room_full.png")
    room_bare.save(output_dir / "room_bare.png")

    print(f"  Saved room_full.png ({room_full.width}x{room_full.height})")
    print(f"  Saved room_bare.png ({room_bare.width}x{room_bare.height})")


def process_level(
    raw_level_dir: Path,
    output_level_dir: Path,
    tolerance: int,
    softness: int,
    dilate: int,
) -> None:
    """
    Process one level directory: room split view + all sticker sheets.
    Stickers from all sheets are flattened into a single stickers/ folder and
    numbered in reading order.
    """
    print(f"\n=== Processing {raw_level_dir.name} ===")

    # Room split view.
    raw_room_dir = raw_level_dir / "room"
    if raw_room_dir.exists():
        room_images = sorted(
            p for p in raw_room_dir.iterdir()
            if p.suffix.lower() in (".png", ".jpg", ".jpeg")
        )
        if room_images:
            process_room_split(room_images[0], output_level_dir / "room")
        else:
            print(f"  Warning: no room image found in {raw_room_dir}")

    # Sticker sheets: flatten all sheets into one stickers/ folder.
    raw_stickers_dir = raw_level_dir / "stickers"
    if not raw_stickers_dir.exists():
        return

    all_stickers: List[Tuple[int, int, Image.Image]] = []
    for sheet_path in sorted(raw_stickers_dir.iterdir()):
        if sheet_path.suffix.lower() not in (".png", ".jpg", ".jpeg"):
            continue

        print(f"Processing sticker sheet: {sheet_path}")
        stickers = extract_stickers_from_sheet(sheet_path, tolerance, softness, dilate)
        print(f"  Extracted {len(stickers)} stickers")
        all_stickers.extend(stickers)

    # Sort all stickers from all sheets in reading order (top-to-bottom,
    # left-to-right), grouped in rough 100px bands so rows stay together.
    all_stickers.sort(key=lambda s: (s[0] // 100, s[1]))

    output_stickers_dir = output_level_dir / "stickers"
    output_stickers_dir.mkdir(parents=True, exist_ok=True)

    for idx, (_, _, sticker) in enumerate(all_stickers, start=1):
        sticker.save(output_stickers_dir / f"sticker_{idx:03d}.png")

    print(f"  Saved {len(all_stickers)} stickers to {output_stickers_dir}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Remove green-screen backgrounds from CozyRoomAssetPack "
                    "raw assets and organize them into a preprocessed level structure."
    )
    parser.add_argument(
        "--raw-dir",
        type=Path,
        default=Path("CozyRoomAssetPack/stitch_cozy_room_asset_pack/raw"),
        help="Directory containing the raw level folders.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("CozyRoomAssetPack/stitch_cozy_room_asset_pack/preprocesed"),
        help="Directory where the preprocessed level structure will be written.",
    )
    parser.add_argument(
        "--tolerance",
        type=int,
        default=CHROMA_TOLERANCE,
        help="Green-excess value above which a bright-green pixel becomes fully transparent.",
    )
    parser.add_argument(
        "--softness",
        type=int,
        default=CHROMA_SOFTNESS,
        help="Green-excess value below which a bright-green pixel stays fully opaque.",
    )
    parser.add_argument(
        "--dilate",
        type=int,
        default=CHROMA_DILATE,
        help="Pixels to expand the transparent mask into green fringes.",
    )
    args = parser.parse_args()

    if not args.raw_dir.exists():
        print(f"Error: raw directory not found: {args.raw_dir}", file=sys.stderr)
        return 1

    args.output_dir.mkdir(parents=True, exist_ok=True)

    for level_dir in sorted(args.raw_dir.iterdir()):
        if not level_dir.is_dir():
            continue
        process_level(
            level_dir,
            args.output_dir / level_dir.name,
            args.tolerance,
            args.softness,
            args.dilate,
        )

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
