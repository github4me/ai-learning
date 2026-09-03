#!/usr/bin/env python3
"""Deterministically extract the pinned course PDF into an auditable JSON file."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
from typing import Any

import pymupdf as fitz
from pypdf import PdfReader


EXPECTED_SHA256 = "3ED047406DE297352B38635D01CF080B0213C9FD899AEA80520AA8A8283E1D52"
EXPECTED_PAGE_COUNT = 170


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def json_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def flatten_outline(reader: PdfReader) -> list[dict[str, Any]]:
    flattened: list[dict[str, Any]] = []

    def visit(items: list[Any], depth: int, parent_index: int | None) -> None:
        previous_index: int | None = None
        for item in items:
            if isinstance(item, list):
                if previous_index is None:
                    raise ValueError("Outline child list has no preceding parent")
                visit(item, depth + 1, previous_index)
                continue

            try:
                page_number = reader.get_destination_page_number(item) + 1
            except Exception as error:  # pragma: no cover - source-change guard
                raise ValueError(f"Unresolvable outline destination: {item!r}") from error

            outline_index = len(flattened)
            title = str(getattr(item, "title", item))
            flattened.append(
                {
                    "outlineIndex": outline_index,
                    "parentOutlineIndex": parent_index,
                    "depth": depth,
                    "titleRaw": title,
                    "pdfPage": page_number,
                }
            )
            previous_index = outline_index

    visit(reader.outline, 0, None)
    return flattened


def pypdf_spans(page: Any, pdf_page: int) -> list[dict[str, Any]]:
    spans: list[dict[str, Any]] = []

    def visitor(
        text: str,
        cm: list[float],
        tm: list[float],
        font_dictionary: Any,
        font_size: float,
    ) -> None:
        if not text:
            return
        spans.append(
            {
                "id": f"p{pdf_page:03d}-t{len(spans):05d}",
                "textRaw": text,
                "cm": [round(float(value), 4) for value in cm],
                "tm": [round(float(value), 4) for value in tm],
                "fontSize": round(float(font_size), 4),
                "font": json_value(font_dictionary.get("/BaseFont"))
                if font_dictionary
                else None,
            }
        )

    page.extract_text(visitor_text=visitor)
    return spans


def positioned_page(page: fitz.Page, pdf_page: int) -> dict[str, Any]:
    raw = page.get_text("dict", sort=False)
    spans: list[dict[str, Any]] = []
    lines: list[dict[str, Any]] = []
    for block in raw.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            line_span_ids: list[str] = []
            line_parts: list[str] = []
            for span in line.get("spans", []):
                span_id = f"p{pdf_page:03d}-s{len(spans):05d}"
                line_span_ids.append(span_id)
                line_parts.append(span.get("text", ""))
                spans.append(
                    {
                        "id": span_id,
                        "textRaw": span.get("text", ""),
                        "font": span.get("font", ""),
                        "size": round(float(span.get("size", 0)), 4),
                        "flags": int(span.get("flags", 0)),
                        "bbox": [round(float(value), 4) for value in span["bbox"]],
                        "origin": [
                            round(float(value), 4)
                            for value in span.get("origin", (0, 0))
                        ],
                    }
                )
            if line_span_ids:
                lines.append(
                    {
                        "id": f"p{pdf_page:03d}-l{len(lines):04d}",
                        "spanIds": line_span_ids,
                        "lineRaw": "".join(line_parts),
                        "bbox": [round(float(value), 4) for value in line["bbox"]],
                    }
                )

    footer_candidates = [
        span
        for span in spans
        if span["bbox"][1] > 790 and span["textRaw"].strip().isdigit()
    ]
    printed_page_label = (
        footer_candidates[-1]["textRaw"].strip() if footer_candidates else None
    )
    return {
        "width": round(float(page.rect.width), 4),
        "height": round(float(page.rect.height), 4),
        "spans": spans,
        "lines": lines,
        "printedPageLabel": printed_page_label,
    }


def extract(input_path: Path) -> dict[str, Any]:
    source_hash = sha256_file(input_path)
    if source_hash != EXPECTED_SHA256:
        raise ValueError(
            f"Source SHA-256 mismatch: expected {EXPECTED_SHA256}, got {source_hash}"
        )

    reader = PdfReader(str(input_path))
    if len(reader.pages) != EXPECTED_PAGE_COUNT:
        raise ValueError(
            f"Source page count mismatch: expected {EXPECTED_PAGE_COUNT}, "
            f"got {len(reader.pages)}"
        )
    if reader.is_encrypted:
        raise ValueError("Pinned source unexpectedly became encrypted")

    fitz_document = fitz.open(input_path)
    pages: list[dict[str, Any]] = []
    try:
        for index, reader_page in enumerate(reader.pages):
            pdf_page = index + 1
            positioned = positioned_page(fitz_document[index], pdf_page)
            pages.append(
                {
                    "pdfPage": pdf_page,
                    "rawText": reader_page.extract_text(),
                    "pypdfSpans": pypdf_spans(reader_page, pdf_page),
                    **positioned,
                }
            )
    finally:
        fitz_document.close()

    outline = flatten_outline(reader)
    if len(outline) != 461:
        raise ValueError(f"Expected 461 outline destinations, got {len(outline)}")

    return {
        "source": {
            "filename": input_path.name,
            "sha256": source_hash,
            "pageCount": len(reader.pages),
            "encrypted": reader.is_encrypted,
            "metadata": {
                str(key): json_value(value)
                for key, value in (reader.metadata or {}).items()
            },
            "extractorVersions": {
                "pypdf": importlib.metadata.version("pypdf"),
                "PyMuPDF": importlib.metadata.version("PyMuPDF"),
            },
        },
        "outline": outline,
        "pages": pages,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    arguments = parser.parse_args()

    result = extract(arguments.input.resolve())
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    source = result["source"]
    print(
        json.dumps(
            {
                "output": str(arguments.output.resolve()),
                "sha256": source["sha256"],
                "pageCount": source["pageCount"],
                "outlineDestinations": len(result["outline"]),
                "extractorVersions": source["extractorVersions"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
