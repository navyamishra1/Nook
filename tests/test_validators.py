"""Unit tests for provenance and schema validators."""

import unittest

from ingestion.exceptions import (
    InvalidValueError,
    MissingFieldError,
    ProvenanceError,
)
from ingestion.validators import (
    validate_book_schema,
    validate_provenance,
    validate_url,
)


class TestValidators(unittest.TestCase):
    """Test suite for strict provenance and schema validation."""

    def setUp(self) -> None:
        self.valid_provenance = {
            "source": "standard-ebooks",
            "source_url": "https://standardebooks.org/ebooks/mary-shelley/frankenstein",
            "source_identifier": "mary-shelley/frankenstein",
            "license_or_rights": "Public Domain (CC0 1.0 Universal)",
        }

        self.valid_book_data = {
            "id": "frankenstein",
            "title": "Frankenstein",
            "author": "Mary Shelley",
            "language": "en",
            "description": "Gothic classic.",
            "cover": "covers/frankenstein.webp",
            "source": "standard-ebooks",
            "source_url": "https://standardebooks.org/ebooks/mary-shelley/frankenstein",
            "source_identifier": "mary-shelley/frankenstein",
            "license_or_rights": "Public Domain (CC0 1.0 Universal)",
            "publication_year": 1818,
            "categories": ["Gothic", "Horror"],
            "text_location": "data/books/frankenstein/content.json",
            "word_count": 75000,
            "estimated_reading_time": 334,
        }

    # --- Provenance Validation Tests ---

    def test_valid_provenance_passes(self) -> None:
        """Valid provenance dictionary should validate without raising exceptions."""
        try:
            validate_provenance(self.valid_provenance)
        except ProvenanceError as e:
            self.fail(f"Valid provenance raised ProvenanceError unexpectedly: {e}")

    def test_missing_source(self) -> None:
        """Missing or empty 'source' must raise ProvenanceError."""
        data = dict(self.valid_provenance)
        del data["source"]
        with self.assertRaises(ProvenanceError) as ctx:
            validate_provenance(data)
        self.assertIn("source", str(ctx.exception))

        data["source"] = "   "
        with self.assertRaises(ProvenanceError):
            validate_provenance(data)

    def test_unsupported_source(self) -> None:
        """Unrecognized source repository must raise ProvenanceError."""
        data = dict(self.valid_provenance)
        data["source"] = "pirate-library-unauthorized"
        with self.assertRaises(ProvenanceError) as ctx:
            validate_provenance(data)
        self.assertIn("Unsupported or unrecognized book source", str(ctx.exception))

    def test_missing_source_url(self) -> None:
        """Missing or invalid 'source_url' must raise ProvenanceError."""
        data = dict(self.valid_provenance)
        del data["source_url"]
        with self.assertRaises(ProvenanceError) as ctx:
            validate_provenance(data)
        self.assertIn("source_url", str(ctx.exception))

        data["source_url"] = "not-a-valid-url"
        with self.assertRaises(ProvenanceError) as ctx:
            validate_provenance(data)
        self.assertIn("must be a valid HTTP or HTTPS URL", str(ctx.exception))

    def test_missing_source_identifier(self) -> None:
        """Missing or empty 'source_identifier' must raise ProvenanceError."""
        data = dict(self.valid_provenance)
        del data["source_identifier"]
        with self.assertRaises(ProvenanceError) as ctx:
            validate_provenance(data)
        self.assertIn("source_identifier", str(ctx.exception))

        data["source_identifier"] = ""
        with self.assertRaises(ProvenanceError):
            validate_provenance(data)

    def test_missing_license_or_rights(self) -> None:
        """Missing or empty 'license_or_rights' must raise ProvenanceError."""
        data = dict(self.valid_provenance)
        del data["license_or_rights"]
        with self.assertRaises(ProvenanceError) as ctx:
            validate_provenance(data)
        self.assertIn("license_or_rights", str(ctx.exception))

        data["license_or_rights"] = "   "
        with self.assertRaises(ProvenanceError):
            validate_provenance(data)

    # --- Full Schema Validation Tests ---

    def test_valid_book_schema_passes(self) -> None:
        """Complete book record must validate cleanly."""
        try:
            validate_book_schema(self.valid_book_data)
        except Exception as e:
            self.fail(f"validate_book_schema failed unexpectedly: {e}")

    def test_invalid_publication_year_range(self) -> None:
        """Publication years outside reasonable historical range must raise InvalidValueError."""
        data = dict(self.valid_book_data)
        data["publication_year"] = 9999
        with self.assertRaises(InvalidValueError) as ctx:
            validate_book_schema(data)
        self.assertIn("publication_year", str(ctx.exception))

    def test_invalid_id_format(self) -> None:
        """Book IDs with invalid characters must be rejected."""
        data = dict(self.valid_book_data)
        data["id"] = "invalid id with spaces & symbols!"
        with self.assertRaises(InvalidValueError) as ctx:
            validate_book_schema(data)
        self.assertIn("Field 'id' must be a valid alphanumeric slug", str(ctx.exception))

    def test_validate_url_helper(self) -> None:
        """Test URL validator with various valid and invalid formats."""
        self.assertEqual(
            validate_url("https://standardebooks.org/ebooks/1"),
            "https://standardebooks.org/ebooks/1",
        )
        with self.assertRaises(InvalidValueError):
            validate_url("ftp://ftp.example.com", field_name="other_url")


if __name__ == "__main__":
    unittest.main()
