"""
Adapter for ingesting and normalizing public domain books from Project Gutenberg (gutenberg.org).
Extracts, cleans, and structures full-text chapters and paragraphs.
"""

import re
from typing import Any, Dict, List, Optional, Tuple

from ingestion.exceptions import InvalidValueError, ProvenanceError
from ingestion.metrics import calculate_reading_time, count_words
from ingestion.models import Book
from ingestion.normalizer import normalize_book_data

SOURCE_NAME: str = "project-gutenberg"
CANONICAL_BASE_URL: str = "https://www.gutenberg.org/ebooks"


class GutenbergAdapter:
    """Adapter for processing Project Gutenberg editions into Nook Book models."""

    @staticmethod
    def build_canonical_url(gutenberg_id: int | str) -> str:
        """Construct the canonical web URL for a Gutenberg release."""
        clean_id = str(gutenberg_id).strip()
        return f"{CANONICAL_BASE_URL}/{clean_id}"

    @classmethod
    def clean_gutenberg_raw_text(cls, raw_text: str) -> str:
        """Strips Gutenberg header and footer legal boilerplate."""
        # Find start marker
        start_patterns = [
            r"\*\*\*\s*START OF TH(E|IS) PROJECT GUTENBERG EBOOK[^\*]*\*\*\*",
            r"\*\*\*START OF THE PROJECT GUTENBERG",
            r"\*\*\*\s*START OF THIS PROJECT GUTENBERG",
        ]
        start_pos = 0
        for pat in start_patterns:
            m = re.search(pat, raw_text, re.IGNORECASE)
            if m:
                start_pos = m.end()
                break

        # Find end marker
        end_patterns = [
            r"\*\*\*\s*END OF TH(E|IS) PROJECT GUTENBERG EBOOK[^\*]*\*\*\*",
            r"\*\*\*END OF THE PROJECT GUTENBERG",
            r"End of the Project Gutenberg EBook",
            r"End of Project Gutenberg's",
        ]
        end_pos = len(raw_text)
        for pat in end_patterns:
            m = re.search(pat, raw_text[start_pos:], re.IGNORECASE)
            if m:
                end_pos = start_pos + m.start()
                break

        body_text = raw_text[start_pos:end_pos].strip()
        return body_text

    @classmethod
    def split_into_chapters(cls, text: str, default_title_prefix: str = "Chapter") -> List[Dict[str, Any]]:
        """Splits full book text into structured chapters by detecting chapter headings."""
        lines = text.splitlines()

        # Regular expressions for chapter headings
        chapter_heading_regex = re.compile(
            r"^\s*(?:"
            r"(?:CHAPTER|Chapter|CHAPITRE|Chapitre|Capítulo|Capitulo)\s+(?:[0-9]+|[IVXLCDM]+|[A-Za-z\-]+)(?:[\.:\s\-–—].*)?"
            r"|(?:BOOK|Book|LIBER|VOLUME|Volume)\s+(?:[0-9]+|[IVXLCDM]+|[A-Za-z\-]+)(?:[\.:\s\-–—].*)?"
            r"|(?:ACT|Act|STAVE|Stave|LETTER|Letter|PART|Part)\s+(?:[0-9]+|[IVXLCDM]+|[A-Za-z\-]+)(?:[\.:\s\-–—].*)?"
            r"|(?:[IVXLCDM]{1,8})\."
            r")\s*$",
            re.IGNORECASE
        )

        chapter_indices = []
        for i, line in enumerate(lines):
            stripped = line.strip()
            if not stripped:
                continue
            if len(stripped) > 80:
                continue

            if chapter_heading_regex.match(stripped):
                # Check surrounding context: blank line before or near
                prev_empty = (i == 0) or (not lines[i - 1].strip()) or (i > 1 and not lines[i - 2].strip())
                if prev_empty:
                    chapter_indices.append((i, stripped))

        # If too few chapters were detected (e.g. Roman numerals without prefix), fallback to section scanning
        if len(chapter_indices) < 2:
            roman_regex = re.compile(r"^\s*([IVXLCDM]{1,7})\s*$", re.IGNORECASE)
            chapter_indices = []
            for i, line in enumerate(lines):
                stripped = line.strip()
                if roman_regex.match(stripped):
                    prev_empty = (i == 0) or (not lines[i - 1].strip())
                    next_empty = (i + 1 < len(lines)) and (not lines[i + 1].strip())
                    if prev_empty and next_empty:
                        chapter_indices.append((i, f"Chapter {stripped.upper()}"))

        # If still no chapter headings, treat entire text as single complete text / multi-part
        if not chapter_indices:
            paragraphs = cls._raw_lines_to_paragraphs(lines)
            return [{
                "number": 1,
                "title": "Full Text",
                "content": "\n\n".join(paragraphs)
            }]

        chapters = []
        for idx, (start_line_idx, heading_title) in enumerate(chapter_indices):
            end_line_idx = chapter_indices[idx + 1][0] if idx + 1 < len(chapter_indices) else len(lines)
            chunk_lines = lines[start_line_idx + 1:end_line_idx]
            
            # Check if next line is a chapter subtitle (e.g. Chapter I \n In Which We Meet...)
            title = heading_title
            if chunk_lines and chunk_lines[0].strip() and len(chunk_lines[0].strip()) < 80:
                subtitle = chunk_lines[0].strip()
                if not subtitle.startswith("http") and not subtitle.isupper() and len(chunk_lines) > 1 and not chunk_lines[1].strip():
                    title = f"{heading_title}: {subtitle}"
                    chunk_lines = chunk_lines[1:]

            paragraphs = cls._raw_lines_to_paragraphs(chunk_lines)
            content = "\n\n".join(paragraphs).strip()

            # Skip empty preamble chunks
            if not content and idx == 0:
                continue

            chapters.append({
                "number": len(chapters) + 1,
                "title": title.strip(),
                "content": content
            })

        # If first chunk before chapter 1 had significant text (preface/introduction)
        if chapter_indices and chapter_indices[0][0] > 10:
            preamble_lines = lines[:chapter_indices[0][0]]
            preamble_paragraphs = cls._raw_lines_to_paragraphs(preamble_lines)
            preamble_text = "\n\n".join(preamble_paragraphs).strip()
            if len(preamble_text.split()) > 150:
                chapters.insert(0, {
                    "number": 1,
                    "title": "Preface",
                    "content": preamble_text
                })
                # Re-number
                for i, c in enumerate(chapters):
                    c["number"] = i + 1

        return chapters

    @staticmethod
    def _raw_lines_to_paragraphs(lines: List[str]) -> List[str]:
        """Converts raw Gutenberg wrapped lines into clean paragraphs."""
        paragraphs = []
        current_p = []

        for line in lines:
            stripped = line.strip()
            if not stripped:
                if current_p:
                    p_text = " ".join(current_p)
                    p_text = re.sub(r"\s+", " ", p_text).strip()
                    if p_text:
                        paragraphs.append(p_text)
                    current_p = []
            else:
                if stripped.startswith("[Illustration") and stripped.endswith("]"):
                    continue
                current_p.append(stripped)

        if current_p:
            p_text = " ".join(current_p)
            p_text = re.sub(r"\s+", " ", p_text).strip()
            if p_text:
                paragraphs.append(p_text)

        return paragraphs

    @classmethod
    def fetch_full_content(
        cls,
        gutenberg_id: int | str,
        book_id: str,
        title: str,
        author: str,
    ) -> Dict[str, Any]:
        """Fetch full text from Project Gutenberg, clean boilerplate, split into chapters, and structure as content.json payload.

        Args:
            gutenberg_id: Project Gutenberg numeric ID or URL.
            book_id: Nook canonical book ID.
            title: Book title.
            author: Book author.

        Returns:
            Dictionary adhering to Nook content.json schema.
        """
        import urllib.request

        # Extract numeric ID
        gid_str = str(gutenberg_id).strip()
        m = re.search(r"(\d+)", gid_str)
        if not m:
            raise InvalidValueError(f"Invalid Gutenberg ID: {gutenberg_id}")
        clean_id = m.group(1)

        urls = [
            f"https://www.gutenberg.org/cache/epub/{clean_id}/pg{clean_id}.txt",
            f"https://www.gutenberg.org/files/{clean_id}/{clean_id}-0.txt",
            f"https://www.gutenberg.org/files/{clean_id}/{clean_id}.txt",
        ]

        raw_text = None
        last_err = None
        for u in urls:
            req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (Nook-Ingestion/1.0)"})
            try:
                with urllib.request.urlopen(req, timeout=25) as resp:
                    raw_text = resp.read().decode("utf-8", errors="replace")
                    if raw_text and len(raw_text) > 1000:
                        break
            except Exception as e:
                last_err = e
                continue

        if not raw_text or len(raw_text) < 1000:
            raise InvalidValueError(f"Failed to fetch Gutenberg text for ID '{gutenberg_id}': {last_err}")

        cleaned_text = cls.clean_gutenberg_raw_text(raw_text)
        chapters = cls.split_into_chapters(cleaned_text)

        valid_chapters = [c for c in chapters if c["content"].strip()]
        if not valid_chapters:
            raise InvalidValueError(f"No valid chapters extracted from Gutenberg ID {gutenberg_id}")

        for idx, ch in enumerate(valid_chapters):
            ch["number"] = idx + 1

        return {
            "id": book_id,
            "title": title,
            "author": author,
            "chapters": valid_chapters,
        }
