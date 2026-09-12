"""Unit tests for the canonical Book data model."""

import json
import unittest

from ingestion.exceptions import (
    InvalidValueError,
    MissingFieldError,
    ProvenanceError,
)
from ingestion.models import Book


class TestBookModel(unittest.TestCase):
    """Test suite for Book dataclass initialization, validation, and serialization."""

    def setUp(self) -> None:
        self.valid_book_data = {
            "id": "pride-and-prejudice",
            "title": "Pride and Prejudice",
            "author": "Jane Austen",
            "language": "en",
            "description": "A classic Regency romance novel.",
            "cover": "covers/pride.webp",
            "source": "standard-ebooks",
            "source_url": "https://standardebooks.org/ebooks/jane-austen/pride-and-prejudice",
            "source_identifier": "jane-austen/pride-and-prejudice",
            "license_or_rights": "Public Domain (CC0 1.0 Universal)",
            "publication_year": 1813,
            "categories": ["Classics", "Romance"],
            "text_location": "data/books/pride-and-prejudice/content.json",
            "word_count": 122189,
            "estimated_reading_time": 544,
        }

    def test_valid_book_instantiation(self) -> None:
        """Verify that a complete, valid dictionary creates an immutable Book instance."""
        book = Book.from_dict(self.valid_book_data)
        self.assertEqual(book.id, "pride-and-prejudice")
        self.assertEqual(book.title, "Pride and Prejudice")
        self.assertEqual(book.author, "Jane Austen")
        self.assertEqual(book.language, "en")
        self.assertEqual(book.source, "standard-ebooks")
        self.assertEqual(book.publication_year, 1813)
        self.assertEqual(book.word_count, 122189)
        self.assertEqual(book.estimated_reading_time, 544)
        self.assertEqual(book.categories, ["Classics", "Romance"])

    def test_book_to_dict_and_to_json(self) -> None:
        """Verify serialization to dictionary and formatted JSON."""
        book = Book.from_dict(self.valid_book_data)
        d = book.to_dict()
        self.assertEqual(d["title"], "Pride and Prejudice")

        json_str = book.to_json()
        parsed = json.loads(json_str)
        self.assertEqual(parsed["source_identifier"], "jane-austen/pride-and-prejudice")

        # Roundtrip deserialization
        restored = Book.from_json(json_str)
        self.assertEqual(book, restored)

    def test_optional_fields_as_none(self) -> None:
        """Verify that optional fields can be None without raising validation errors."""
        data = dict(self.valid_book_data)
        data["description"] = None
        data["cover"] = None
        data["publication_year"] = None
        book = Book.from_dict(data)
        self.assertIsNone(book.description)
        self.assertIsNone(book.cover)
        self.assertIsNone(book.publication_year)

    def test_rejection_of_missing_mandatory_field(self) -> None:
        """Verify that omitting a mandatory field raises MissingFieldError."""
        data = dict(self.valid_book_data)
        del data["title"]
        with self.assertRaises(MissingFieldError) as ctx:
            Book.from_dict(data)
        self.assertIn("title", str(ctx.exception))

    def test_rejection_of_negative_word_count(self) -> None:
        """Verify that negative word counts are strictly rejected."""
        data = dict(self.valid_book_data)
        data["word_count"] = -5
        with self.assertRaises(InvalidValueError) as ctx:
            Book.from_dict(data)
        self.assertIn("word_count", str(ctx.exception))

    def test_rejection_of_negative_reading_time(self) -> None:
        """Verify that negative reading time is strictly rejected."""
        data = dict(self.valid_book_data)
        data["estimated_reading_time"] = -1
        with self.assertRaises(InvalidValueError) as ctx:
            Book.from_dict(data)
        self.assertIn("estimated_reading_time", str(ctx.exception))

    def test_rejection_of_empty_categories(self) -> None:
        """Verify that empty categories list is rejected."""
        data = dict(self.valid_book_data)
        data["categories"] = []
        with self.assertRaises(InvalidValueError) as ctx:
            Book.from_dict(data)
        self.assertIn("categories", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
