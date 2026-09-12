"""Unit tests for deterministic metrics (word count and reading time)."""

import unittest

from ingestion.exceptions import InvalidValueError
from ingestion.metrics import (
    DEFAULT_WORDS_PER_MINUTE,
    calculate_reading_time,
    count_words,
)


class TestMetrics(unittest.TestCase):
    """Test suite for deterministic word counter and reading time calculations."""

    def test_empty_and_whitespace_text_word_count(self) -> None:
        """Empty or whitespace-only text must return 0 words."""
        self.assertEqual(count_words(""), 0)
        self.assertEqual(count_words("   \n\t  "), 0)

    def test_basic_prose_word_count(self) -> None:
        """Standard sentence word counting."""
        text = "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife."
        self.assertEqual(count_words(text), 23)

    def test_hyphenated_and_contractions_word_count(self) -> None:
        """Contractions and hyphenated words should be counted as single word units."""
        text = "It's well-known that they didn't think rock'n'roll was dead."
        # "It's" (1), "well-known" (1), "that" (1), "they" (1), "didn't" (1), "think" (1), "rock'n'roll" (1), "was" (1), "dead" (1) = 9
        self.assertEqual(count_words(text), 9)

    def test_html_markup_stripping_word_count(self) -> None:
        """HTML markup must not artificially inflate the word count."""
        raw_text = "A simple sentence."
        html_text = "<p class='intro'>A <strong>simple</strong> sentence.</p>"
        self.assertEqual(count_words(raw_text), count_words(html_text))
        self.assertEqual(count_words(html_text), 3)

    def test_smart_apostrophe_normalization(self) -> None:
        """Curly/smart apostrophes (’ vs ') should yield identical word counts."""
        text_straight = "Alice's adventures weren't simple."
        text_curly = "Alice’s adventures weren’t simple."
        self.assertEqual(count_words(text_straight), count_words(text_curly))
        self.assertEqual(count_words(text_curly), 4)

    def test_deterministic_consistency(self) -> None:
        """Calling count_words 100 times on the same text must always return the exact same count."""
        sample_text = (
            "Alice was beginning to get very tired of sitting by her sister on the bank, "
            "and of having nothing to do: once or twice she had peeped into the book her sister was reading..."
        )
        counts = [count_words(sample_text) for _ in range(100)]
        self.assertTrue(all(c == counts[0] for c in counts))
        self.assertEqual(counts[0], 34)

    def test_invalid_text_type_for_word_count(self) -> None:
        """Non-string inputs must raise InvalidValueError."""
        with self.assertRaises(InvalidValueError):
            count_words(None)  # type: ignore
        with self.assertRaises(InvalidValueError):
            count_words(12345)  # type: ignore

    # --- Reading Time Tests ---

    def test_reading_time_zero_words(self) -> None:
        """0 words should yield 0 minutes."""
        self.assertEqual(calculate_reading_time(0), 0)

    def test_reading_time_short_text_ceil(self) -> None:
        """Any text with 1 to 225 words must return at least 1 minute under default 225 WPM."""
        self.assertEqual(calculate_reading_time(1), 1)
        self.assertEqual(calculate_reading_time(50), 1)
        self.assertEqual(calculate_reading_time(225), 1)
        self.assertEqual(calculate_reading_time(226), 2)

    def test_reading_time_novel_length(self) -> None:
        """Test calculation on typical novel lengths."""
        # 122,189 words / 225 WPM = 543.06 -> ceil -> 544 minutes
        self.assertEqual(calculate_reading_time(122189, words_per_minute=225), 544)
        # 75,124 words / 225 WPM = 333.88 -> ceil -> 334 minutes
        self.assertEqual(calculate_reading_time(75124, words_per_minute=225), 334)

    def test_reading_time_custom_wpm(self) -> None:
        """Test custom WPM rates (e.g. 300 WPM fast reader, 150 WPM slow reader)."""
        self.assertEqual(calculate_reading_time(600, words_per_minute=300), 2)
        self.assertEqual(calculate_reading_time(600, words_per_minute=150), 4)

    def test_invalid_reading_time_parameters(self) -> None:
        """Negative words or invalid WPM must raise InvalidValueError."""
        with self.assertRaises(InvalidValueError):
            calculate_reading_time(-10)
        with self.assertRaises(InvalidValueError):
            calculate_reading_time(100, words_per_minute=0)
        with self.assertRaises(InvalidValueError):
            calculate_reading_time(100, words_per_minute=-200)


if __name__ == "__main__":
    unittest.main()
