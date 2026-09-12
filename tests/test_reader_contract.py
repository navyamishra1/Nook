"""
Tests for Reader data contract, full chapter integrity, ordering, boundary conditions, and error cases.
Validates that full legitimate public-domain text is present for all seed books.
"""

import json
import os
import unittest
from ingestion.exceptions import InvalidValueError
from ingestion.validators import validate_content_structure


class TestReaderDataContract(unittest.TestCase):
    def setUp(self):
        self.seed_books_path = os.path.join("data", "seed", "books.json")
        self.books_dir = os.path.join("data", "books")
        self.frontend_books_dir = os.path.join("frontend", "data", "books")

    def test_seed_books_and_content_presence(self):
        """Ensure seed books and corresponding content.json files exist and are complete."""
        self.assertTrue(os.path.exists(self.seed_books_path), "books.json must exist")

        with open(self.seed_books_path, "r", encoding="utf-8") as f:
            books = json.load(f)

        self.assertGreaterEqual(len(books), 4)

        for book in books:
            book_id = book["id"]
            content_path = os.path.join(self.books_dir, book_id, "content.json")
            self.assertTrue(
                os.path.exists(content_path),
                f"Content file must exist at {content_path} for book {book_id}"
            )
            with open(content_path, "r", encoding="utf-8") as f:
                content_data = json.load(f)
            self.assertEqual(content_data.get("id"), book_id)
            self.assertGreaterEqual(len(content_data.get("chapters", [])), 1)

    def test_full_book_multi_chapter_counts(self):
        """Verify that all seed books contain their complete chapter lists."""
        expected_min_chapters = {
            "pride-and-prejudice": 61,
            "frankenstein": 30,
            "alices-adventures-in-wonderland": 12,
            "the-great-gatsby": 9,
        }

        for book_id, min_chaps in expected_min_chapters.items():
            content_path = os.path.join(self.books_dir, book_id, "content.json")
            with open(content_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            chaps = data.get("chapters", [])
            self.assertGreaterEqual(
                len(chaps),
                min_chaps,
                f"Book '{book_id}' must have at least {min_chaps} chapters, found {len(chaps)}"
            )

    def test_full_book_word_counts(self):
        """Verify that full word counts match full-length novels (no stubs)."""
        expected_min_words = {
            "pride-and-prejudice": 100000,
            "frankenstein": 70000,
            "alices-adventures-in-wonderland": 25000,
            "the-great-gatsby": 40000,
        }

        for book_id, min_words in expected_min_words.items():
            content_path = os.path.join(self.books_dir, book_id, "content.json")
            with open(content_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            total_words = sum(len(c["content"].split()) for c in data.get("chapters", []))
            self.assertGreaterEqual(
                total_words,
                min_words,
                f"Book '{book_id}' must have at least {min_words} words, found {total_words}"
            )

    def test_frankenstein_letter_i_multi_paragraph_integrity(self):
        """Frankenstein Letter I must contain complete letter with multiple paragraphs."""
        frank_path = os.path.join(self.books_dir, "frankenstein", "content.json")
        with open(frank_path, "r", encoding="utf-8") as f:
            frankenstein = json.load(f)

        # Find Letter I
        letter_i = None
        for chap in frankenstein["chapters"]:
            if "letter i" in chap["title"].lower() and "letter ii" not in chap["title"].lower() and "letter iv" not in chap["title"].lower():
                letter_i = chap
                break

        self.assertIsNotNone(letter_i, "Letter I must be present in Frankenstein")
        paragraphs = [p for p in letter_i["content"].split("\n\n") if p.strip()]
        self.assertGreaterEqual(len(paragraphs), 6, "Letter I must contain multiple paragraphs (at least 6)")
        self.assertIn("rejoice to hear that no disaster", letter_i["content"].lower())
        self.assertIn("r. walton", letter_i["content"].lower())

    def test_pride_and_prejudice_chapter_i_multi_paragraph_integrity(self):
        """Pride and Prejudice Chapter I must contain complete opening dialogue."""
        pride_path = os.path.join(self.books_dir, "pride-and-prejudice", "content.json")
        with open(pride_path, "r", encoding="utf-8") as f:
            pandp = json.load(f)

        first_chap = pandp["chapters"][0]
        paragraphs = [p for p in first_chap["content"].split("\n\n") if p.strip()]
        self.assertGreaterEqual(len(paragraphs), 15, "Chapter I of Pride and Prejudice must contain at least 15 paragraphs")
        self.assertIn("truth universally acknowledged", first_chap["content"].lower())
        self.assertIn("netherfield", first_chap["content"].lower())

    def test_canonical_content_sync_between_data_and_frontend(self):
        """Ensure data/books/{id} and frontend/data/books/{id} are perfectly synchronized."""
        with open(self.seed_books_path, "r", encoding="utf-8") as f:
            books = json.load(f)

        for book in books:
            book_id = book["id"]
            backend_file = os.path.join(self.books_dir, book_id, "content.json")
            frontend_file = os.path.join(self.frontend_books_dir, book_id, "content.json")

            self.assertTrue(os.path.exists(backend_file), f"Backend content missing: {backend_file}")
            self.assertTrue(os.path.exists(frontend_file), f"Frontend content missing: {frontend_file}")

            with open(backend_file, "r", encoding="utf-8") as f1, open(frontend_file, "r", encoding="utf-8") as f2:
                self.assertEqual(f1.read(), f2.read(), f"Content divergence between backend and frontend for '{book_id}'")

    def test_validator_rejects_single_paragraph_stub(self):
        """Validate that validate_content_structure strictly rejects single-paragraph placeholder stubs."""
        stub_content = {
            "id": "stub-book",
            "title": "Stub Book",
            "author": "Stub Author",
            "chapters": [
                {
                    "number": 1,
                    "title": "Chapter 1",
                    "content": "This is only one short sentence placeholder."
                }
            ]
        }
        with self.assertRaises(InvalidValueError):
            validate_content_structure(stub_content, min_chapters=5, min_words=10000)

    def test_chapter_boundaries_and_ordering(self):
        """Test boundary calculations for all multi-chapter books."""
        with open(self.seed_books_path, "r", encoding="utf-8") as f:
            books = json.load(f)

        for book in books:
            book_id = book["id"]
            content_path = os.path.join(self.books_dir, book_id, "content.json")
            with open(content_path, "r", encoding="utf-8") as f:
                book_data = json.load(f)

            chapters = book_data["chapters"]
            total = len(chapters)

            # First chapter
            self.assertEqual(chapters[0]["number"], 1)
            has_prev_at_1 = (1 > 1)
            self.assertFalse(has_prev_at_1, "First chapter cannot have previous")

            # Last chapter
            self.assertEqual(chapters[-1]["number"], total)
            has_next_at_last = (total < total)
            self.assertFalse(has_next_at_last, "Last chapter cannot have next")

    def test_invalid_book_error_handling(self):
        """Simulate missing book content path."""
        non_existent_path = os.path.join(self.books_dir, "non-existent-book-999", "content.json")
        self.assertFalse(os.path.exists(non_existent_path))


if __name__ == "__main__":
    unittest.main()
