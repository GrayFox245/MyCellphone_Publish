import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


def normalize_text(value) -> str:
    """Convert NaN/None to empty string, otherwise to stripped string."""
    if value is None:
        return ""
    if pd.isna(value):
        return ""
    return str(value).strip()


def parse_year(value) -> int | None:
    """Try to parse a year (e.g., 2026). Return None if not valid."""
    txt = normalize_text(value)
    if not txt:
        return None
    try:
        year_int = int(float(txt))
        if 1800 <= year_int <= 2200:
            return year_int
        return None
    except Exception:
        return None


def make_date_created(year_value) -> str:
    """
    Produce an ISO8601 string for dateCreated.
    If Year Created exists -> use YYYY-01-01T00:00:00Z
    Else -> use current UTC time.
    """
    year = parse_year(year_value)
    if year is not None:
        dt = datetime(year, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    else:
        dt = datetime.now(timezone.utc)
    return dt.isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_themes(value) -> list[str]:
    """
    Convert Themes cell into a list.
    Expected format in Excel: comma-separated values.
    Empty -> [].
    """
    txt = normalize_text(value)
    if not txt:
        return []
    parts = [p.strip() for p in txt.split(",")]
    return [p for p in parts if p]


def ensure_extension(name_or_filename: str) -> str:
    """
    If Image Name already ends with a known image extension, keep it.
    Otherwise append .jpg
    """
    s = normalize_text(name_or_filename)
    if not s:
        return ""
    lower = s.lower()
    if lower.endswith((".jpg", ".jpeg", ".png", ".webp")):
        return s
    return f"{s}.jpg"


def utc_now_z() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def main() -> None:
    # scripts/excel_to_json.py -> repo root is one level up
    repo_root = Path(__file__).resolve().parent.parent

    excel_path = repo_root / "data" / "image_data.xlsx"
    json_path = repo_root / "image_data.json"
    images_dir = repo_root / "images"

    if not excel_path.exists():
        raise FileNotFoundError(f"Excel file not found: {excel_path}")

    if not images_dir.exists():
        print(f"WARNING: images folder not found: {images_dir}")

    # Read Excel
    df = pd.read_excel(excel_path)

    # Required columns (exactly as your header row)
    required_cols = ["Image Name", "Image Description", "Themes", "Teaser", "Year Created"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(
            "Excel is missing required column(s): "
            + ", ".join(missing)
            + "\nFound columns: "
            + ", ".join(map(str, df.columns))
        )

    images: list[dict] = []
    missing_files: list[str] = []

    for _, row in df.iterrows():
        name = normalize_text(row["Image Name"])
        if not name:
            # Skip completely blank rows (common at bottom of sheet)
            continue

        description = normalize_text(row["Image Description"])
        themes = parse_themes(row["Themes"])
        teaser = normalize_text(row["Teaser"])
        date_created = make_date_created(row["Year Created"])

        filename = ensure_extension(name)

        # Warn if file is missing in /images
        image_file = images_dir / filename
        if images_dir.exists() and not image_file.exists():
            missing_files.append(filename)

        images.append(
            {
                "name": name,
                "description": description,
                "themes": themes,
                "teaser": teaser,
                "dateCreated": date_created,
                "filename": filename,
            }
        )

    payload = {
        "generatedAt": utc_now_z(),
        "count": len(images),
        "images": images,
    }

    # Write JSON (UTF-8, pretty)
    json_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"OK: Wrote {len(images)} images to {json_path}")

    # Print warnings at the end (cleaner)
    if missing_files:
        print("\nWARNING: The following files are listed in Excel but missing in /images:")
        for f in missing_files:
            print(f" - {f}")


if __name__ == "__main__":
    main()