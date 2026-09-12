"""
Nook Full Book Content Ingestion Runner
Fetches, normalizes, validates, and persists complete legitimate public-domain text
from Standard Ebooks for all verified seed books.
"""

import json
import math
import os
import sys
from pathlib import Path

from ingestion.adapters.standard_ebooks import StandardEbooksAdapter
from ingestion.metrics import calculate_reading_time, count_words
from ingestion.pipeline import IngestionPipeline
from ingestion.validators import validate_book_schema, validate_content_structure, validate_provenance


def run_full_ingestion():
    print("==================================================")
    print("NOOK FULL BOOK CONTENT INGESTION (PHASE 3D.1)")
    print("==================================================")

    seed_file = Path("data/seed/books.json")
    if not seed_file.exists():
        raise FileNotFoundError(f"Seed file not found at {seed_file}")

    with open(seed_file, "r", encoding="utf-8") as f:
        books_meta = json.load(f)

    updated_books = []
    pipeline = IngestionPipeline()

    for book in books_meta:
        book_id = book["id"]
        title = book["title"]
        author = book["author"]
        source_identifier = book["source_identifier"]

        print(f"\nProcessing '{title}' ({book_id})...")
        print(f"Source identifier: {source_identifier}")

        # 1. Fetch complete book content from Standard Ebooks
        content_payload = StandardEbooksAdapter.fetch_full_content(
            source_identifier=source_identifier,
            book_id=book_id,
            title=title,
            author=author,
        )

        # 2. Strict validation against stubs / missing chapters
        # Alice is ~27k words, Gatsby ~48k, Frankenstein ~77k, Pride & Prejudice ~121k
        min_chapters = 9 if book_id in ["the-great-gatsby", "alices-adventures-in-wonderland"] else 20
        min_words = 20000

        total_words = validate_content_structure(
            content_payload, min_chapters=min_chapters, min_words=min_words
        )
        total_reading_time = calculate_reading_time(total_words, words_per_minute=225)

        num_chapters = len(content_payload["chapters"])
        print(f"-> Successfully extracted {num_chapters} chapters ({total_words:,} words, ~{total_reading_time} min)")

        # 3. Persist canonical content.json to data/books/{id}/content.json
        data_content_path = Path(f"data/books/{book_id}/content.json")
        data_content_path.parent.mkdir(parents=True, exist_ok=True)
        with open(data_content_path, "w", encoding="utf-8") as f:
            json.dump(content_payload, f, indent=2, ensure_ascii=False)
        print(f"-> Saved: {data_content_path}")

        # 4. Mirror to frontend/data/books/{id}/content.json to prevent silent divergence
        frontend_content_path = Path(f"frontend/data/books/{book_id}/content.json")
        frontend_content_path.parent.mkdir(parents=True, exist_ok=True)
        with open(frontend_content_path, "w", encoding="utf-8") as f:
            json.dump(content_payload, f, indent=2, ensure_ascii=False)
        print(f"-> Mirrored: {frontend_content_path}")

        # 5. Update book metadata metrics derived deterministically from the real content
        updated_book = dict(book)
        updated_book["word_count"] = total_words
        updated_book["estimated_reading_time"] = total_reading_time

        # Validate complete book schema
        validate_provenance(updated_book)
        validate_book_schema(updated_book)

        updated_books.append(updated_book)

    # 6. Save updated catalog to data/seed/books.json and mirror to frontend/data/seed/books.json
    print("\nSaving synchronized catalog files...")
    with open(seed_file, "w", encoding="utf-8") as f:
        json.dump(updated_books, f, indent=2, ensure_ascii=False)
    print(f"-> Updated: {seed_file}")

    frontend_seed_file = Path("frontend/data/seed/books.json")
    if frontend_seed_file.parent.exists():
        with open(frontend_seed_file, "w", encoding="utf-8") as f:
            json.dump(updated_books, f, indent=2, ensure_ascii=False)
        print(f"-> Mirrored: {frontend_seed_file}")

    print("\n==================================================")
    print("ALL 4 SEED BOOKS INGESTED & VALIDATED SUCCESSFULLY")
    print("==================================================")


if __name__ == "__main__":
    run_full_ingestion()
