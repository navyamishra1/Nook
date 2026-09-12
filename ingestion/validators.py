"""Deterministic validation rules for Nook Book models and provenance metadata."""

import re
from typing import Any, Dict, List, Set
from urllib.parse import urlparse

from ingestion.exceptions import (
    InvalidValueError,
    MissingFieldError,
    NookValidationError,
    ProvenanceError,
)

# Supported legitimate public-domain / open-license / discovery repositories
SUPPORTED_SOURCES: Set[str] = {
    "standard-ebooks",
    "project-gutenberg",
    "gutenberg",
    "open-library",
    "discovery-catalog",
    "publisher-catalog",
    "goodreads",
    "public-domain-archive",
}

# Valid ID slug pattern: alphanumeric characters, dashes, underscores, and single slashes
_ID_SLUG_REGEX = re.compile(r"^[a-zA-Z0-9_-]+(/[a-zA-Z0-9_-]+)*$")


def validate_url(url: str, field_name: str = "source_url") -> str:
    """Validate that a string is a well-formed HTTP/HTTPS URL.
    
    Args:
        url: URL string to validate.
        field_name: Field name for error reporting.

    Returns:
        The validated URL string stripped of surrounding whitespace.

    Raises:
        ProvenanceError: If field_name is 'source_url' and invalid.
        InvalidValueError: If other URL field is invalid.
    """
    if not isinstance(url, str) or not url.strip():
        err_cls = ProvenanceError if field_name == "source_url" else InvalidValueError
        raise err_cls(f"'{field_name}' must be a non-empty string.")
    
    clean_url = url.strip()
    parsed = urlparse(clean_url)
    if not (parsed.scheme in ("http", "https") and parsed.netloc):
        err_cls = ProvenanceError if field_name == "source_url" else InvalidValueError
        raise err_cls(
            f"'{field_name}' must be a valid HTTP or HTTPS URL, got: '{clean_url}'"
        )
    return clean_url


def validate_provenance(data: Dict[str, Any]) -> None:
    """Deterministically validate required provenance and licensing fields.
    
    Required Provenance Fields:
    1. 'source': Recognised legitimate repository identifier
    2. 'source_url': Canonical HTTP/HTTPS URL to the source edition
    3. 'source_identifier': Origin repository's unique book slug or ID
    4. 'license_or_rights': Explicit rights statement (not inferred or guessed)

    Args:
        data: Dictionary containing book metadata.

    Raises:
        ProvenanceError: If any provenance field is missing, empty, or invalid.
    """
    if not isinstance(data, dict):
        raise ProvenanceError(f"Expected dictionary for provenance validation, got {type(data).__name__}")

    # 1. Validate 'source'
    source = data.get("source")
    if not isinstance(source, str) or not source.strip():
        raise ProvenanceError("Missing required provenance field: 'source' (must be a non-empty string).")
    
    source = source.strip()
    if source not in SUPPORTED_SOURCES:
        raise ProvenanceError(
            f"Unsupported or unrecognized book source: '{source}'. "
            f"Supported sources are: {sorted(SUPPORTED_SOURCES)}"
        )

    # 2. Validate 'source_url'
    source_url = data.get("source_url")
    validate_url(source_url, field_name="source_url")

    # 3. Validate 'source_identifier'
    source_identifier = data.get("source_identifier")
    if not isinstance(source_identifier, str) or not source_identifier.strip():
        raise ProvenanceError(
            "Missing required provenance field: 'source_identifier' (must be a non-empty string)."
        )

    # 4. Validate 'license_or_rights'
    license_or_rights = data.get("license_or_rights")
    if not isinstance(license_or_rights, str) or not license_or_rights.strip():
        raise ProvenanceError(
            "Missing required provenance field: 'license_or_rights'. "
            "No book can enter Nook without an explicit source rights declaration."
        )


