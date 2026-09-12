"""Adapter for ingesting and normalizing books from Standard Ebooks (standardebooks.org)."""

import re
from typing import Any, Dict, List, Optional
import xml.etree.ElementTree as ET

from ingestion.exceptions import (
    InvalidValueError,
    MissingFieldError,
    ProvenanceError,
)
from ingestion.metrics import calculate_reading_time, count_words
from ingestion.models import Book
from ingestion.normalizer import normalize_book_data, normalize_categories, normalize_publication_year

SOURCE_NAME: str = "standard-ebooks"
CANONICAL_BASE_URL: str = "https://standardebooks.org/ebooks"

# Standard Ebooks XML Namespaces in package.opf
NAMESPACES = {
    "opf": "http://www.idpf.org/2007/opf",
    "dc": "http://purl.org/dc/elements/1.1/",
    "se": "https://standardebooks.org/vocab/1.0",
}


class StandardEbooksAdapter:
    """Adapter for processing Standard Ebooks editions into Nook Book models."""

    @staticmethod
    def build_canonical_url(source_identifier: str) -> str:
        """Construct the canonical web URL for a Standard Ebooks release.
        
        Args:
            source_identifier: Standard Ebooks slug (e.g. 'jane-austen/pride-and-prejudice').

        Returns:
            Canonical HTTPS URL string.
        """
        clean_id = source_identifier.strip().strip("/")
        return f"{CANONICAL_BASE_URL}/{clean_id}"

    @classmethod
    def parse_metadata_dict(
        cls,
        raw_meta: Dict[str, Any],
        text_content: Optional[str] = None,
        words_per_minute: int = 225,
    ) -> Book:
        """Parse structured metadata dictionary for a Standard Ebooks edition into a validated Book.
        
        Args:
            raw_meta: Dictionary containing Standard Ebooks metadata fields.
            text_content: Optional raw or formatted text content.
            words_per_minute: Reading speed for reading time calculation.

        Returns:
            Validated immutable Book instance.

        Raises:
            ProvenanceError: If required provenance fields are missing or invalid.
            NookValidationError: If any required schema fields fail validation.
        """
        if not isinstance(raw_meta, dict):
            raise InvalidValueError(f"Expected dict for raw_meta, got {type(raw_meta).__name__}")

        # Extract or construct source identifier
        source_identifier = raw_meta.get("source_identifier")
        if not isinstance(source_identifier, str) or not source_identifier.strip():
            raise ProvenanceError("Standard Ebooks edition requires a non-empty 'source_identifier'.")
        source_identifier = source_identifier.strip()

        # Construct canonical URL if not explicitly provided
        source_url = raw_meta.get("source_url")
        if not source_url:
            source_url = cls.build_canonical_url(source_identifier)

        # Standard Ebooks releases are dedicated to the public domain via CC0 1.0 Universal
        license_or_rights = raw_meta.get("license_or_rights")
        if not isinstance(license_or_rights, str) or not license_or_rights.strip():
            license_or_rights = "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)"

        payload = dict(raw_meta)
        payload["source"] = SOURCE_NAME
        payload["source_identifier"] = source_identifier
        payload["source_url"] = source_url
        payload["license_or_rights"] = license_or_rights

        normalized = normalize_book_data(
            payload,
            text_content=text_content,
            words_per_minute=words_per_minute,
        )

        return Book.from_dict(normalized)

    @classmethod
    def parse_opf_xml(
        cls,
        opf_xml_content: str,
        source_identifier: str,
        text_content: Optional[str] = None,
        words_per_minute: int = 225,
    ) -> Book:
        """Parse a Standard Ebooks Open Packaging Format (content.opf) XML string into a Book.
        
        Args:
            opf_xml_content: XML content of the OPF package.
            source_identifier: Standard Ebooks identifier slug.
            text_content: Optional text content for word counting.
            words_per_minute: Reading speed constant.

        Returns:
            Validated Book instance.
        """
        if not isinstance(opf_xml_content, str) or not opf_xml_content.strip():
            raise InvalidValueError("opf_xml_content must be a non-empty XML string.")

        try:
            root = ET.fromstring(opf_xml_content)
        except ET.ParseError as e:
            raise InvalidValueError(f"Malformed OPF XML content: {e}")

        # Find metadata container
        metadata_el = root.find("opf:metadata", NAMESPACES)
        if metadata_el is None:
            # Try without namespace prefix
            metadata_el = root.find("metadata")
            if metadata_el is None:
                raise MissingFieldError("Missing <metadata> element in OPF XML.")

        def get_dc_text(tag_name: str) -> Optional[str]:
            el = metadata_el.find(f"dc:{tag_name}", NAMESPACES)
            if el is None:
                el = metadata_el.find(tag_name)
            return el.text.strip() if el is not None and el.text else None

        title = get_dc_text("title")
        if not title:
            raise MissingFieldError("Missing <dc:title> in OPF metadata.")

        creator = get_dc_text("creator")
        if not creator:
            raise MissingFieldError("Missing <dc:creator> in OPF metadata.")

        language = get_dc_text("language") or "en"
        description = get_dc_text("description")
        rights = get_dc_text("rights") or "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)"
        pub_date = get_dc_text("date")

        # Collect subjects
        subjects = []
        for s in metadata_el.findall("dc:subject", NAMESPACES):
            if s.text and s.text.strip():
                subjects.append(s.text.strip())

        raw_meta = {
            "title": title,
            "author": creator,
            "language": language,
            "description": description,
            "source_identifier": source_identifier,
            "source_url": cls.build_canonical_url(source_identifier),
            "license_or_rights": rights,
            "publication_year": pub_date,
            "categories": subjects if subjects else ["Classics"],
        }

        return cls.parse_metadata_dict(raw_meta, text_content=text_content, words_per_minute=words_per_minute)

    @staticmethod
    def _clean_node_text(element: ET.Element) -> str:
        """Extract clean text from an XML/XHTML element while normalizing excessive spacing."""
        text = "".join(element.itertext())
        text = re.sub(r'[\r\n\t]+', ' ', text)
        text = re.sub(r' +', ' ', text)
        return text.strip()

    @classmethod
    def extract_chapter_from_xhtml(
        cls, xhtml_content: str, fallback_title: str = "Chapter"
    ) -> tuple[str, str, int]:
        """Extract chapter heading and multi-paragraph content from a Standard Ebooks XHTML document.
        
        Args:
            xhtml_content: Raw XHTML document string.
            fallback_title: Fallback chapter title if no heading is found.

        Returns:
            Tuple of (chapter_title, content_text, paragraph_count).
        """
        try:
            root = ET.fromstring(xhtml_content)
        except ET.ParseError as e:
            raise InvalidValueError(f"Malformed chapter XHTML: {e}")

        ns = {"xhtml": "http://www.w3.org/1999/xhtml"}

        # Find heading
        title = None
        for tag in ["h2", "h3", "h1", "header"]:
            h = root.find(f".//xhtml:{tag}", ns)
            if h is None:
                h = root.find(f".//{tag}")
            if h is not None:
                t = cls._clean_node_text(h)
                if t and len(t) < 100:
                    title = t
                    break

        if not title:
            title = fallback_title

        body = root.find(".//xhtml:body", ns)
        if body is None:
            body = root.find(".//body")
        if body is None:
            body = root

        paragraphs = []
        for p in body.findall(".//xhtml:p", ns):
            p_text = cls._clean_node_text(p)
            if p_text:
                paragraphs.append(p_text)

        if not paragraphs:
            # Try without namespace
            for p in body.findall(".//p"):
                p_text = cls._clean_node_text(p)
                if p_text:
                    paragraphs.append(p_text)

        content_text = "\n\n".join(paragraphs)
        return title, content_text, len(paragraphs)

    @classmethod
    def fetch_full_content(
        cls,
        source_identifier: str,
        book_id: str,
        title: str,
        author: str,
    ) -> Dict[str, Any]:
        """Retrieve the complete legitimate multi-chapter book content from Standard Ebooks repository.
        
        Args:
            source_identifier: Standard Ebooks identifier slug (e.g. 'mary-shelley/frankenstein').
            book_id: Nook canonical book ID.
            title: Book title.
            author: Book author.

        Returns:
            Dictionary adhering to Nook content.json schema.
        """
        import urllib.request

        repo_slug = source_identifier.strip().strip("/").replace("/", "_")
        toc_url = f"https://raw.githubusercontent.com/standardebooks/{repo_slug}/master/src/epub/toc.xhtml"

        req = urllib.request.Request(toc_url, headers={"User-Agent": "Nook-Ingestion/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                toc_data = resp.read().decode("utf-8")
        except Exception as e:
            raise InvalidValueError(f"Failed to fetch Standard Ebooks TOC for '{source_identifier}': {e}")

        try:
            toc_root = ET.fromstring(toc_data)
        except ET.ParseError as e:
            raise InvalidValueError(f"Malformed TOC XHTML for '{source_identifier}': {e}")

        links = []
        skip_keywords = [
            "titlepage",
            "imprint",
            "colophon",
            "uncopyright",
            "dedication",
            "frontispiece",
            "halftitle",
            "epigraph",
            "endnotes",
            "list-of-illustrations",
        ]

        for a in toc_root.findall(".//{http://www.w3.org/1999/xhtml}a"):
            href = a.attrib.get("href", "")
            link_title = cls._clean_node_text(a)

            if "text/" in href and not any(k in href.lower() for k in skip_keywords):
                clean_href = href.split("#")[0]
                if clean_href not in [l[0] for l in links]:
                    links.append((clean_href, link_title))

        if not links:
            raise InvalidValueError(f"No readable chapters found in TOC for '{source_identifier}'")

        chapters = []
        for href, link_title in links:
            file_url = f"https://raw.githubusercontent.com/standardebooks/{repo_slug}/master/src/epub/{href}"
            req_file = urllib.request.Request(file_url, headers={"User-Agent": "Nook-Ingestion/1.0"})
            with urllib.request.urlopen(req_file, timeout=30) as resp_file:
                xhtml_content = resp_file.read().decode("utf-8")

            extracted_title, text, p_count = cls.extract_chapter_from_xhtml(
                xhtml_content, fallback_title=link_title
            )

            # Skip empty divider pages
            if not text or len(text.strip()) == 0 or p_count == 0:
                continue

            final_title = link_title if link_title and len(link_title) < 60 else extracted_title
            if not final_title or not final_title.strip():
                final_title = f"Chapter {len(chapters) + 1}"

            if re.match(r"^[IVXLCDM]+$", final_title.strip()):
                final_title = f"Chapter {final_title.strip()}"

            chapters.append({
                "number": len(chapters) + 1,
                "title": final_title,
                "content": text,
            })

        if not chapters:
            raise InvalidValueError(f"No chapters with text content extracted for '{source_identifier}'")

        return {
            "id": book_id,
            "title": title,
            "author": author,
            "chapters": chapters,
        }

