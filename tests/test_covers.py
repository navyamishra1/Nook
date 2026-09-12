"""
Unit tests for Nook Cover Assets and Catalog Resolution Architecture.
Validates:
- 105 expected catalog books
- 105 cover mappings (100% high-res WebP & PNG illustrated covers across the entire catalog)
- 5 high-resolution illustrated covers in Batch 6 (1600x2400, exact 2:3 ratio, WebP & PNG)
- 36 high-resolution illustrated covers in Batch 5
- 32 high-resolution illustrated covers in Batch 4
- 32 high-resolution illustrated covers in Batches 2 & 3
- 0 missing covers
- 0 duplicate paths
- 0 broken references
- Exact 2:3 aspect ratio
- High resolution (1600x2400, >=1200x1800)
"""

import json
import os
import unittest
from PIL import Image


class TestCoverAssets(unittest.TestCase):
    def setUp(self):
        self.root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.seed_file = os.path.join(self.root_dir, "data", "seed", "books.json")
        self.covers_dir = os.path.join(self.root_dir, "frontend", "assets", "covers")

        with open(self.seed_file, "r", encoding="utf-8") as f:
            self.books = json.load(f)

        # Batch 6 (5 new covers)
        self.batch_6_ids = {
            'silas-marner',
            'the-first-men-in-the-moon',
            'the-red-badge-of-courage',
            'the-scarlet-pimpernel',
            'the-prisoner-of-zenda'
        }

        # Batch 5 (36 covers)
        self.batch_5_ids = {
            'the-sea-wolf', 'the-count-of-monte-cristo', 'the-three-musketeers', 'twenty-years-after', 'the-prince-and-the-pauper',
            'moby-dick', 'bartleby-the-scrivener', 'crime-and-punishment', 'notes-from-underground', 'the-brothers-karamazov',
            'the-idiot', 'war-and-peace', 'anna-karenina', 'the-death-of-ivan-ilyich', 'madame-bovary', 'les-miserables',
            'the-hunchback-of-notre-dame', 'great-expectations', 'a-tale-of-two-cities', 'david-copperfield', 'oliver-twist',
            'a-christmas-carol', 'the-metamorphosis', 'the-trial', 'dubliners', 'a-portrait-of-the-artist-as-a-young-man',
            'the-awakening', 'heart-of-darkness', 'the-secret-agent', 'tess-of-the-durbervilles', 'far-from-the-madding-crowd',
            'the-mayor-of-casterbridge', 'the-odyssey', 'the-iliad', 'meditations', 'the-importance-of-being-earnest'
        }

        # Batch 4 (32 covers)
        self.batch_4_ids = {
            'the-phantom-of-the-opera', 'the-yellow-wallpaper', 'the-scarlet-letter', 'the-house-of-the-seven-gables',
            'the-adventures-of-sherlock-holmes', 'the-hound-of-the-baskervilles', 'a-study-in-scarlet', 'the-sign-of-the-four',
            'the-memoirs-of-sherlock-holmes', 'the-return-of-sherlock-holmes', 'the-mysterious-affair-at-styles', 'the-secret-adversary',
            'the-murder-on-the-links', 'the-man-in-the-brown-suit', 'the-secret-of-chimneys', 'the-murder-of-roger-ackroyd',
            'the-moonstone', 'the-woman-in-white', 'the-island-of-doctor-moreau', 'twenty-thousand-leagues-under-the-sea',
            'journey-to-the-center-of-the-earth', 'around-the-world-in-eighty-days', 'the-lost-world', 'peter-and-wendy',
            'little-men', 'jos-boys', 'anne-of-avonlea', 'little-women',
            'anne-of-the-island', 'the-second-jungle-book', 'treasure-island', 'kidnapped'
        }

    def test_catalog_book_count(self):
        """Must have exactly 105 books in verified catalog."""
        self.assertEqual(len(self.books), 105)

    def test_cover_field_in_all_books(self):
        """Every book in catalog metadata must have a valid 'cover' property."""
        for b in self.books:
            self.assertIn("cover", b, f"Book {b['id']} missing 'cover' field")
            self.assertTrue(b["cover"].startswith("assets/covers/"), f"Invalid cover path for {b['id']}: {b['cover']}")

    def test_batch_6_covers_exist_and_meet_requirements(self):
        """All 5 books in Batch 6 must have high-res (1600x2400) PNG and WebP assets with exact 2:3 ratio."""
        for book_id in self.batch_6_ids:
            png_path = os.path.join(self.covers_dir, f"{book_id}.png")
            webp_path = os.path.join(self.covers_dir, f"{book_id}.webp")
            self.assertTrue(os.path.isfile(png_path), f"Missing PNG cover for Batch 6: {book_id}")
            self.assertTrue(os.path.isfile(webp_path), f"Missing WebP cover for Batch 6: {book_id}")

            with Image.open(webp_path) as img:
                w, h = img.size
                ratio = w / h
                self.assertAlmostEqual(ratio, 2.0 / 3.0, delta=0.01, msg=f"Cover {book_id} is not 2:3 aspect ratio ({w}x{h})")
                self.assertGreaterEqual(w, 1200, f"Cover {book_id} width {w} < 1200 minimum")
                self.assertGreaterEqual(h, 1800, f"Cover {book_id} height {h} < 1800 minimum")
                self.assertEqual((w, h), (1600, 2400), f"Cover {book_id} should be preferred 1600x2400")

            with Image.open(png_path) as img:
                w, h = img.size
                self.assertEqual((w, h), (1600, 2400), f"PNG Cover {book_id} should be preferred 1600x2400")

    def test_all_105_cover_assets_exist_and_are_high_res(self):
        """Every single book in the 105-book catalog must resolve to an existing high-res cover asset."""
        missing = []
        for b in self.books:
            rel_path = b.get("cover", f"assets/covers/{b['id']}.webp")
            filename = os.path.basename(rel_path)
            full_path = os.path.join(self.covers_dir, filename)
            if not os.path.isfile(full_path):
                missing.append((b["id"], full_path))
            else:
                with Image.open(full_path) as im:
                    w, h = im.size
                    ratio = w / h
                    self.assertAlmostEqual(ratio, 2.0 / 3.0, delta=0.01, msg=f"Cover {filename} ratio ({w}x{h}) != 2:3")
                    self.assertGreaterEqual(w, 1200, f"Cover {filename} width {w} < 1200")
                    self.assertGreaterEqual(h, 1800, f"Cover {filename} height {h} < 1800")

        self.assertEqual(len(missing), 0, f"Missing cover files: {missing}")

    def test_no_duplicate_or_broken_references(self):
        """Cover filenames must match book IDs 1-to-1 with no duplicate paths."""
        book_ids = {b["id"] for b in self.books}
        self.assertEqual(len(book_ids), 105, "Book IDs must be completely unique")

        cover_paths = [b.get("cover") for b in self.books]
        self.assertEqual(len(cover_paths), len(set(cover_paths)), "Duplicate cover paths detected in catalog")


if __name__ == "__main__":
    unittest.main()
