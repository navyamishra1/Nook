"""Unit tests for the Standard Ebooks source adapter."""

import unittest

from ingestion.adapters.standard_ebooks import StandardEbooksAdapter
from ingestion.exceptions import (
    InvalidValueError,
    MissingFieldError,
    ProvenanceError,
)
from ingestion.models import Book


class TestStandardEbooksAdapter(unittest.TestCase):
    """Test suite for Standard Ebooks adapter functionality."""

    def setUp(self) -> None:
        self.sample_opf_xml = """<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title id="title">Frankenstein; or, The Modern Prometheus</dc:title>
    <dc:creator id="author">Mary Wollstonecraft Shelley</dc:creator>
    <dc:language>en</dc:language>
    <dc:date>1818</dc:date>
    <dc:rights>The source text and artwork in this ebook are believed to be in the United States public domain; that is, they are free of copyright restrictions in the United States. They may still be copyrighted in other countries, so users located outside of the United States must check their local laws before downloading this ebook. The creators of, and contributors to, this ebook dedicate their contributions to the worldwide public domain via the terms in the CC0 1.0 Universal Public Domain Dedication.</dc:rights>
    <dc:subject>Science fiction</dc:subject>
    <dc:subject>Horror tales</dc:subject>
    <dc:description>A young scientist creates a sapient creature in an unorthodox experiment.</dc:description>
  </metadata>
</package>
"""

    def test_build_canonical_url(self) -> None:
        """Verify URL constructor."""
        url = StandardEbooksAdapter.build_canonical_url("jane-austen/pride-and-prejudice")
        self.assertEqual(
            url,
            "https://standardebooks.org/ebooks/jane-austen/pride-and-prejudice",
        )

    def test_parse_metadata_dict(self) -> None:
        """Verify parsing a structured metadata dictionary."""
        raw_meta = {
            "title": "Pride and Prejudice",
            "author": "Jane Austen",
            "source_identifier": "jane-austen/pride-and-prejudice",
            "publication_year": 1813,
            "categories": ["Romance", "Classics"],
        }
        book = StandardEbooksAdapter.parse_metadata_dict(raw_meta)
        self.assertIsInstance(book, Book)
        self.assertEqual(book.source, "standard-ebooks")
        self.assertEqual(
            book.source_url,
            "https://standardebooks.org/ebooks/jane-austen/pride-and-prejudice",
        )
        self.assertEqual(book.author, "Jane Austen")

    def test_parse_opf_xml(self) -> None:
        """Verify parsing a complete OPF XML document."""
        book = StandardEbooksAdapter.parse_opf_xml(
            self.sample_opf_xml,
            source_identifier="mary-shelley/frankenstein",
            text_content="It was on a dreary night of November that I beheld the accomplishment of my toils.",
        )
        self.assertIsInstance(book, Book)
        self.assertEqual(book.title, "Frankenstein; or, The Modern Prometheus")
        self.assertEqual(book.author, "Mary Wollstonecraft Shelley")
        self.assertEqual(book.publication_year, 1818)
        self.assertIn("Science fiction", book.categories)
        self.assertEqual(book.word_count, 16)
        self.assertEqual(book.estimated_reading_time, 1)

    def test_parse_malformed_opf_xml(self) -> None:
        """Malformed XML should raise InvalidValueError."""
        with self.assertRaises(InvalidValueError) as ctx:
            StandardEbooksAdapter.parse_opf_xml(
                "<not valid xml",
                source_identifier="invalid",
            )
        self.assertIn("Malformed OPF XML content", str(ctx.exception))

    def test_missing_source_identifier(self) -> None:
        """Omitting source identifier must raise ProvenanceError."""
        raw_meta = {
            "title": "Title",
            "author": "Author",
        }
        with self.assertRaises(ProvenanceError):
            StandardEbooksAdapter.parse_metadata_dict(raw_meta)


if __name__ == "__main__":
    unittest.main()