def validate_book_schema(data: Dict[str, Any]) -> None:
    """Strictly validate that a dictionary satisfies all 15 fields of the Book schema.
    
    Rejects invalid types, out-of-range numbers, and missing fields.
    Invalid records are rejected with descriptive exceptions rather than silently coerced.

    Args:
        data: Dictionary containing the complete book record.

    Raises:
        ProvenanceError: If provenance metadata is invalid.
        MissingFieldError: If a mandatory field is missing.
        InvalidValueError: If a field value violates type or range constraints.
    """
    if not isinstance(data, dict):
        raise NookValidationError(f"Expected dict for Book schema validation, got {type(data).__name__}")

    # First verify provenance constraints
    validate_provenance(data)

    # Required mandatory string fields
    required_string_fields = ["id", "title", "author", "language", "text_location"]
    for field in required_string_fields:
        if field not in data:
            raise MissingFieldError(f"Missing required field: '{field}'")
        val = data[field]
        if not isinstance(val, str) or not val.strip():
            raise InvalidValueError(f"Field '{field}' must be a non-empty string, got: {val!r}")

    # Validate ID slug format
    book_id = data["id"].strip()
    if not _ID_SLUG_REGEX.match(book_id):
        raise InvalidValueError(
            f"Field 'id' must be a valid alphanumeric slug with hyphens, underscores, or slashes, got: '{book_id}'"
        )

    # Validate optional string fields (must be None or non-empty string)
    optional_string_fields = ["description", "cover"]
    for field in optional_string_fields:
        if field in data and data[field] is not None:
            val = data[field]
            if not isinstance(val, str) or not val.strip():
                raise InvalidValueError(
                    f"Optional field '{field}' must be a non-empty string or None, got: {val!r}"
                )

    # Validate publication_year (optional int or None)
    if "publication_year" in data and data["publication_year"] is not None:
        year = data["publication_year"]
        if not isinstance(year, int) or isinstance(year, bool):
            raise InvalidValueError(
                f"Field 'publication_year' must be an integer or None, got {type(year).__name__}"
            )
        if year < -3000 or year > 2100:
            raise InvalidValueError(f"Field 'publication_year' out of valid range (-3000 to 2100), got: {year}")

    # Validate categories (must be a non-empty list of non-empty strings)
    if "categories" not in data:
        raise MissingFieldError("Missing required field: 'categories'")
    cats = data["categories"]
    if not isinstance(cats, list) or len(cats) == 0:
        raise InvalidValueError("Field 'categories' must be a non-empty list of category strings.")
    for idx, cat in enumerate(cats):
        if not isinstance(cat, str) or not cat.strip():
            raise InvalidValueError(
                f"Category at index {idx} must be a non-empty string, got: {cat!r}"
            )

    # Validate word_count (int >= 0)
    if "word_count" not in data:
        raise MissingFieldError("Missing required field: 'word_count'")
    wc = data["word_count"]
    if not isinstance(wc, int) or isinstance(wc, bool) or wc < 0:
        raise InvalidValueError(f"Field 'word_count' must be a non-negative integer, got: {wc!r}")

    # Validate estimated_reading_time (int >= 0)
    if "estimated_reading_time" not in data:
        raise MissingFieldError("Missing required field: 'estimated_reading_time'")
    ert = data["estimated_reading_time"]
    if not isinstance(ert, int) or isinstance(ert, bool) or ert < 0:
        raise InvalidValueError(
            f"Field 'estimated_reading_time' must be a non-negative integer, got: {ert!r}"
        )

    # Validate optional cover_config (dict or None)
    if "cover_config" in data and data["cover_config"] is not None:
        if not isinstance(data["cover_config"], dict):
            raise InvalidValueError(f"Field 'cover_config' must be a dictionary or None, got: {type(data['cover_config']).__name__}")

    # Validate optional reading_availability ('hostable' or 'discovery-only')
    if "reading_availability" in data and data["reading_availability"] is not None:
        avail = data["reading_availability"]
        if avail not in ("hostable", "discovery-only"):
            raise InvalidValueError(f"Field 'reading_availability' must be 'hostable' or 'discovery-only', got: {avail!r}")


def validate_content_structure(
    content: Dict[str, Any],
    min_chapters: int = 1,
    min_words: int = 100,
) -> int:
    """Strictly validate the full content JSON structure of a book.
    
    Verifies:
    - Proper dictionary structure and metadata.
    - 1-indexed, sequential, non-duplicated chapters.
    - Non-empty chapter titles and multi-paragraph content.
    - Plausible chapter and word count thresholds to reject stub / placeholder content.

    Args:
        content: Dictionary containing book content structure.
        min_chapters: Minimum required chapter count.
        min_words: Minimum total word count across all chapters.

    Returns:
        Total word count across all validated chapters.

    Raises:
        MissingFieldError: If required content fields are missing.
        InvalidValueError: If chapters, numbering, or word counts fail validation.
    """
    if not isinstance(content, dict):
        raise InvalidValueError(f"Expected dict for content validation, got {type(content).__name__}")

    for field in ["id", "title", "author", "chapters"]:
        if field not in content:
            raise MissingFieldError(f"Content JSON missing required field: '{field}'")
        if field != "chapters":
            val = content[field]
            if not isinstance(val, str) or not val.strip():
                raise InvalidValueError(f"Content field '{field}' must be a non-empty string.")

    chapters = content["chapters"]
    if not isinstance(chapters, list) or len(chapters) < min_chapters:
        raise InvalidValueError(
            f"Book '{content['id']}' must contain at least {min_chapters} chapters, got {len(chapters) if isinstance(chapters, list) else 0}"
        )

    total_words = 0
    seen_numbers = set()

    for idx, chap in enumerate(chapters):
        if not isinstance(chap, dict):
            raise InvalidValueError(f"Chapter at index {idx} in '{content['id']}' must be a dictionary.")

        for f in ["number", "title", "content"]:
            if f not in chap:
                raise MissingFieldError(f"Chapter at index {idx} missing required field '{f}' in '{content['id']}'")

        chap_num = chap["number"]
        if not isinstance(chap_num, int) or isinstance(chap_num, bool) or chap_num != idx + 1:
            raise InvalidValueError(
                f"Chapter at index {idx} in '{content['id']}' must have 1-indexed sequential number {idx + 1}, got: {chap_num}"
            )
        if chap_num in seen_numbers:
            raise InvalidValueError(f"Duplicate chapter number {chap_num} in '{content['id']}'")
        seen_numbers.add(chap_num)

        chap_title = chap["title"]
        if not isinstance(chap_title, str) or not chap_title.strip():
            raise InvalidValueError(f"Chapter {chap_num} in '{content['id']}' must have a non-empty title.")

        chap_content = chap["content"]
        if not isinstance(chap_content, str) or not chap_content.strip():
            raise InvalidValueError(f"Chapter {chap_num} in '{content['id']}' has empty content.")

        words = len(chap_content.split())
        total_words += words

    if total_words < min_words:
        raise InvalidValueError(
            f"Book '{content['id']}' failed content validation: total words ({total_words}) is below minimum threshold ({min_words}). "
            f"Placeholder stubs are strictly rejected."
        )

    return total_words

