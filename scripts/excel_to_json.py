import json
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd


def normalize_text(value) -> str:
    if value is None or pd.isna(value):
        return ""
    return str(value).strip()


def normalize_year_created(value) -> str:
    if value is None or pd.isna(value):
        return ""
    if isinstance(value, pd.Timestamp):
        return value.to_pydatetime().date().isoformat()
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, (int, float)):
        try:
            base = datetime(1899, 12, 30)
            return (base + timedelta(days=float(value))).date().isoformat()
        except Exception:
            return normalize_text(value)
    return normalize_text(value)


def parse_themes(value) -> str:
    return normalize_text(value)


def find_column(columns: list[str], preferred_names: list[str], fallback_index: int | None = None) -> str:
    normalized = {str(col).strip().lower(): str(col) for col in columns}

    for name in preferred_names:
        match = normalized.get(name.lower())
        if match:
            return match

    if fallback_index is not None and fallback_index < len(columns):
        return str(columns[fallback_index])

    raise ValueError(
        f"Could not find any of {preferred_names}. Found columns: {', '.join(map(str, columns))}"
    )


def build_image_lookup(images_dir: Path) -> dict[str, str]:
    if not images_dir.exists():
        return {}

    lookup: dict[str, str] = {}
    for path in images_dir.iterdir():
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff"}:
            continue
        lookup.setdefault(path.stem.casefold(), path.name)
    return lookup


def resolve_image_file(image_name: str, image_lookup: dict[str, str]) -> str:
    return image_lookup.get(image_name.casefold(), f"{image_name}.jpg")


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    excel_path = repo_root / "data" / "image_data.xlsx"
    json_path = repo_root / "image-data.json"
    images_dir = repo_root / "images"

    if not excel_path.exists():
        raise FileNotFoundError(f"Excel file not found: {excel_path}")

    df = pd.read_excel(excel_path, dtype=object)
    columns = list(df.columns)

    number_col = find_column(columns, ["Number"], fallback_index=0)
    image_name_col = find_column(columns, ["Image Name", "Name"], fallback_index=1)
    description_col = find_column(columns, ["Image Description", "Description"], fallback_index=2)
    themes_col = find_column(columns, ["Themes", "Theme"], fallback_index=3)
    teaser_col = find_column(columns, ["Teaser"], fallback_index=4)
    year_col = None
    try:
        year_col = find_column(columns, ["Year Created", "Date Created", "Year"], fallback_index=5)
    except ValueError:
        year_col = None

    image_lookup = build_image_lookup(images_dir)

    images: list[dict[str, object]] = []
    for _, row in df.iterrows():
        image_name = normalize_text(row[image_name_col])
        if not image_name:
            continue

        item = {
            "number": normalize_text(row[number_col]),
            "image_name": image_name,
            "description": normalize_text(row[description_col]),
            "themes": parse_themes(row[themes_col]),
            "teaser": normalize_text(row[teaser_col]),
            "image_file": resolve_image_file(image_name, image_lookup),
        }

        if year_col is not None:
            item["year_created"] = normalize_year_created(row[year_col])

        images.append(item)

    json_path.write_text(
        json.dumps(images, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"OK: Wrote {len(images)} images to {json_path}")


if __name__ == "__main__":
    main()
