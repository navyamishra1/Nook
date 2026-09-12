"""Formal Book data model for Nook with strict schema validation."""

from dataclasses import asdict, dataclass, field
import json
from typing import Any, Dict, List, Optional

from ingestion.validators import validate_book_schema


@dataclass(frozen=True)
class Book:
    """Canonical Book record representing a verified edition in Nook.
    
    All 15 fields correspond strictly to docs/architecture.md.
    Instances are immutable and validated upon creation.
    """
    id: str
    title: str
    author: str
    language: str
    source: str
    source_url: str
    source_identifier: str
    license_or_rights: str
    categories: List[str]
    text_location: str
    word_count: int
    estimated_reading_time: int
    description: Optional[str] = None
    cover: Optional[str] = None
    publication_year: Optional[int] = None
    cover_config: Optional[Dict[str, Any]] = None
    reading_availability: Optional[str] = "hostable"

    def __post_init__(self) -> None:
        """Enforce strict validation on initialization."""
        # Convert to dictionary representation for validation
        data = self.to_dict()
        validate_book_schema(data)

    def to_dict(self) -> Dict[str, Any]:
        """Convert Book instance to a clean, serializable dictionary."""
        d = {
            "id": self.id,
            "title": self.title,
            "author": self.author,
            "language": self.language,
            "description": self.description,
            "cover": self.cover,
            "source": self.source,
            "source_url": self.source_url,
            "source_identifier": self.source_identifier,
            "license_or_rights": self.license_or_rights,
            "publication_year": self.publication_year,
            "categories": list(self.categories) if isinstance(self.categories, list) else self.categories,
            "text_location": self.text_location,
            "word_count": self.word_count,
            "estimated_reading_time": self.estimated_reading_time,
        }
        if self.cover_config is not None:
            d["cover_config"] = self.cover_config
        if self.reading_availability is not None:
            d["reading_availability"] = self.reading_availability
        return d

    def to_json(self, indent: int = 2) -> str:
        """Serialize Book instance to formatted JSON string."""
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Book":
        """Instantiate and strictly validate a Book from a dictionary.
        
        Args:
            data: Dictionary containing book fields.

        Returns:
            Validated immutable Book instance.

        Raises:
            NookValidationError: If data fails schema or provenance constraints.
        """
        validate_book_schema(data)
        return cls(
            id=data["id"].strip(),
            title=data["title"].strip(),
            author=data["author"].strip(),
            language=data["language"].strip(),
            description=data.get("description").strip() if data.get("description") else None,
            cover=data.get("cover").strip() if data.get("cover") else None,
            source=data["source"].strip(),
            source_url=data["source_url"].strip(),
            source_identifier=data["source_identifier"].strip(),
            license_or_rights=data["license_or_rights"].strip(),
            publication_year=data.get("publication_year"),
            categories=[c.strip() for c in data["categories"] if isinstance(c, str)],
            text_location=data["text_location"].strip(),
            word_count=data["word_count"],
            estimated_reading_time=data["estimated_reading_time"],
            cover_config=data.get("cover_config"),
            reading_availability=data.get("reading_availability", "hostable"),
        )

    @classmethod
    def from_json(cls, json_str: str) -> "Book":
        """Parse and validate a Book instance from a JSON string."""
        data = json.loads(json_str)
        return cls.from_dict(data)
