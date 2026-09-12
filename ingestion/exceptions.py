"""Custom exceptions for Nook data ingestion and validation."""

class NookError(Exception):
    """Base exception for all Nook errors."""
    pass


class NookValidationError(NookError):
    """Raised when data fails schema or domain validation."""
    pass


class ProvenanceError(NookValidationError):
    """Raised when required provenance or licensing metadata is missing or invalid."""
    pass


class MissingFieldError(NookValidationError):
    """Raised when a required schema field is missing or empty."""
    pass


class InvalidValueError(NookValidationError):
    """Raised when a field value fails type, format, or range constraints."""
    pass


class DuplicateIdentifierError(NookValidationError):
    """Raised when duplicate book IDs or source identifiers are encountered."""
    pass
