"""Integration tests validating the seed catalog in data/seed/books.json."""

import json
from pathlib import Path
import unittest

from ingestion.models import Book
from ingestion.pipeline import IngestionPipeline
from ingestion.validators import validate_book_schema, validate_provenance


class TestSeedDataset(unittest.TestCase):
    """Integration test suite ensuring seed catalog integrity and provenance."""

    def setUp(self) -> None:
        self.seed_file = Path("data/seed/books.json")

    def test_seed_file_exists(self) -> None:
        """Seed file must exist at data/seed/books.json."""
        self.assertTrue(self.seed_file.exists(), f"Seed file not found at {self.seed_file}")

    def test_seed_catalog_count(self) -> None:
        """Seed dataset must contain at least 100 verified records in expanded catalog."""
        with open(self.seed_file, "r", encoding="utf-8") as f:
            records = json.load(f)
        self.assertGreaterEqual(len(records), 100)

    def test_seed_records_pass_strict_validation(self) -> None:
        """Every book record in the seed file must satisfy the 15-field schema and provenance rules."""
        with open(self.seed_file, "r", encoding="utf-8") as f:
            records = json.load(f)

        pipeline = IngestionPipeline()
        books = pipeline.process_records(records)
        self.assertEqual(len(books), len(records))

        for book in books:
            d = book.to_dict()
            # Verify no validation exceptions raised
            validate_provenance(d)
            validate_book_schema(d)

            # Verify non-empty provenance
            self.assertTrue(book.source.strip())
            self.assertTrue(book.source_url.startswith("https://"))
            self.assertTrue(book.source_identifier.strip())
            self.assertTrue(book.license_or_rights.strip())

            # Verify content file exists
            content_path = Path(book.text_location)
            self.assertTrue(
                content_path.exists(),
                f"Content file for book '{book.id}' does not exist at {content_path}",
            )


if __name__ == "__main__":
    unittest.main()
