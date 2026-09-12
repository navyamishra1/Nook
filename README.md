# Nook 🌿📖

> **A cozy digital reading environment where reading grows a quiet garden.**

Nook is an open, peaceful digital reading sanctuary designed for discovering, reading, and remembering timeless literature from legitimate public-domain and open-license book collections. 

In Nook, your reading journey is tactile, calm, and grounded: as you turn pages and immerse yourself in classic texts, your reading garden blossoms in direct, deterministic response to your progress.

---

## 1. What is Nook?

Nook is a specialized digital reading environment built around a curated catalog of legitimate, free, and public-domain books (such as those from [Standard Ebooks](https://standardebooks.org/) and [Project Gutenberg](https://www.gutenberg.org/)). 

In its initial version, Nook focuses exclusively on providing an uncompromisingly serene reading experience without user file uploads, paywalls, account lock-in, or social media distraction. It transforms the solitary act of reading into an organic habit through an ambient, growing botanical garden that mirrors your literary journey.

---

## 2. The Problem Nook Solves

Modern digital reading tools are often plagued by:
* **Overstimulation & Clutter:** Busy storefronts, unsolicited recommendations, badges, advertisements, and intrusive social feeds.
* **Ephemeral Reading Habits:** Books started, abandoned, and forgotten without a tangible sense of progression or meaningful reflection.
* **Fragile & Opaque Sourcing:** Reading applications that obscure book provenance, ignore formatting quality, or mishandle licensing and attribution.
* **AI-Overload:** Tools that force generative AI into basic interfaces where deterministic simplicity and privacy are what readers actually desire.

**Nook solves this** by offering a minimalist, distraction-free sanctuary with warm typography, calm aesthetics, transparent public-domain sourcing, deterministic progress tracking, and an organic visual metaphor for knowledge retention.

---

## 3. The Core User Experience

The Nook journey follows a natural, restorative loop:

```
Discover ➔ Read ➔ Track Progress ➔ Take Notes ➔ Grow Your Garden ➔ Understand & Remember
```

1. **Discover:** Browse a hand-curated catalog of classics filtered by mood, theme, era, and estimated reading time.
2. **Read:** Immerse yourself in a warm, beautifully typeset reading room customized for comfort (warm cream tones, soft contrast, restful serif fonts).
3. **Track Progress:** Effortlessly keep track of reading speed, chapters completed, and reading streaks with zero algorithmic pressure.
4. **Take Notes:** Capture memorable passages, personal reflections, and chapter bookmarks in a dedicated digital reading journal.
5. **Grow Your Garden:** Watch your book's unique plant evolve from a humble seed to a flourishing botanical tree as you progress from page 1 to the final chapter.
6. **Understand & Remember:** Revisit notes, reflect on completed works in your garden grove, and build a lasting personal library of wisdom.

---

## 4. Curated Public-Domain & Open Sources

Nook does **not** scrape arbitrary websites or distribute copyrighted material. Every volume in the Nook library is sourced from legitimate, verified open-access archives:

* **Standard Ebooks:** Meticulously formatted, proofread, and typographically rich public-domain editions built to modern standards.
* **Project Gutenberg:** The world's oldest digital library of public-domain literature, providing deep historical breadth.

### Provenance & Attribution Commitment
Every single book ingested into Nook strictly preserves and displays:
* Source identifier and canonical source URL
* Author, original title, and publication year
* Complete licensing, copyright-status, and public-domain declarations

For detailed licensing policies and curation principles, see [docs/book-sources.md](docs/book-sources.md).

---

## 5. Planned Technology Architecture

Nook is engineered with a modular, layered architecture that strictly separates core reading mechanics from future enhancements:

```
[ Book Sources ] (Standard Ebooks / Project Gutenberg)
       │
       ▼
[ Book Ingestion Pipeline ] (Deterministic Validation & Formatting)
       │
       ▼
[ Normalized Book Metadata + Text ] (Clean Storage Artifacts)
       │
       ▼
[ Database ] (Structured Metadata, Progress, Notes)
       │
       ▼
[ Nook Backend / API ]
       │
       ├────────────────────────┐
       ▼                        ▼
[ Web Frontend / Reader ]   [ Reading Garden Engine ]
       │
       ▼ (Future Isolated Layer)
[ AI Companion / RAG Engine ] (Optional / Content-Bound)
```

For complete technical specifications and data schemas, see [docs/architecture.md](docs/architecture.md).

---

## 6. Reliability & Design Philosophy

We adhere to a strict set of reliability and design principles:

* **Zero AI Dependency for Core State:** Reading, progress calculation, bookmarking, note-taking, and garden growth are 100% deterministic, testable, and reliable.
* **No Invented Metadata:** All book attributes (author, year, license, word count) are explicitly validated or marked missing; no hallucinations or arbitrary guesses.
* **Deterministic Ingestion:** The book ingestion pipeline is idempotent and repeatable—running it multiple times on the same input yields identical records.
* **Attribution Preservation:** Licensing and source metadata are first-class data attributes, never stripped or ignored.
* **Aesthetic Serenity:** The interface uses gentle pastels, warm cream backgrounds, sage greens, and restrained animations to evoke a cozy reading corner rather than a sterile software tool.

---

## 7. Development Roadmap

* **Phase 1: Foundation & Documentation (Current)**
  * Project structure, licensing guidelines, architectural blueprints, and product vision established.
* **Phase 2: Book Data Model & Ingestion Pipeline**
  * Normalized data schemas, metadata validators, and initial ingestion adapters for Standard Ebooks and Project Gutenberg.
* **Phase 3: Database & Storage Engine**
  * Relational schema, migrations, seed data loading, and progress/notes persistence.
* **Phase 4: Cozy Reader & Frontend Experience**
  * Distraction-free typography, pastel design system, library catalog browser, and reading room UI.
* **Phase 5: The Reading Garden Engine**
  * Deterministic botanical progression engine, garden visualization, and harvest reflections.
* **Phase 6: Optional AI Book Companion (Opt-In)**
  * Content-bound RAG pipeline for contextual clarifications, historical notes, and chapter summaries on legitimately accessed texts.

---

## 8. Project Structure

```
Nook/
├── frontend/         # Web application and cozy reader interface (Planned)
├── backend/          # Application API and reading state engine (Planned)
├── data/
│   ├── books/        # Normalized local book text storage (Planned)
│   └── seed/         # Initial curated public-domain seed data (Planned)
├── ingestion/        # Ingestion adapters, scrapers & metadata parsers (Planned)
├── database/         # Database migrations and schema definitions (Planned)
├── ai/               # Optional RAG & Book Companion modules (Planned)
├── tests/            # Automated test suite (Planned)
├── docs/             # Product and technical documentation
│   ├── architecture.md
│   ├── book-sources.md
│   └── product-vision.md
├── README.md         # Project overview
└── .gitignore        # Git ignore rules
```

---

## 9. Documentation Index

* 🌿 [Product Vision & Visual Personality](docs/product-vision.md)
* 🏛️ [System Architecture & Data Model](docs/architecture.md)
* 📚 [Book Sources & Licensing Guidelines](docs/book-sources.md)
