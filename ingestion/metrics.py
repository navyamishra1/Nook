"""Deterministic metrics calculation for book text (word counting and reading time)."""

import math
import re
from typing import Optional
from ingestion.exceptions import InvalidValueError

# Standard average silent reading speed for adult English narrative prose (words per minute)
DEFAULT_WORDS_PER_MINUTE: int = 225

# Precompiled regex for stripping HTML/XML tags
_HTML_TAG_REGEX = re.compile(r"<[^>]+>", re.DOTALL)

# Precompiled regex for word tokenization.
# Definition of a "word":
# Contiguous sequence of alphanumeric characters that may contain internal apostrophes
# or hyphens (e.g. "it's", "well-known", "rock'n'roll"), bounded by word boundaries.
_WORD_REGEX = re.compile(r"\b[a-zA-Z0-9]+(?:['’\-][a-zA-Z0-9]+)*\b", re.UNICODE)


def count_words(text: str) -> int:
    """Deterministically count the number of words in a given text string.
    
    Definition:
    - Strips all HTML/XML tags before counting to prevent markup inflation.
    - Normalizes typographer apostrophes (’ -> ').
    - Matches contiguous alphanumeric word tokens including contractions and hyphenated compounds.
    - Standalone punctuation, symbols, and whitespace are discarded.
    - Zero AI: purely deterministic regular expression tokenization.

    Args:
        text: Raw or markup-containing text string.

    Returns:
        Non-negative integer representing the total word count.
    
    Raises:
        InvalidValueError: If text is not a string.
    """
    if not isinstance(text, str):
        raise InvalidValueError(f"Expected text to be a str, got {type(text).__name__}")
    
    if not text.strip():
        return 0

    # 1. Strip HTML/XML tags
    clean_text = _HTML_TAG_REGEX.sub(" ", text)

    # 2. Normalize smart/curly apostrophes to standard single quote for uniform tokenization
    clean_text = clean_text.replace("’", "'")

    # 3. Extract tokens
    words = _WORD_REGEX.findall(clean_text)
    return len(words)


def calculate_reading_time(word_count: int, words_per_minute: int = DEFAULT_WORDS_PER_MINUTE) -> int:
    """Calculate estimated reading time in minutes from word count.
    
    Formula:
    - If word_count == 0: 0 minutes
    - If word_count > 0: math.ceil(word_count / words_per_minute)
    
    This ensures any non-empty text estimates at least 1 minute of reading time.

    Args:
        word_count: Total number of words (must be >= 0).
        words_per_minute: Reading speed constant in WPM (must be > 0).

    Returns:
        Estimated reading duration in minutes (integer >= 0).

    Raises:
        InvalidValueError: If word_count < 0 or words_per_minute <= 0 or non-integers.
    """
    if not isinstance(word_count, int) or isinstance(word_count, bool):
        raise InvalidValueError(f"word_count must be an integer, got {type(word_count).__name__}")
    
    if word_count < 0:
        raise InvalidValueError(f"word_count cannot be negative, got {word_count}")

    if not isinstance(words_per_minute, int) or isinstance(words_per_minute, bool):
        raise InvalidValueError(f"words_per_minute must be an integer, got {type(words_per_minute).__name__}")

    if words_per_minute <= 0:
        raise InvalidValueError(f"words_per_minute must be greater than 0, got {words_per_minute}")

    if word_count == 0:
        return 0

    return math.ceil(word_count / words_per_minute)
