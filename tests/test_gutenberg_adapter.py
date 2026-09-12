"""Unit tests for Project Gutenberg Adapter."""

import unittest
from ingestion.adapters.gutenberg import GutenbergAdapter
from ingestion.exceptions import InvalidValueError


class TestGutenbergAdapter(unittest.TestCase):
    """Test suite for Gutenberg text cleaning, chapter splitting, and metadata normalization."""

    def test_build_canonical_url(self):
        """Verify canonical Gutenberg URL generator."""
        url = GutenbergAdapter.build_canonical_url(164)
        self.assertEqual(url, "https://www.gutenberg.org/ebooks/164")

    def test_clean_gutenberg_raw_text(self):
        """Verify stripping of Gutenberg legal boilerplate."""
        sample_text = (
            "The Project Gutenberg eBook of Sample\n"
            "*** START OF THE PROJECT GUTENBERG EBOOK SAMPLE ***\n\n"
            "Chapter I\n\nIt was the best of times.\n\n"
            "*** END OF THE PROJECT GUTENBERG EBOOK SAMPLE ***\n"
            "End of Project Gutenberg"
        )
        cleaned = GutenbergAdapter.clean_gutenberg_raw_text(sample_text)
        self.assertNotIn("START OF THE PROJECT", cleaned)
        self.assertNotIn("END OF THE PROJECT", cleaned)
        self.assertIn("It was the best of times.", cleaned)

    def test_split_into_chapters(self):
        """Verify chapter splitting on standard headings."""
        sample_body = (
            "CHAPTER I\n\nParagraph one of first chapter.\n\nParagraph two.\n\n"
            "CHAPTER II\n\nParagraph one of second chapter.\n\nParagraph two."
        )
        chapters = GutenbergAdapter.split_into_chapters(sample_body)
        self.assertEqual(len(chapters), 2)
        self.assertEqual(chapters[0]["number"], 1)
        self.assertIn("CHAPTER I", chapters[0]["title"].upper())
        self.assertIn("Paragraph one of first chapter.", chapters[0]["content"])
        self.assertEqual(chapters[1]["number"], 2)
        self.assertIn("CHAPTER II", chapters[1]["title"].upper())
        self.assertIn("Paragraph one of second chapter.", chapters[1]["content"])


if __name__ == "__main__":
    unittest.main()
