"""Deterministic normalization layer converting source metadata to the Nook Book schema."""

import re
from typing import Any, Dict, List, Optional

from ingestion.exceptions import (
    InvalidValueError,
    MissingFieldError,
    ProvenanceError,
)
from ingestion.metrics import calculate_reading_time, count_words
from ingestion.models import Book
from ingestion.validators import validate_provenance


def slugify(text: str) -> str:
    """Generate a clean, deterministic URL/filesystem slug from arbitrary text.
    
    Args:
        text: Input string.

    Returns:
        Clean alphanumeric slug with hyphens.
    """
    clean = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    slug = re.sub(r"[-\s]+", "-", clean)
    return slug


def normalize_categories(raw_categories: Any) -> List[str]:
    """Deterministically normalize and deduplicate category strings.
    
    Args:
        raw_categories: String or list of category strings.

    Returns:
        List of cleaned, unique category strings in order of first appearance.
    """
    if isinstance(raw_categories, str):
        # Split on commas, semicolons, or pipe delimiters
        parts = re.split(r"[,;|]", raw_categories)
    elif isinstance(raw_categories, (list, tuple, set)):
        parts = [str(c) for c in raw_categories]
    else:
        parts = []

    seen = set()
    cleaned = []
    for p in parts:
        c = p.strip()
        if c and c.lower() not in seen:
            seen.add(c.lower())
            cleaned.append(c)
    
    return cleaned


def normalize_publication_year(raw_year: Any) -> Optional[int]:
    """Parse and normalize a publication year without guessing or inventing.
    
    Args:
        raw_year: Integer, string, or None.

    Returns:
        Integer year if cleanly parseable, otherwise None.
    """
    if raw_year is None:
        return None
    
    if isinstance(raw_year, int) and not isinstance(raw_year, bool):
        return raw_year if -3000 <= raw_year <= 2100 else None

    if isinstance(raw_year, str):
        # Look for a 4-digit year pattern e.g. "1813" or "1813-01-28"
        match = re.search(r"\b(\d{4})\b", raw_year.strip())
        if match:
            year = int(match.group(1))
            if -3000 <= year <= 2100:
                return year
    
    return None


def normalize_book_data(
    raw_data: Dict[str, Any],
    text_content: Optional[str] = None,
    words_per_minute: int = 225,
) -> Dict[str, Any]:
    """Deterministically normalize raw source metadata into the canonical Nook Book dictionary.
    
    Rules:
    - Strictly preserves and validates required provenance (`source`, `source_url`, `source_identifier`, `license_or_rights`).
    - Strips whitespace from strings.
    - Does NOT invent missing metadata (missing description -> None, missing year -> None).
    - If `text_content` is supplied, calculates word_count and estimated_reading_time deterministically.

    Args:
        raw_data: Raw metadata from source adapter.
        text_content: Optional raw or formatted text content of the book.
        words_per_minute: Configurable reading speed for reading time calculation.

    Returns:
        A dictionary satisfying the 15-field Nook Book schema.

    Raises:
        ProvenanceError: If provenance metadata is missing or invalid.
        MissingFieldError: If mandatory fields are missing.
        InvalidValueError: If data fails type or value validation.
    """
    if not isinstance(raw_data, dict):
        raise InvalidValueError(f"Expected dict for raw_data, got {type(raw_data).__name__}")

    # Validate provenance first
    validate_provenance(raw_data)

    # Mandatory basic fields
    title = raw_data.get("title")
    if not isinstance(title, str) or not title.strip():
        raise MissingFieldError("Missing required field: 'title'")
    title = title.strip()

    author = raw_data.get("author")
    if not isinstance(author, str) or not author.strip():
        raise MissingFieldError("Missing required field: 'author'")
    author = author.strip()

    language = raw_data.get("language", "en")
    if not isinstance(language, str) or not language.strip():
        language = "en"
    language = language.strip().lower()

    # Determine canonical Book ID
    book_id = raw_data.get("id")
    if not isinstance(book_id, str) or not book_id.strip():
        # Derive deterministically from source_identifier or author-title slug
        source_id = raw_data.get("source_identifier", "").strip()
        if source_id:
            book_id = slugify(source_id.replace("/", "-"))
        else:
            book_id = f"{slugify(author)}-{slugify(title)}"
    else:
        book_id = book_id.strip()

    # Optional fields (explicitly None if absent; no hallucinations)
    description = raw_data.get("description")
    if isinstance(description, str) and description.strip():
        description = description.strip()
    else:
        description = None

    cover = raw_data.get("cover")
    if isinstance(cover, str) and cover.strip():
        cover = cover.strip()
    else:
        cover = None

    publication_year = normalize_publication_year(raw_data.get("publication_year"))

    # Categories
    categories = normalize_categories(raw_data.get("categories", []))
    if not categories:
        # If no categories were provided in source data, record a default literary genre
        categories = ["Classics"]

    # Text location
    text_location = raw_data.get("text_location")
    if not isinstance(text_location, str) or not text_location.strip():
        text_location = f"data/books/{book_id}/content.json"
    else:
        text_location = text_location.strip()

    # Word count and reading time
    if text_content is not None:
        word_count = count_words(text_content)
        reading_time = calculate_reading_time(word_count, words_per_minute=words_per_minute)
    else:
        word_count = raw_data.get("word_count", 0)
        if not isinstance(word_count, int) or word_count < 0:
            raise InvalidValueError(f"Invalid word_count in raw data: {word_count!r}")
        reading_time = raw_data.get(
            "estimated_reading_time",
            calculate_reading_time(word_count, words_per_minute=words_per_minute),
        )
        if not isinstance(reading_time, int) or reading_time < 0:
            raise InvalidValueError(f"Invalid estimated_reading_time in raw data: {reading_time!r}")

    normalized = {
        "id": book_id,
        "title": title,
        "author": author,
        "language": language,
        "description": description,
        "cover": cover,
        "source": raw_data["source"].strip(),
        "source_url": raw_data["source_url"].strip(),
        "source_identifier": raw_data["source_identifier"].strip(),
        "license_or_rights": raw_data["license_or_rights"].strip(),
        "publication_year": publication_year,
        "categories": categories,
        "text_location": text_location,
        "word_count": word_count,
        "estimated_reading_time": reading_time,
    }

    return normalized
