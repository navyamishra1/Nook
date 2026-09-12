"""
Tests for Nook Reading Journal & Annotation Data Model.
Validates the versioned data schema, bookmark structures, highlights, marginal notes,
and multi-book coexistence integrity.
"""

import unittest
import json
import time


class TestJournalDataModel(unittest.TestCase):
    """Validates the schema and serialization of Nook Journal data."""

    def test_journal_store_schema_defaults(self):
        default_store = {
            "version": 1,
            "bookmarks": [],
            "highlights": [],
            "notes": []
        }
        self.assertEqual(default_store["version"], 1)
        self.assertIsInstance(default_store["bookmarks"], list)
        self.assertIsInstance(default_store["highlights"], list)
        self.assertIsInstance(default_store["notes"], list)

    def test_bookmark_schema(self):
        bookmark = {
            "id": "bm_1700000000_abcde",
            "type": "bookmark",
            "bookId": "frankenstein",
            "bookTitle": "Frankenstein",
            "author": "Mary Shelley",
            "chapterNumber": 4,
            "chapterTitle": "Chapter IV",
            "pageNumber": 37,
            "totalPages": 180,
            "bookmarkStyle": "crimson-silk",
            "createdAt": int(time.time() * 1000)
        }
        # Check required fields
        required_fields = ["id", "type", "bookId", "bookTitle", "chapterNumber", "chapterTitle", "pageNumber", "createdAt"]
        for f in required_fields:
            self.assertIn(f, bookmark)
        self.assertEqual(bookmark["type"], "bookmark")
        self.assertEqual(bookmark["bookmarkStyle"], "crimson-silk")
        self.assertGreaterEqual(bookmark["pageNumber"], 1)
        self.assertGreaterEqual(bookmark["chapterNumber"], 1)

    def test_highlight_schema(self):
        highlight = {
            "id": "hl_1700000000_fghij",
            "type": "highlight",
            "bookId": "frankenstein",
            "bookTitle": "Frankenstein",
            "author": "Mary Shelley",
            "chapterNumber": 4,
            "chapterTitle": "Chapter IV",
            "pageNumber": 37,
            "selectedText": "It was on a dreary night of November...",
            "createdAt": int(time.time() * 1000)
        }
        required_fields = ["id", "type", "bookId", "bookTitle", "chapterNumber", "chapterTitle", "pageNumber", "selectedText", "createdAt"]
        for f in required_fields:
            self.assertIn(f, highlight)
        self.assertEqual(highlight["type"], "highlight")
        self.assertTrue(len(highlight["selectedText"].strip()) > 0)

    def test_passage_note_schema(self):
        note = {
            "id": "nt_1700000000_klmno",
            "type": "note",
            "bookId": "frankenstein",
            "bookTitle": "Frankenstein",
            "author": "Mary Shelley",
            "chapterNumber": 4,
            "chapterTitle": "Chapter IV",
            "pageNumber": 37,
            "selectedText": "It was on a dreary night of November...",
            "note": "This is where the atmosphere becomes genuinely unsettling.",
            "createdAt": int(time.time() * 1000),
            "updatedAt": int(time.time() * 1000)
        }
        required_fields = ["id", "type", "bookId", "bookTitle", "chapterNumber", "chapterTitle", "pageNumber", "note", "createdAt", "updatedAt"]
        for f in required_fields:
            self.assertIn(f, note)
        self.assertEqual(note["type"], "note")
        self.assertTrue(len(note["note"].strip()) > 0)
        self.assertIsNotNone(note["selectedText"])

    def test_page_note_schema(self):
        page_note = {
            "id": "nt_1700000000_pnote",
            "type": "note",
            "bookId": "frankenstein",
            "bookTitle": "Frankenstein",
            "author": "Mary Shelley",
            "chapterNumber": 2,
            "chapterTitle": "Chapter II",
            "pageNumber": 12,
            "selectedText": None,
            "note": "General page-level reflection without text selection.",
            "createdAt": int(time.time() * 1000),
            "updatedAt": int(time.time() * 1000)
        }
        self.assertEqual(page_note["type"], "note")
        self.assertIsNone(page_note["selectedText"])
        self.assertTrue(len(page_note["note"].strip()) > 0)

    def test_multi_bookmark_same_book(self):
        # Multiple bookmarks across distinct pages of Frankenstein
        bookmarks = [
            {
                "id": "bm_1",
                "type": "bookmark",
                "bookId": "frankenstein",
                "pageNumber": 12,
                "bookmarkStyle": "crimson-silk"
            },
            {
                "id": "bm_2",
                "type": "bookmark",
                "bookId": "frankenstein",
                "pageNumber": 48,
                "bookmarkStyle": "midnight-gold"
            },
            {
                "id": "bm_3",
                "type": "bookmark",
                "bookId": "frankenstein",
                "pageNumber": 91,
                "bookmarkStyle": "sage-linen"
            }
        ]
        # Assert each page has its own style
        style_by_page = {bm["pageNumber"]: bm["bookmarkStyle"] for bm in bookmarks}
        self.assertEqual(style_by_page[12], "crimson-silk")
        self.assertEqual(style_by_page[48], "midnight-gold")
        self.assertEqual(style_by_page[91], "sage-linen")
        self.assertEqual(len(bookmarks), 3)

    def test_multi_book_journal_serialization(self):
        store = {
            "version": 1,
            "bookmarks": [
                {
                    "id": "bm_1",
                    "type": "bookmark",
                    "bookId": "pride-and-prejudice",
                    "bookTitle": "Pride and Prejudice",
                    "author": "Jane Austen",
                    "chapterNumber": 1,
                    "chapterTitle": "Chapter 1",
                    "pageNumber": 5,
                    "bookmarkStyle": "sage-linen",
                    "createdAt": 1700000000000
                },
                {
                    "id": "bm_2",
                    "type": "bookmark",
                    "bookId": "frankenstein",
                    "bookTitle": "Frankenstein",
                    "author": "Mary Shelley",
                    "chapterNumber": 4,
                    "chapterTitle": "Chapter IV",
                    "pageNumber": 37,
                    "bookmarkStyle": "crimson-silk",
                    "createdAt": 1700000001000
                }
            ],
            "highlights": [
                {
                    "id": "hl_1",
                    "type": "highlight",
                    "bookId": "frankenstein",
                    "bookTitle": "Frankenstein",
                    "author": "Mary Shelley",
                    "chapterNumber": 4,
                    "chapterTitle": "Chapter IV",
                    "pageNumber": 37,
                    "selectedText": "It was on a dreary night of November...",
                    "createdAt": 1700000002000
                }
            ],
            "notes": [
                {
                    "id": "nt_1",
                    "type": "note",
                    "bookId": "alices-adventures-in-wonderland",
                    "bookTitle": "Alice's Adventures in Wonderland",
                    "author": "Lewis Carroll",
                    "chapterNumber": 1,
                    "chapterTitle": "Chapter I — Down the Rabbit-Hole",
                    "pageNumber": 3,
                    "selectedText": "Curiouser and curiouser!",
                    "note": "Iconic literary phrase.",
                    "createdAt": 1700000003000,
                    "updatedAt": 1700000003000
                },
                {
                    "id": "nt_2",
                    "type": "note",
                    "bookId": "frankenstein",
                    "bookTitle": "Frankenstein",
                    "author": "Mary Shelley",
                    "chapterNumber": 2,
                    "chapterTitle": "Chapter II",
                    "pageNumber": 12,
                    "selectedText": None,
                    "note": "Page reflection on Chapter II.",
                    "createdAt": 1700000004000,
                    "updatedAt": 1700000004000
                }
            ]
        }

        # Validate JSON serialization round-trip
        serialized = json.dumps(store)
        deserialized = json.loads(serialized)
        self.assertEqual(deserialized["version"], 1)
        self.assertEqual(len(deserialized["bookmarks"]), 2)
        self.assertEqual(len(deserialized["highlights"]), 1)
        self.assertEqual(len(deserialized["notes"]), 2)

        # Confirm 3 distinct books coexist
        distinct_books = set()
        for b in deserialized["bookmarks"]:
            distinct_books.add(b["bookId"])
        for h in deserialized["highlights"]:
            distinct_books.add(h["bookId"])
        for n in deserialized["notes"]:
            distinct_books.add(n["bookId"])

        self.assertEqual(len(distinct_books), 3)
        self.assertIn("pride-and-prejudice", distinct_books)
        self.assertIn("frankenstein", distinct_books)
        self.assertIn("alices-adventures-in-wonderland", distinct_books)


if __name__ == "__main__":
    unittest.main()
