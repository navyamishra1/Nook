"""Ingestion pipeline orchestrator for loading, validating, and cataloging Nook books."""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from ingestion.exceptions import (
    DuplicateIdentifierError,
    InvalidValueError,
    NookValidationError,
)
from ingestion.models import Book
from ingestion.validators import validate_book_schema, validate_provenance


class IngestionPipeline:
    """Deterministic orchestrator for catalog ingestion, deduplication, and persistence."""

    def __init__(self, output_dir: Optional[Path] = None) -> None:
        self.output_dir = output_dir or Path("data")

    def process_records(self, records: Sequence[Dict[str, Any]]) -> List[Book]:
        """Validate and convert a sequence of dictionary records into Book objects.
        
        Guarantees:
        - Strict per-record schema & provenance validation.
        - Strict duplicate ID and source_identifier rejection across the batch.
        
        Args:
            records: Sequence of dictionaries representing book records.

        Returns:
            List of validated immutable Book instances.

        Raises:
            DuplicateIdentifierError: If any ID or (source, source_identifier) is duplicated.
            NookValidationError: If any record fails schema or provenance rules.
        """
        if not isinstance(records, (list, tuple)):
            raise InvalidValueError(f"Expected list/tuple of records, got {type(records).__name__}")

        seen_ids = set()
        seen_source_keys = set()
        validated_books: List[Book] = []

        for idx, rec in enumerate(records):
            if not isinstance(rec, dict):
                raise InvalidValueError(f"Record at index {idx} must be a dict, got {type(rec).__name__}")

            # Instantiate Book which enforces full validation
            book = Book.from_dict(rec)

            # Check for duplicate internal ID
            if book.id in seen_ids:
                raise DuplicateIdentifierError(
                    f"Duplicate book ID detected at record index {idx}: '{book.id}'"
                )
            seen_ids.add(book.id)

            # Check for duplicate source origin
            source_key = (book.source, book.source_identifier)
            if source_key in seen_source_keys:
                raise DuplicateIdentifierError(
                    f"Duplicate source identifier detected at record index {idx}: {source_key}"
                )
            seen_source_keys.add(source_key)

            validated_books.append(book)

        return validated_books

    def save_catalog(self, books: Sequence[Book], target_file: Path) -> None:
        """Deterministically save a collection of validated Books to a formatted JSON file.
        
        Args:
            books: Sequence of validated Book objects.
            target_file: Path to target JSON file.
        """
        target_file.parent.mkdir(parents=True, exist_ok=True)
        catalog_data = [b.to_dict() for b in books]
        with open(target_file, "w", encoding="utf-8") as f:
            json.dump(catalog_data, f, indent=2, ensure_ascii=False)

    def load_and_validate_catalog(self, catalog_file: Path) -> List[Book]:
        """Read a JSON catalog file from disk and strictly validate every entry.
        
        Args:
            catalog_file: Path to the JSON catalog file.

        Returns:
            List of validated Book instances.
        """
        if not catalog_file.exists():
            raise FileNotFoundError(f"Catalog file not found: {catalog_file}")

        with open(catalog_file, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        return self.process_records(raw_data)
