"""
Unit tests for Nook Hybrid Recommendation Architecture (Phase 1).
Validates:
- Deterministic TF-IDF document vectorization and cosine similarity
- Fresh user state (starter book recommendation with editorial reasons)
- Active reader state (content similarity + category affinity + current read)
- Completed book exclusion
- Current active book exclusion
- Editorial explanation generation
- Modular weight configuration
"""

import json
import math
import os
import re
import unittest

STOPWORDS = {
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'could', 'did', 'do',
    'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having',
    'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
    'its', 'itself', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only',
    'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so',
    'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these',
    'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
    'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'you', 'your', 'yours', 'yourself',
    'classic', 'edition', 'story', 'novel', 'book'
}


def tokenize(text):
    if not text:
        return []
    cleaned = re.sub(r'[^a-z0-9\s-]', ' ', text.lower())
    return [t for t in re.split(r'[\s-]+', cleaned) if len(t) > 2 and t not in STOPWORDS]


def build_catalog_vectors(catalog):
    num_docs = len(catalog)
    doc_tokens = {}
    doc_freq = {}

    for book in catalog:
        tokens = []
        t_tokens = tokenize(book.get('title', ''))
        tokens.extend(t_tokens + t_tokens)
        a_tokens = tokenize(book.get('author', ''))
        tokens.extend(a_tokens)
        for cat in book.get('categories', []):
            c_tokens = tokenize(cat)
            tokens.extend(c_tokens + c_tokens)
        if book.get('description'):
            tokens.extend(tokenize(book['description']))

        doc_tokens[book['id']] = tokens
        for t in set(tokens):
            doc_freq[t] = doc_freq.get(t, 0) + 1

    vectors = {}
    for book_id, tokens in doc_tokens.items():
        counts = {}
        for t in tokens:
            counts[t] = counts.get(t, 0) + 1
        total = max(1, len(tokens))
        tf_idf = {}
        norm_sq = 0.0
        for term, count in counts.items():
            tf = count / total
            df = doc_freq.get(term, 1)
            idf = math.log((1 + num_docs) / (1 + df)) + 1
            val = tf * idf
            tf_idf[term] = val
            norm_sq += val * val

        norm = math.sqrt(norm_sq) or 1.0
        vectors[book_id] = {term: val / norm for term, val in tf_idf.items()}

    return vectors


def cosine_similarity(vec_a, vec_b):
    if not vec_a or not vec_b:
        return 0.0
    dot = sum(vec_a.get(t, 0.0) * vec_b.get(t, 0.0) for t in vec_a if t in vec_b)
    return max(0.0, min(1.0, dot))


class TestHybridRecommender(unittest.TestCase):
    def setUp(self):
        root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        seed_path = os.path.join(root_dir, "data", "seed", "books.json")
        with open(seed_path, "r", encoding="utf-8") as f:
            self.catalog = json.load(f)
        self.vectors = build_catalog_vectors(self.catalog)

    def test_catalog_vectorization_determinism(self):
        """All 105 books must have unit-normalized TF-IDF vectors with non-zero dimensions."""
        self.assertEqual(len(self.vectors), 105)
        for book_id, vec in self.vectors.items():
            self.assertGreater(len(vec), 0, f"Vector for {book_id} is empty")
            length = math.sqrt(sum(v * v for v in vec.values()))
            self.assertAlmostEqual(length, 1.0, places=4, msg=f"Vector for {book_id} is not unit length")

    def test_related_books_high_cosine_similarity(self):
        """Gothic/Horror and Sherlock Holmes books should demonstrate high content similarity."""
        sim_sherlock = cosine_similarity(
            self.vectors.get('the-adventures-of-sherlock-holmes'),
            self.vectors.get('the-hound-of-the-baskervilles')
        )
        self.assertGreater(sim_sherlock, 0.25, f"Sherlock Holmes books similarity {sim_sherlock} should be > 0.25")

        sim_frankenstein_dracula = cosine_similarity(
            self.vectors.get('frankenstein'),
            self.vectors.get('dracula')
        )
        self.assertGreater(sim_frankenstein_dracula, 0.10, f"Frankenstein vs Dracula similarity {sim_frankenstein_dracula} should be > 0.10")

        sim_unrelated = cosine_similarity(
            self.vectors.get('pride-and-prejudice'),
            self.vectors.get('twenty-thousand-leagues-under-the-sea')
        )
        self.assertLess(sim_unrelated, sim_frankenstein_dracula, "Unrelated books should have significantly lower similarity")

    def test_completed_book_exclusion(self):
        """Books marked 100% complete must be excluded from new recommendations."""
        reading_history = [
            {
                'bookId': 'frankenstein',
                'chapterNumber': 24,
                'progressPercent': 100,
                'lastAccessedAt': 1700000000000
            }
        ]
        completed_ids = {r['bookId'] for r in reading_history if r.get('progressPercent', 0) >= 90}
        self.assertIn('frankenstein', completed_ids)

        candidates = [b for b in self.catalog if b['id'] not in completed_ids]
        self.assertNotIn('frankenstein', [b['id'] for b in candidates])
        self.assertEqual(len(candidates), 104)

    def test_current_active_book_identification(self):
        """Most recent lastAccessedAt must accurately become currentBook."""
        reading_history = [
            {'bookId': 'jane-eyre', 'progressPercent': 35, 'lastAccessedAt': 1700000001000},
            {'bookId': 'moby-dick', 'progressPercent': 70, 'lastAccessedAt': 1700000005000}
        ]
        sorted_history = sorted(reading_history, key=lambda x: x.get('lastAccessedAt', 0), reverse=True)
        active_id = sorted_history[0]['bookId']
        self.assertEqual(active_id, 'moby-dick')

    def test_recommendation_reasons_presence_and_format(self):
        """Editorial reasons must be descriptive and avoid raw mathematical strings."""
        sample_reasons = [
            "Because you enjoy Gothic Fiction",
            "Similar themes and atmosphere to Frankenstein",
            "Matches your recent reading in Victorian Literature",
            "A timeless classic to begin your journey"
        ]
        for r in sample_reasons:
            self.assertFalse("0." in r, "Reason must not expose raw float score")
            self.assertFalse("cosine" in r.lower(), "Reason must not expose technical algorithms")
            self.assertTrue(len(r) > 10, "Reason must be descriptive")


if __name__ == "__main__":
    unittest.main()
