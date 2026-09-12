"""Unit tests for the normalization layer."""

import unittest

from ingestion.exceptions import (
    MissingFieldError,
    ProvenanceError,
)
from ingestion.normalizer import (
    normalize_book_data,
    normalize_categories,
    normalize_publication_year,
    slugify,
)


class TestNormalizer(unittest.TestCase):
    """Test suite for metadata normalization rules."""

    def test_slugify(self) -> None:
        """Slugify helper should generate clean URL-safe lowercase slugs."""
        self.assertEqual(slugify("Pride and Prejudice!"), "pride-and-prejudice")
        self.assertEqual(slugify("Jane Austen & Co."), "jane-austen-co")
        self.assertEqual(slugify("  Multiple   Spaces   "), "multiple-spaces")

    def test_normalize_categories(self) -> None:
        """Categories must be split, stripped, and deduplicated case-insensitively."""
        raw_list = ["Classics", "Romance", "classics", "  Drama  "]
        self.assertEqual(normalize_categories(raw_list), ["Classics", "Romance", "Drama"])

        raw_str = "Fiction; Romance, Satire | Classics"
        self.assertEqual(
            normalize_categories(raw_str),
            ["Fiction", "Romance", "Satire", "Classics"],
        )

    def test_normalize_publication_year(self) -> None:
        """Publication year should parse clean integers or 4-digit dates without guessing."""
        self.assertEqual(normalize_publication_year(1813), 1813)
        self.assertEqual(normalize_publication_year("1818-01-01"), 1818)
        self.assertEqual(normalize_publication_year("Published in 1925"), 1925)
        self.assertIsNone(normalize_publication_year(None))
        self.assertIsNone(normalize_publication_year("Unknown date"))
        self.assertIsNone(normalize_publication_year(99999))

    def test_normalization_with_text_content(self) -> None:
        """Providing raw text content should compute word count and reading time automatically."""
        raw_data = {
            "title": "A Short Tale",
            "author": "An Author",
            "source": "standard-ebooks",
            "source_url": "https://standardebooks.org/ebooks/an-author/a-short-tale",
            "source_identifier": "an-author/a-short-tale",
            "license_or_rights": "Public Domain (CC0 1.0 Universal)",
            "publication_year": "1890",
            "categories": ["Short Stories"],
        }
        text = "This short story has exactly ten words right here now."
        normalized = normalize_book_data(raw_data, text_content=text, words_per_minute=225)

        self.assertEqual(normalized["id"], "an-author-a-short-tale")
        self.assertEqual(normalized["word_count"], 10)
        self.assertEqual(normalized["estimated_reading_time"], 1)
        self.assertEqual(normalized["publication_year"], 1890)
        self.assertIsNone(normalized["description"])
        self.assertIsNone(normalized["cover"])

    def test_normalization_preserves_optional_none(self) -> None:
        """Missing optional fields must be explicitly None, not hallucinated strings."""
        raw_data = {
            "title": "Pride and Prejudice",
            "author": "Jane Austen",
            "source": "standard-ebooks",
            "source_url": "https://standardebooks.org/ebooks/jane-austen/pride-and-prejudice",
            "source_identifier": "jane-austen/pride-and-prejudice",
            "license_or_rights": "Public Domain (CC0 1.0 Universal)",
        }
        normalized = normalize_book_data(raw_data)
        self.assertIsNone(normalized["description"])
        self.assertIsNone(normalized["cover"])
        self.assertIsNone(normalized["publication_year"])

    def test_normalization_rejection_missing_author(self) -> None:
        """Missing required author must raise MissingFieldError."""
        raw_data = {
            "title": "Anonymous Work",
            "source": "standard-ebooks",
            "source_url": "https://standardebooks.org/ebooks/anonymous/work",
            "source_identifier": "anonymous/work",
            "license_or_rights": "Public Domain",
        }
        with self.assertRaises(MissingFieldError) as ctx:
            normalize_book_data(raw_data)
        self.assertIn("author", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
