"""Unit tests for the IngestionPipeline and catalog management."""

import json
from pathlib import Path
import tempfile
import unittest

from ingestion.exceptions import (
    DuplicateIdentifierError,
    InvalidValueError,
)
from ingestion.pipeline import IngestionPipeline


class TestIngestionPipeline(unittest.TestCase):
    """Test suite for batch processing, deduplication, and persistence."""

    def setUp(self) -> None:
        self.pipeline = IngestionPipeline()
        self.record_1 = {
            "id": "book-1",
            "title": "Book One",
            "author": "Author A",
            "language": "en",
            "source": "standard-ebooks",
            "source_url": "https://standardebooks.org/ebooks/author-a/book-one",
            "source_identifier": "author-a/book-one",
            "license_or_rights": "Public Domain (CC0 1.0)",
            "categories": ["Classics"],
            "text_location": "data/books/book-1/content.json",
            "word_count": 1000,
            "estimated_reading_time": 5,
        }
        self.record_2 = {
            "id": "book-2",
            "title": "Book Two",
            "author": "Author B",
            "language": "en",
            "source": "standard-ebooks",
            "source_url": "https://standardebooks.org/ebooks/author-b/book-two",
            "source_identifier": "author-b/book-two",
            "license_or_rights": "Public Domain (CC0 1.0)",
            "categories": ["Philosophy"],
            "text_location": "data/books/book-2/content.json",
            "word_count": 2000,
            "estimated_reading_time": 9,
        }

    def test_process_valid_batch(self) -> None:
        """Batch of valid, unique records processes cleanly."""
        books = self.pipeline.process_records([self.record_1, self.record_2])
        self.assertEqual(len(books), 2)
        self.assertEqual(books[0].id, "book-1")
        self.assertEqual(books[1].id, "book-2")

    def test_rejection_of_duplicate_id(self) -> None:
        """Batch containing duplicate book IDs must raise DuplicateIdentifierError."""
        dup_record = dict(self.record_2)
        dup_record["id"] = "book-1"  # Same ID as record 1
        with self.assertRaises(DuplicateIdentifierError) as ctx:
            self.pipeline.process_records([self.record_1, dup_record])
        self.assertIn("Duplicate book ID detected", str(ctx.exception))

    def test_rejection_of_duplicate_source_identifier(self) -> None:
        """Batch containing duplicate source identifiers must raise DuplicateIdentifierError."""
        dup_record = dict(self.record_2)
        dup_record["id"] = "unique-id"
        dup_record["source_identifier"] = "author-a/book-one"  # Same source ID as record 1
        with self.assertRaises(DuplicateIdentifierError) as ctx:
            self.pipeline.process_records([self.record_1, dup_record])
        self.assertIn("Duplicate source identifier detected", str(ctx.exception))

    def test_save_and_load_catalog(self) -> None:
        """Catalog file can be written to disk and loaded with full validation."""
        books = self.pipeline.process_records([self.record_1, self.record_2])
        with tempfile.TemporaryDirectory() as tmpdir:
            catalog_file = Path(tmpdir) / "catalog.json"
            self.pipeline.save_catalog(books, catalog_file)

            self.assertTrue(catalog_file.exists())
            loaded = self.pipeline.load_and_validate_catalog(catalog_file)
            self.assertEqual(len(loaded), 2)
            self.assertEqual(loaded[0].id, "book-1")
            self.assertEqual(loaded[1].id, "book-2")


if __name__ == "__main__":
    unittest.main()
