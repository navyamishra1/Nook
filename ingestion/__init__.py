"""Nook Data Ingestion Package."""

from ingestion.exceptions import (
    DuplicateIdentifierError,
    InvalidValueError,
    MissingFieldError,
    NookError,
    NookValidationError,
    ProvenanceError,
)
from ingestion.metrics import DEFAULT_WORDS_PER_MINUTE, calculate_reading_time, count_words
from ingestion.models import Book
from ingestion.normalizer import normalize_book_data, normalize_categories, normalize_publication_year
from ingestion.pipeline import IngestionPipeline
from ingestion.validators import SUPPORTED_SOURCES, validate_book_schema, validate_provenance, validate_url

__all__ = [
    "Book",
    "IngestionPipeline",
    "NookError",
    "NookValidationError",
    "ProvenanceError",
    "MissingFieldError",
    "InvalidValueError",
    "DuplicateIdentifierError",
    "count_words",
    "calculate_reading_time",
    "DEFAULT_WORDS_PER_MINUTE",
    "normalize_book_data",
    "normalize_categories",
    "normalize_publication_year",
    "validate_book_schema",
    "validate_provenance",
    "validate_url",
    "SUPPORTED_SOURCES",
]
