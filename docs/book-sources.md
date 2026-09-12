# Book Sources & Licensing Guidelines 📚⚖️

This document details the authorized initial book sources for **Nook**, criteria for catalog inclusion, attribution requirements, and legal/licensing caveats.

---

## 1. Core Sourcing Philosophy

Nook does not permit arbitrary user file uploads, nor does it scrape unauthorized web sources or commercial digital distributors. 

To ensure the highest standard of legal compliance, typographical beauty, and preservation ethics, Nook ingests books **strictly from verified, legitimate public-domain and open-license digital repositories**.

---

## 2. Primary Sourced Repositories

### A. Standard Ebooks
* **Website:** [standardebooks.org](https://standardebooks.org/)
* **Focus:** High-quality, beautifully formatted, proofread editions of public-domain literature.

#### Why Standard Ebooks is Considered:
1. **Exceptional Typographical Quality:** Standard Ebooks applies modern digital typography rules (proper curly quotes, em-dashes, ligature support, fine kerning, semantic HTML structure).
2. **Curated & Proofread:** Editions undergo meticulous multi-pass proofreading, correcting OCR anomalies and formatting errors found in raw archival scans.
3. **Open Tooling & Metadata:** Books include rich Dublin Core and schema.org metadata, clean semantic markup, and consistent public-domain cover art.
4. **Permissive Licensing on Formatting:** Standard Ebooks releases its editorial and typography work into the public domain via the [Creative Commons CC0 1.0 Universal Public Domain Dedication](https://creativecommons.org/publicdomain/zero/1.0/).

---

### B. Project Gutenberg
* **Website:** [gutenberg.org](https://gutenberg.org/)
* **Focus:** Archival preservation of cultural works and historical public-domain texts.

#### Why Project Gutenberg is Considered:
1. **Catalog Breadth:** Over 70,000 digitized historical works spanning diverse centuries, authors, and languages.
2. **Pioneering Open Archive:** The longest-running provider of free digital literature with a rigorous copyright clearance process based on U.S. copyright law.
3. **Plain Text Accessibility:** Raw UTF-8 text formats provide a robust baseline for custom parsing and normalization.

---

## 3. Licensing & Public-Domain Caveats

> [!IMPORTANT]
> **Legal Notice & Boundary:** 
> Nook relies strictly on the documentation and rights declarations provided by the original archives. Nook does not make independent legal conclusions or render copyright advice beyond preserving and enforcing the terms published by each source.

### Jurisdictional Nuances
* **US Public Domain Status:** Project Gutenberg and Standard Ebooks primarily verify public-domain status based on **United States copyright law** (e.g., works published prior to the statutory cutoff year—currently January 1, 1929—or works with non-renewed copyright).
* **International Differences:** Copyright terms vary across global jurisdictions (e.g., "Life of the author plus 50/70/80 years"). A work in the public domain under U.S. law might still have active copyright protections in other countries.
* **Derived Assets (Covers & Editorial Content):** While underlying texts may be public domain, modern cover artwork, translations, footnotes, or critical introductions may have distinct copyright or CC licenses that must be validated individually.

---

## 4. Source Attribution & Metadata Retention Requirements

Every book record stored in Nook **must permanently retain and display** its complete provenance and rights metadata. 

### Mandatory Metadata Fields

The ingestion pipeline will reject any book payload that fails to supply the following attribution fields:

| Field | Requirement | Purpose |
| :--- | :--- | :--- |
| `source` | `"standard-ebooks"` \| `"project-gutenberg"` | Identifies the originating repository. |
| `source_url` | Full canonical URL to source page | Allows users to verify source authenticity directly. |
| `source_identifier` | Source-specific unique ID/slug | Ensures idempotent re-ingestion and traceability. |
| `license_or_rights` | Exact text from source header/metadata | Preserves legal terms and copyright declarations. |
| `author` | Verified creator name | Credits the original author without alteration. |
| `title` | Verified title | Canonical title of the published edition. |

### Project Gutenberg Specifics
When ingesting texts from Project Gutenberg, Nook's parser will isolate the literary body text for the reading view while **preserving the Project Gutenberg License header and footer in the book's metadata record**, ensuring compliance with the Project Gutenberg trademark and distribution guidelines.

### Standard Ebooks Specifics
Standard Ebooks releases are dedicated to the public domain under CC0 1.0. Nook preserves the Standard Ebooks colophon, credit notices, and revision identifiers to honor the volunteer contributors who typeset the volume.

---

## 5. Ingestion Guardrails & Verification Rules

To maintain catalog integrity:

1. **Explicit Validation:** Unknown or ambiguously licensed texts will not be inserted into the catalog.
2. **No Scraped Copyrighted Works:** The ingestion engine must not crawl arbitrary websites, piracy repositories, or modern copyrighted materials.
3. **Deterministic Text Normalization:** Ingestion scripts will clean formatting artifacts deterministically and generate reproducible word counts, chapter boundaries, and reading estimates.
4. **Auditability:** Any user of Nook can view the "About this Edition" panel in the reader to inspect the exact license, source URL, and provenance of the text they are reading.
