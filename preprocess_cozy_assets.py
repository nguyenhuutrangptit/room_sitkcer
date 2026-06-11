import os
import sys
import argparse
from pathlib import Path
from typing import List, Tuple

import numpy as np
from PIL import Image
from scipy import ndimage


# Chroma key green used by the Stitch asset sheets.
GREEN_SCREEN = np.array([0, 255, 0], dtype=np.float32)

# Tolerance for deciding whether a pixel is part of the green screen.
# The exported sheets use a solid #00FF00, but JPEG compression can shift
# edge pixels, so a small tolerance is necessary.
GREEN_TOLERANCE = 30

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


def remove_green_background(image: Image.Image, tolerance: int = GREEN_TOLERANCE) -> Image.Image:
    """
    Convert an image to RGBA and make the green-screen background transparent.

    The chroma key used by the Stitch asset sheets is pure green (#00FF00).
    JPEG compression and anti-aliasing leave a yellow-green fringe around
    objects, so this function combines a Euclidean distance check with a
    green-dominance check to catch those edge pixels without removing actual
    green objects (e.g. plants) from the foreground.

    Args:
        image: Input image (any mode).
        tolerance: Euclidean distance from pure green (#00FF00) below which
            a pixel is considered background.

    Returns:
        RGBA PIL Image with the green background made transparent.
    """
    rgb = image.convert("RGB")
    arr = np.array(rgb, dtype=np.float32)

    # Euclidean distance from the pure green screen color.
    dist = np.linalg.norm(arr - GREEN_SCREEN, axis=2)
    close_to_green = dist < tolerance

    # Green-dominant pixels catch the yellow-green anti-aliased fringe that
    # remains after the distance check. The thresholds are chosen to be
    # aggressive on bright lime/yellow-greens while preserving darker
    # foreground greens such as plants and green fabrics.
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    green_dominant = (g > r + 20) & (g > b + 20) & (g > 100)

    background = close_to_green | green_dominant
    foreground = ~background

    rgba = np.zeros((arr.shape[0], arr.shape[1], 4), dtype=np.uint8)
    rgba[:, :, :3] = rgb
    rgba[:, :, 3] = (foreground * 255).astype(np.uint8)

    return Image.fromarray(rgba, mode="RGBA")


def find_vertical_divider(image: Image.Image) -> int:
    """
    Locate the thin white vertical line that separates the full and bare room
    halves in a split-view asset sheet.

    Args:
        image: Input room image.

    Returns:
        X coordinate of the divider line.
    """
    rgb = np.array(image.convert("RGB"))
    height, width = rgb.shape[:2]

    # White-ish pixels (the divider line).
    white_mask = (
        (rgb[:, :, 0] > 240)
        & (rgb[:, :, 1] > 240)
        & (rgb[:, :, 2] > 240)
    )

    # Count white pixels per column.
    col_counts = white_mask.sum(axis=0)

    # Restrict search to the middle of the image.
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


def process_room_split(image_path: Path, output_dir: Path) -> None:
    """
    Split a room asset sheet into `room_full.png` (left) and `room_bare.png`
    (right) with the green background removed.
    """
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

    room_full_path = output_dir / "room_full.png"
    room_bare_path = output_dir / "room_bare.png"

    room_full.save(room_full_path)
    room_bare.save(room_bare_path)

    print(f"  Saved {room_full_path} ({room_full.width}x{room_full.height})")
    print(f"  Saved {room_bare_path} ({room_bare.width}x{room_bare.height})")


def extract_stickers(image: Image.Image) -> List[Tuple[int, int, Image.Image]]:
    """
    Extract individual stickers from a background-removed sticker sheet.

    Returns:
        List of (y, x, sticker_image) tuples, sorted top-to-bottom,
        left-to-right.
    """
    rgba = remove_green_background(image)
    arr = np.array(rgba)
    alpha = arr[:, :, 3]

    # Connected components of non-transparent pixels.
    labeled, num_features = ndimage.label(alpha > 128)
    slices = ndimage.find_objects(labeled)

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

        # Crop the region and zero out pixels that belong to other components.
        crop = rgba.crop((x1, y1, x2, y2))
        crop_arr = np.array(crop)
        label_crop = labeled[y1:y2, x1:x2]
        crop_arr[:, :, 3] = np.where(label_crop == label_id, crop_arr[:, :, 3], 0)
        crop = Image.fromarray(crop_arr, mode="RGBA")

        # Add transparent padding.
        padded_size = (width + 2 * STICKER_PADDING, height + 2 * STICKER_PADDING)
        padded = Image.new("RGBA", padded_size, (0, 0, 0, 0))
        padded.paste(crop, (STICKER_PADDING, STICKER_PADDING), crop)

        stickers.append((y1, x1, padded))

    # Sort top-to-bottom, left-to-right. Group rows in bands of 100px so that
    # items in the same rough row stay together even if they are not perfectly
    # aligned.
    stickers.sort(key=lambda s: (s[0] // 100, s[1]))

    return stickers


def process_sticker_sheet(image_path: Path, output_dir: Path) -> None:
    """
    Extract individual stickers from a sticker asset sheet and save them as
    numbered PNGs with transparent backgrounds.
    """
    print(f"Processing sticker sheet: {image_path}")
    image = Image.open(image_path)

    stickers = extract_stickers(image)
    print(f"  Extracted {len(stickers)} stickers")

    output_dir.mkdir(parents=True, exist_ok=True)

    for idx, (_, _, sticker) in enumerate(stickers, start=1):
        output_path = output_dir / f"sticker_{idx:03d}.png"
        sticker.save(output_path)


def process_level(raw_level_dir: Path, output_level_dir: Path) -> None:
    """
    Process one level directory: room split view + all sticker sheets.
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

    # Sticker sheets.
    raw_stickers_dir = raw_level_dir / "stickers"
    if raw_stickers_dir.exists():
        output_stickers_dir = output_level_dir / "stickers"
        for sheet_path in sorted(raw_stickers_dir.iterdir()):
            if sheet_path.suffix.lower() not in (".png", ".jpg", ".jpeg"):
                continue

            # Each input sheet gets its own subfolder so multiple sheets in
            # the same level do not overwrite each other.
            sheet_output_dir = output_stickers_dir / sheet_path.stem
            process_sticker_sheet(sheet_path, sheet_output_dir)


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
    args = parser.parse_args()

    if not args.raw_dir.exists():
        print(f"Error: raw directory not found: {args.raw_dir}", file=sys.stderr)
        return 1

    args.output_dir.mkdir(parents=True, exist_ok=True)

    for level_dir in sorted(args.raw_dir.iterdir()):
        if not level_dir.is_dir():
            continue
        process_level(level_dir, args.output_dir / level_dir.name)

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
