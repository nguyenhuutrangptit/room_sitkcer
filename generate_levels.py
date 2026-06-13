import argparse
import json
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def load_image_rgba(path: Path) -> np.ndarray:
    """Load an image as a uint8 RGBA array."""
    img = Image.open(path)
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    return np.array(img, dtype=np.uint8)


def align_images(full: np.ndarray, bare: np.ndarray) -> tuple:
    """Crop both images to the same width/height so they can be diffed."""
    min_h = min(full.shape[0], bare.shape[0])
    min_w = min(full.shape[1], bare.shape[1])
    return full[:min_h, :min_w], bare[:min_h, :min_w]


def find_sticker_position(
    sticker: np.ndarray,
    room_full: np.ndarray,
    room_bare: np.ndarray,
) -> tuple:
    """
    Find the best position for a sticker in the room.

    The sticker is matched against the difference image (room_full - room_bare)
    using alpha-weighted normalized cross-correlation. This mirrors the web
    game's auto-calibration engine but runs in real time with OpenCV.

    Returns (norm_x, norm_y, scale, confidence) where positions are normalized
    to [0, 1] relative to the room image.
    """
    room_full, room_bare = align_images(room_full, room_bare)

    # RGB channels and alpha.
    full_rgb = room_full[:, :, :3]
    bare_rgb = room_bare[:, :, :3]
    sticker_rgb = sticker[:, :, :3]
    alpha = sticker[:, :, 3].astype(np.float32) / 255.0

    # Difference image: where stickers were added.
    diff = cv2.absdiff(full_rgb, bare_rgb)
    diff_gray = cv2.cvtColor(diff, cv2.COLOR_RGB2GRAY).astype(np.float32)

    # Sticker template: weighted by alpha so transparent background pixels
    # don't contribute to the match.
    sticker_gray = cv2.cvtColor(sticker_rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    template = sticker_gray * alpha

    # Use correlation coefficient so brightness differences don't dominate.
    result = cv2.matchTemplate(diff_gray, template, cv2.TM_CCOEFF_NORMED)
    _, max_val, _, max_loc = cv2.minMaxLoc(result)

    h, w = sticker.shape[:2]
    x, y = max_loc
    norm_x = (x + w / 2) / room_full.shape[1]
    norm_y = (y + h / 2) / room_full.shape[0]

    return norm_x, norm_y, 1.0, float(max_val)


def generate_level(level_dir: Path, output_dir: Path) -> dict:
    """
    Generate a levelData JSON file for one level.

    The level directory is expected to contain:
      - room/room_full.png
      - room/room_bare.png
      - stickers/sticker_*.png
    """
    room_full = load_image_rgba(level_dir / "room" / "room_full.png")
    room_bare = load_image_rgba(level_dir / "room" / "room_bare.png")
    room_full, room_bare = align_images(room_full, room_bare)

    # Save aligned room images so the app uses consistent dimensions.
    Image.fromarray(room_full, "RGBA").save(level_dir / "room" / "room_full.png")
    Image.fromarray(room_bare, "RGBA").save(level_dir / "room" / "room_bare.png")

    stickers_dir = level_dir / "stickers"
    sticker_paths = sorted(stickers_dir.glob("sticker_*.png"))

    items = []
    for sticker_path in sticker_paths:
        sticker = load_image_rgba(sticker_path)
        norm_x, norm_y, scale, confidence = find_sticker_position(
            sticker, room_full, room_bare
        )

        # Filter out stickers that don't actually appear in the room.
        if confidence < 0.5:
            print(f"  Skipping {sticker_path.name}: low confidence ({confidence:.2f})")
            continue

        rel_path = str(
            Path("assets/levels") / level_dir.name / "stickers" / sticker_path.name
        )

        items.append({
            "id": sticker_path.stem,
            "uri": rel_path,
            "normX": round(float(norm_x), 4),
            "normY": round(float(norm_y), 4),
            "scale": scale,
            "rotation": 0,
            "rotation3D": 0,
            "layer": 1,
        })

    level_data = {
        "room": level_dir.name,
        "bgImage": str(Path("assets/levels") / level_dir.name / "room" / "room_bare.png"),
        "bgSize": {
            "width": int(room_bare.shape[1]),
            "height": int(room_bare.shape[0]),
        },
        "items": items,
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{level_dir.name}.json"
    with open(output_path, "w") as f:
        json.dump(level_data, f, indent=2)

    print(f"Generated {output_path} with {len(items)} items")
    return level_data


def generate_typescript_index(output_dir: Path) -> None:
    """
    Generate src/constants/levels.ts with static imports for all bundled
    levels, their room images, and their sticker images so Expo can resolve
    them at build time.

    Only stickers that are referenced by a level's JSON data are imported,
    keeping the generated file and the app bundle lean.
    """
    src_dir = Path("room-sticker-game/src/constants")
    src_dir.mkdir(parents=True, exist_ok=True)

    level_dirs = sorted(output_dir.iterdir())
    level_names = [d.name for d in level_dirs if d.is_dir()]

    lines = []
    lines.append("// Auto-generated by generate_levels.py. Do not edit manually.")
    lines.append("")

    # Import level JSON files.
    for name in level_names:
        lines.append(f"import {name}Data from '../../assets/levels/{name}.json';")

    lines.append("")

    # Import room images.
    for name in level_names:
        lines.append(f"import {name}Room from '../../assets/levels/{name}/room/room_bare.png';")

    lines.append("")

    sticker_imports = []
    sticker_maps = {}
    for name in level_names:
        level_json_path = output_dir / f"{name}.json"
        with open(level_json_path) as f:
            level_data = json.load(f)
        # Import every sticker in the directory so Admin Mode can show the full
        # sticker tray even for stickers not auto-placed by the generator.
        sticker_paths = sorted((output_dir / name / "stickers").glob("sticker_*.png"))

        entries = []
        for sticker_path in sticker_paths:
            sticker_id = sticker_path.stem
            # Convert sticker_001 to a valid JS identifier suffix (sticker001).
            safe_stem = sticker_id.replace('_', '')
            var_name = f"{name}Sticker{safe_stem}"
            sticker_imports.append(
                f"import {var_name} from '../../assets/levels/{name}/stickers/{sticker_path.name}';"
            )
            entries.append(f"    '{sticker_id}': {var_name}")
        sticker_maps[name] = ",\n".join(entries)

    lines.extend(sticker_imports)
    lines.append("")

    # Level type and exports.
    lines.append("export type LevelId = '" + "' | '".join(level_names) + "';")
    lines.append("")
    lines.append("export type Level = {")
    lines.append("  id: LevelId;")
    lines.append("  name: string;")
    lines.append("  data: any;")
    lines.append("  roomImage: any;")
    lines.append("  stickerImages: Record<string, any>;")
    lines.append("};")
    lines.append("")
    lines.append("export const LEVELS: Level[] = [")
    for name in level_names:
        lines.append("  {")
        lines.append(f"    id: '{name}',")
        lines.append(f"    name: '{name.replace('level', 'Level ')}',")
        lines.append(f"    data: {name}Data,")
        lines.append(f"    roomImage: {name}Room,")
        lines.append(f"    stickerImages: {{")
        lines.append(sticker_maps[name] + ",")
        lines.append("    },")
        lines.append("  },")
    lines.append("];")
    lines.append("")
    lines.append("export function getLevelById(id: LevelId): Level | undefined {")
    lines.append("  return LEVELS.find(level => level.id === id);")
    lines.append("}")
    lines.append("")

    with open(src_dir / "levels.ts", "w") as f:
        f.write("\n".join(lines))

    print(f"Generated {src_dir / 'levels.ts'}\n")


def generate_default_level(output_dir: Path, level_names: list) -> None:
    """
    Generate a bundled default scene from the first level.

    Writes:
      - assets/levelData.json (string paths, used for runtime save/load)
      - src/constants/defaultLevel.ts (static module imports, bundled into the APK)

    If assets/levelData.json already exists, it is preserved as the source of truth
    for the bundled default scene. This lets you hand-craft a default layout and have
    it embedded in the APK without the generator overwriting it.
    """
    if not level_names:
        return

    default_name = level_names[0]
    level_json_path = output_dir / f"{default_name}.json"
    with open(level_json_path) as f:
        detected_level_data = json.load(f)

    assets_dir = Path("room-sticker-game/assets")
    assets_dir.mkdir(parents=True, exist_ok=True)
    level_data_path = assets_dir / "levelData.json"

    if level_data_path.exists():
        # Preserve the hand-edited default scene.
        with open(level_data_path) as f:
            level_data = json.load(f)
        print(f"Preserving existing {level_data_path}")
    else:
        # Add a levelId so the app knows which bundled level the default scene belongs to.
        level_data = {**detected_level_data, "levelId": default_name}
        with open(level_data_path, "w") as f:
            json.dump(level_data, f, indent=2)
        print(f"Generated {level_data_path}")

    src_dir = Path("room-sticker-game/src/constants")
    src_dir.mkdir(parents=True, exist_ok=True)

    sticker_paths = sorted((output_dir / default_name / "stickers").glob("sticker_*.png"))

    lines = []
    lines.append("// Auto-generated by generate_levels.py. Do not edit manually.")
    lines.append("")
    lines.append("import { LevelId } from './levels';")
    lines.append(
        f"import defaultLevelRoom from '../../assets/levels/{default_name}/room/room_bare.png';"
    )
    lines.append("")

    safe_names = {}
    for sticker_path in sticker_paths:
        sticker_id = sticker_path.stem
        safe_stem = sticker_id.replace('_', '')
        var_name = f"defaultLevelSticker{safe_stem}"
        safe_names[sticker_id] = var_name
        lines.append(
            f"import {var_name} from '../../assets/levels/{default_name}/stickers/{sticker_path.name}';"
        )

    lines.append("")
    lines.append("export const defaultLevelId: LevelId = '" + default_name + "';")
    lines.append("")
    lines.append("export const defaultRoomImage = defaultLevelRoom;")
    lines.append("")
    lines.append("export const defaultStickerImages: Record<string, any> = {")
    for sticker_id in sorted(safe_names.keys()):
        lines.append(f"  '{sticker_id}': {safe_names[sticker_id]},")
    lines.append("};")
    lines.append("")
    lines.append("export const defaultLevelData = {")
    lines.append(f"  levelId: '{default_name}' as LevelId,")
    lines.append(f"  room: '{default_name}',")
    lines.append("  bgImage: defaultLevelRoom,")
    lines.append(f"  bgSize: {json.dumps(level_data.get('bgSize', {}))},")
    lines.append("  items: [")

    for item in level_data.get("items", []):
        sticker_id = item["id"]
        var_name = safe_names.get(sticker_id)
        if not var_name:
            continue
        lines.append("    {")
        lines.append(f"      id: '{sticker_id}',")
        lines.append(f"      uri: {var_name},")
        lines.append(f"      normX: {item['normX']},")
        lines.append(f"      normY: {item['normY']},")
        lines.append(f"      scale: {item.get('scale', 1.0)},")
        lines.append(f"      rotation: {item.get('rotation', 0)},")
        lines.append(f"      rotation3D: {item.get('rotation3D', 0)},")
        lines.append(f"      layer: {item.get('layer', 1)},")
        lines.append(f"      uid: '{sticker_id}_0',")
        lines.append("    },")

    lines.append("  ],")
    lines.append("};")
    lines.append("")

    with open(src_dir / "defaultLevel.ts", "w") as f:
        f.write("\n".join(lines))

    print(f"Generated {src_dir / 'defaultLevel.ts'}\n")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate levelData JSON files from preprocessed room/sticker assets."
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("CozyRoomAssetPack/stitch_cozy_room_asset_pack/preprocesed"),
        help="Directory containing level folders with room/ and stickers/.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("room-sticker-game/assets/levels"),
        help="Directory where level JSON and copied assets will be written.",
    )
    args = parser.parse_args()

    if not args.input_dir.exists():
        print(f"Error: input directory not found: {args.input_dir}", file=sys.stderr)
        return 1

    # Copy assets into the app and generate level JSON files.
    level_names = []
    for level_dir in sorted(args.input_dir.iterdir()):
        if not level_dir.is_dir():
            continue

        target_dir = args.output_dir / level_dir.name
        if target_dir.exists():
            shutil.rmtree(target_dir)
        shutil.copytree(level_dir, target_dir)

        print(f"\nGenerating {level_dir.name}...")
        generate_level(target_dir, args.output_dir)
        level_names.append(level_dir.name)

    generate_typescript_index(args.output_dir)
    generate_default_level(args.output_dir, level_names)

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
