"""
Nook 105-Book Concurrent Master Ingestion Pipeline
Fetches, extracts, validates, and persists 105 legitimate, 100% complete public-domain novels
from Standard Ebooks & Project Gutenberg into Nook canonical data stores using high-throughput thread pooling.
"""

import concurrent.futures
import json
import os
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ingestion.adapters.standard_ebooks import StandardEbooksAdapter
from ingestion.adapters.gutenberg import GutenbergAdapter
from ingestion.metrics import calculate_reading_time, count_words
from ingestion.validators import validate_book_schema, validate_content_structure, validate_provenance

DATA_DIR = Path("data")
FRONTEND_DATA_DIR = Path("frontend/data")
BOOKS_SEED_FILE = DATA_DIR / "seed" / "books.json"
FRONTEND_SEED_FILE = FRONTEND_DATA_DIR / "seed" / "books.json"

EDITORIAL_PALETTES = [
    {"bg": "#95A8BA", "foil": "#F7F3EB", "text": "#FFFFFF", "tag": "Wedgwood Blue"},
    {"bg": "#7B8E6D", "foil": "#E8DEC8", "text": "#FFFFFF", "tag": "Sage Leather"},
    {"bg": "#C4A877", "foil": "#FAF6EE", "text": "#FFFFFF", "tag": "Warm Amber"},
    {"bg": "#9E829F", "foil": "#F6EFF7", "text": "#FFFFFF", "tag": "Mulberry Cloth"},
    {"bg": "#8B9A92", "foil": "#EDE7DC", "text": "#FFFFFF", "tag": "Moss Slate"},
    {"bg": "#B39274", "foil": "#FBF8F2", "text": "#FFFFFF", "tag": "Tuscan Ochre"},
    {"bg": "#8C584E", "foil": "#FBEAEB", "text": "#FFFFFF", "tag": "Crimson Cloth"},
    {"bg": "#486B64", "foil": "#E0EBE6", "text": "#FFFFFF", "tag": "Eucalyptus Slate"},
]

CATALOG_DEFINITIONS = [
    # 1-4 PRESERVED SEED BOOKS
    {
        "id": "pride-and-prejudice",
        "title": "Pride and Prejudice",
        "author": "Jane Austen",
        "publication_year": 1813,
        "categories": ["Classics", "Romance", "Satire", "Victorian Literature"],
        "description": "A classic romantic novel following Elizabeth Bennet as she navigates manners, upbringing, morality, education, and marriage in Regency-era Great Britain.",
        "source": "standard-ebooks",
        "source_identifier": "jane-austen/pride-and-prejudice",
        "source_url": "https://standardebooks.org/ebooks/jane-austen/pride-and-prejudice",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "preserve_content": True,
        "palette_idx": 0,
        "motif": "botanical-filigree",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "frankenstein",
        "title": "Frankenstein; or, The Modern Prometheus",
        "author": "Mary Wollstonecraft Shelley",
        "publication_year": 1818,
        "categories": ["Classics", "Gothic Fiction", "Science Fiction", "Horror"],
        "description": "A Gothic masterpiece telling the story of Victor Frankenstein, a young scientist who creates a sentient creature in an unorthodox scientific experiment.",
        "source": "standard-ebooks",
        "source_identifier": "mary-shelley/frankenstein",
        "source_url": "https://standardebooks.org/ebooks/mary-shelley/frankenstein",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "preserve_content": True,
        "palette_idx": 1,
        "motif": "vintage-engraving",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "alices-adventures-in-wonderland",
        "title": "Alice's Adventures in Wonderland",
        "author": "Lewis Carroll",
        "publication_year": 1865,
        "categories": ["Classics", "Fantasy", "Children's Literature", "Absurdist Fiction"],
        "description": "The beloved tale of a young girl named Alice who falls through a rabbit hole into a subterranean fantasy world populated by peculiar, anthropomorphic creatures.",
        "source": "standard-ebooks",
        "source_identifier": "lewis-carroll/alices-adventures-in-wonderland",
        "source_url": "https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "preserve_content": True,
        "palette_idx": 2,
        "motif": "pocket-watch",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-great-gatsby",
        "title": "The Great Gatsby",
        "author": "F. Scott Fitzgerald",
        "publication_year": 1925,
        "categories": ["Classics", "Literary Fiction", "Jazz Age", "Historical Fiction"],
        "description": "A portrait of the Jazz Age exploring themes of decadence, idealism, social upheaval, and the elusive American Dream on Long Island in the summer of 1922.",
        "source": "standard-ebooks",
        "source_identifier": "f-scott-fitzgerald/the-great-gatsby",
        "source_url": "https://standardebooks.org/ebooks/f-scott-fitzgerald/the-great-gatsby",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "preserve_content": True,
        "palette_idx": 3,
        "motif": "art-deco-sunburst",
        "edition_tag": "Nook Edition"
    },

    # 5-15 ROMANCE & REGENCY CLASSICS
    {
        "id": "jane-eyre",
        "title": "Jane Eyre",
        "author": "Charlotte Brontë",
        "publication_year": 1847,
        "categories": ["Romance", "Gothic Fiction", "Classics", "Victorian Literature"],
        "description": "The passionate journey of an orphaned governess who encounters love, moral trial, and mysterious secrets at Thornfield Hall.",
        "source": "standard-ebooks",
        "source_identifier": "charlotte-bronte/jane-eyre",
        "source_url": "https://standardebooks.org/ebooks/charlotte-bronte/jane-eyre",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 6,
        "motif": "english-manor",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "wuthering-heights",
        "title": "Wuthering Heights",
        "author": "Emily Brontë",
        "publication_year": 1847,
        "categories": ["Gothic Fiction", "Romance", "Classics", "Tragedy"],
        "description": "A haunting, tempestuous tale of passionate obsession and generational vengeance set on the windswept Yorkshire moors.",
        "source": "standard-ebooks",
        "source_identifier": "emily-bronte/wuthering-heights",
        "source_url": "https://standardebooks.org/ebooks/emily-bronte/wuthering-heights",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 4,
        "motif": "moor-wind",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "sense-and-sensibility",
        "title": "Sense and Sensibility",
        "author": "Jane Austen",
        "publication_year": 1811,
        "categories": ["Romance", "Classics", "Satire", "Victorian Literature"],
        "description": "The fortunes of Elinor and Marianne Dashwood as they balance prudent restraint and passionate romantic yearning in 19th-century England.",
        "source": "standard-ebooks",
        "source_identifier": "jane-austen/sense-and-sensibility",
        "source_url": "https://standardebooks.org/ebooks/jane-austen/sense-and-sensibility",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 5,
        "motif": "botanical-rose",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "emma",
        "title": "Emma",
        "author": "Jane Austen",
        "publication_year": 1815,
        "categories": ["Romance", "Classics", "Satire", "Comedy"],
        "description": "Emma Woodhouse, handsome, clever, and rich, meddles with the romantic affairs of her neighbors with amusing and unforeseen results.",
        "source": "standard-ebooks",
        "source_identifier": "jane-austen/emma",
        "source_url": "https://standardebooks.org/ebooks/jane-austen/emma",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 2,
        "motif": "ribbon-garland",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "persuasion",
        "title": "Persuasion",
        "author": "Jane Austen",
        "publication_year": 1817,
        "categories": ["Romance", "Classics", "Victorian Literature"],
        "description": "Anne Elliot is reunited with Captain Wentworth years after being persuaded to break their engagement in Austen's most tender novel.",
        "source": "standard-ebooks",
        "source_identifier": "jane-austen/persuasion",
        "source_url": "https://standardebooks.org/ebooks/jane-austen/persuasion",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 0,
        "motif": "nautical-anchor",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "northanger-abbey",
        "title": "Northanger Abbey",
        "author": "Jane Austen",
        "publication_year": 1817,
        "categories": ["Romance", "Gothic Fiction", "Satire", "Classics"],
        "description": "A charming satire of Gothic melodrama following young Catherine Morland as her vivid imagination clashes with high-society reality.",
        "source": "standard-ebooks",
        "source_identifier": "jane-austen/northanger-abbey",
        "source_url": "https://standardebooks.org/ebooks/jane-austen/northanger-abbey",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 1,
        "motif": "abbey-arch",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "mansfield-park",
        "title": "Mansfield Park",
        "author": "Jane Austen",
        "publication_year": 1814,
        "categories": ["Romance", "Classics", "Victorian Literature"],
        "description": "Fanny Price struggles for acceptance and love amidst the shifting moral tides and romantic scandals of the wealthy Bertram household.",
        "source": "standard-ebooks",
        "source_identifier": "jane-austen/mansfield-park",
        "source_url": "https://standardebooks.org/ebooks/jane-austen/mansfield-park",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 7,
        "motif": "estate-gates",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-tenant-of-wildfell-hall",
        "title": "The Tenant of Wildfell Hall",
        "author": "Anne Brontë",
        "publication_year": 1848,
        "categories": ["Romance", "Victorian Literature", "Classics", "Drama"],
        "description": "A pioneering masterpiece following Helen Graham's brave escape from an abusive marriage to protect her son.",
        "source": "standard-ebooks",
        "source_identifier": "anne-bronte/the-tenant-of-wildfell-hall",
        "source_url": "https://standardebooks.org/ebooks/anne-bronte/the-tenant-of-wildfell-hall",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 6,
        "motif": "stone-hall",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "a-room-with-a-view",
        "title": "A Room with a View",
        "author": "E. M. Forster",
        "publication_year": 1908,
        "categories": ["Romance", "Literary Fiction", "Classics", "Coming-of-Age"],
        "description": "Lucy Honeychurch navigates British social decorum and unexpected romantic passion amid the sun-drenched hills of Florence.",
        "source": "standard-ebooks",
        "source_identifier": "e-m-forster/a-room-with-a-view",
        "source_url": "https://standardebooks.org/ebooks/e-m-forster/a-room-with-a-view",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 2,
        "motif": "florentine-window",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-age-of-innocence",
        "title": "The Age of Innocence",
        "author": "Edith Wharton",
        "publication_year": 1920,
        "categories": ["Romance", "Literary Fiction", "Historical Fiction", "Classics"],
        "description": "Pulitzer Prize-winning portrait of desire, duty, and gilded high society in 1870s Old New York.",
        "source": "standard-ebooks",
        "source_identifier": "edith-wharton/the-age-of-innocence",
        "source_url": "https://standardebooks.org/ebooks/edith-wharton/the-age-of-innocence",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 3,
        "motif": "opera-glove",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-house-of-mirth",
        "title": "The House of Mirth",
        "author": "Edith Wharton",
        "publication_year": 1905,
        "categories": ["Romance", "Literary Fiction", "Drama", "Tragedy"],
        "description": "The tragic journey of Lily Bart, a charming but penniless socialite seeking financial security without sacrificing her ideals.",
        "source": "standard-ebooks",
        "source_identifier": "edith-wharton/the-house-of-mirth",
        "source_url": "https://standardebooks.org/ebooks/edith-wharton/the-house-of-mirth",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 4,
        "motif": "gilded-lily",
        "edition_tag": "Nook Edition"
    },

    # 16-25 GOTHIC FICTION, HORROR & DARK ROMANCE
    {
        "id": "dracula",
        "title": "Dracula",
        "author": "Bram Stoker",
        "publication_year": 1897,
        "categories": ["Gothic Fiction", "Horror", "Classics", "Thriller"],
        "description": "The legendary epistolary novel tracing Count Dracula's sinister voyage from Transylvania to London and the band of heroes who fight him.",
        "source": "standard-ebooks",
        "source_identifier": "bram-stoker/dracula",
        "source_url": "https://standardebooks.org/ebooks/bram-stoker/dracula",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 6,
        "motif": "transylvanian-crest",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-picture-of-dorian-gray",
        "title": "The Picture of Dorian Gray",
        "author": "Oscar Wilde",
        "publication_year": 1890,
        "categories": ["Gothic Fiction", "Philosophical Fiction", "Classics", "Horror"],
        "description": "A hedonistic young man sells his soul so that his portrait ages in his place while he pursues unrestrained sensual indulgence.",
        "source": "standard-ebooks",
        "source_identifier": "oscar-wilde/the-picture-of-dorian-gray",
        "source_url": "https://standardebooks.org/ebooks/oscar-wilde/the-picture-of-dorian-gray",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 3,
        "motif": "gilded-mirror",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-strange-case-of-dr-jekyll-and-mr-hyde",
        "title": "The Strange Case of Dr. Jekyll and Mr. Hyde",
        "author": "Robert Louis Stevenson",
        "publication_year": 1886,
        "categories": ["Gothic Fiction", "Horror", "Mystery", "Science Fiction"],
        "description": "The seminal psychological novella exploring the dual nature of man through the terrifying transformation of Dr. Henry Jekyll.",
        "source": "standard-ebooks",
        "source_identifier": "robert-louis-stevenson/the-strange-case-of-dr-jekyll-and-mr-hyde",
        "source_url": "https://standardebooks.org/ebooks/robert-louis-stevenson/the-strange-case-of-dr-jekyll-and-mr-hyde",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 4,
        "motif": "apothecary-flask",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-turn-of-the-screw",
        "title": "The Turn of the Screw",
        "author": "Henry James",
        "publication_year": 1898,
        "categories": ["Gothic Fiction", "Horror", "Psychological Fiction", "Classics"],
        "description": "A governess at an isolated country estate becomes convinced that malevolent supernatural spirits are haunting the children in her care.",
        "source": "standard-ebooks",
        "source_identifier": "henry-james/the-turn-of-the-screw",
        "source_url": "https://standardebooks.org/ebooks/henry-james/the-turn-of-the-screw",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 5,
        "motif": "country-spire",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-phantom-of-the-opera",
        "title": "The Phantom of the Opera",
        "author": "Gaston Leroux",
        "publication_year": 1910,
        "categories": ["Gothic Fiction", "Mystery", "Romance", "Horror"],
        "description": "Beneath the Paris Opera House, a disfigured musical genius haunts the corridors and becomes obsessed with the lovely soprano Christine Daaé.",
        "source": "standard-ebooks",
        "source_identifier": "gaston-leroux/the-phantom-of-the-opera/alexander-teixeira-de-mattos",
        "source_url": "https://standardebooks.org/ebooks/gaston-leroux/the-phantom-of-the-opera",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 6,
        "motif": "opera-mask",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-yellow-wallpaper",
        "title": "The Yellow Wallpaper",
        "author": "Charlotte Perkins Gilman",
        "publication_year": 1892,
        "categories": ["Gothic Fiction", "Psychological Fiction", "Classics", "Horror"],
        "description": "A chilling exploration of psychological confinement, medical paternalism, and postpartum depression in 19th-century America.",
        "source": "gutenberg",
        "source_identifier": "1952",
        "source_url": "https://www.gutenberg.org/ebooks/1952",
        "license_or_rights": "Public Domain in the USA",
        "palette_idx": 2,
        "motif": "arabesque-wallpaper",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-scarlet-letter",
        "title": "The Scarlet Letter",
        "author": "Nathaniel Hawthorne",
        "publication_year": 1850,
        "categories": ["Classics", "Historical Fiction", "Drama", "Gothic Fiction"],
        "description": "Hester Prynne bears the letter 'A' for adultery in 17th-century Puritan Boston, grappling with shame, dignity, and redemption.",
        "source": "standard-ebooks",
        "source_identifier": "nathaniel-hawthorne/the-scarlet-letter",
        "source_url": "https://standardebooks.org/ebooks/nathaniel-hawthorne/the-scarlet-letter",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 6,
        "motif": "embroidered-letter",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-house-of-the-seven-gables",
        "title": "The House of the Seven Gables",
        "author": "Nathaniel Hawthorne",
        "publication_year": 1851,
        "categories": ["Gothic Fiction", "Classics", "Mystery", "Historical Fiction"],
        "description": "A multi-generational curse haunts a gloomy New England mansion built on land seized from a condemned wizard.",
        "source": "standard-ebooks",
        "source_identifier": "nathaniel-hawthorne/the-house-of-the-seven-gables",
        "source_url": "https://standardebooks.org/ebooks/nathaniel-hawthorne/the-house-of-the-seven-gables",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 4,
        "motif": "seven-gables",
        "edition_tag": "Nook Edition"
    },

    # 26-40 MYSTERY & DETECTIVE FICTION
    {
        "id": "the-adventures-of-sherlock-holmes",
        "title": "The Adventures of Sherlock Holmes",
        "author": "Arthur Conan Doyle",
        "publication_year": 1892,
        "categories": ["Mystery", "Detective Fiction", "Classics", "Victorian Literature"],
        "description": "Twelve landmark detective stories featuring the brilliant Sherlock Holmes and Dr. John Watson, from 'A Scandal in Bohemia' onward.",
        "source": "standard-ebooks",
        "source_identifier": "arthur-conan-doyle/the-adventures-of-sherlock-holmes",
        "source_url": "https://standardebooks.org/ebooks/arthur-conan-doyle/the-adventures-of-sherlock-holmes",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 4,
        "motif": "baker-street-pipe",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-hound-of-the-baskervilles",
        "title": "The Hound of the Baskervilles",
        "author": "Arthur Conan Doyle",
        "publication_year": 1902,
        "categories": ["Mystery", "Detective Fiction", "Gothic Fiction", "Classics"],
        "description": "Sherlock Holmes and Dr. Watson investigate a terrifying spectral hound haunting the Baskerville lineage on the eerie Dartmoor moors.",
        "source": "standard-ebooks",
        "source_identifier": "arthur-conan-doyle/the-hound-of-the-baskervilles",
        "source_url": "https://standardebooks.org/ebooks/arthur-conan-doyle/the-hound-of-the-baskervilles",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 1,
        "motif": "moorland-paw",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "a-study-in-scarlet",
        "title": "A Study in Scarlet",
        "author": "Arthur Conan Doyle",
        "publication_year": 1887,
        "categories": ["Mystery", "Detective Fiction", "Classics"],
        "description": "The thrilling debut of Sherlock Holmes and Dr. John Watson, tracing an elusive murder from London back to the American West.",
        "source": "standard-ebooks",
        "source_identifier": "arthur-conan-doyle/a-study-in-scarlet",
        "source_url": "https://standardebooks.org/ebooks/arthur-conan-doyle/a-study-in-scarlet",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 6,
        "motif": "magnifying-glass",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-sign-of-the-four",
        "title": "The Sign of the Four",
        "author": "Arthur Conan Doyle",
        "publication_year": 1890,
        "categories": ["Mystery", "Detective Fiction", "Adventure", "Classics"],
        "description": "Holmes and Watson unravel a complex puzzle involving stolen Indian treasure, secret oaths, and Mary Morstan.",
        "source": "standard-ebooks",
        "source_identifier": "arthur-conan-doyle/the-sign-of-the-four",
        "source_url": "https://standardebooks.org/ebooks/arthur-conan-doyle/the-sign-of-the-four",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 2,
        "motif": "treasure-chest",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-memoirs-of-sherlock-holmes",
        "title": "The Memoirs of Sherlock Holmes",
        "author": "Arthur Conan Doyle",
        "publication_year": 1893,
        "categories": ["Mystery", "Detective Fiction", "Classics"],
        "description": "Eleven famous cases culminating in Holmes's dramatic showdown with Professor Moriarty at the Reichenbach Falls.",
        "source": "standard-ebooks",
        "source_identifier": "arthur-conan-doyle/the-memoirs-of-sherlock-holmes",
        "source_url": "https://standardebooks.org/ebooks/arthur-conan-doyle/the-memoirs-of-sherlock-holmes",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 0,
        "motif": "reichenbach-crest",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-return-of-sherlock-holmes",
        "title": "The Return of Sherlock Holmes",
        "author": "Arthur Conan Doyle",
        "publication_year": 1905,
        "categories": ["Mystery", "Detective Fiction", "Classics"],
        "description": "Sherlock Holmes miraculously returns to 221B Baker Street to solve thirteen new captivating puzzles with Dr. Watson.",
        "source": "standard-ebooks",
        "source_identifier": "arthur-conan-doyle/the-return-of-sherlock-holmes",
        "source_url": "https://standardebooks.org/ebooks/arthur-conan-doyle/the-return-of-sherlock-holmes",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 5,
        "motif": "dancing-men",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-mysterious-affair-at-styles",
        "title": "The Mysterious Affair at Styles",
        "author": "Agatha Christie",
        "publication_year": 1920,
        "categories": ["Mystery", "Detective Fiction", "Classics"],
        "description": "Agatha Christie's brilliant debut novel introducing the eccentric Belgian detective Hercule Poirot solving a poisoning at Styles Court.",
        "source": "standard-ebooks",
        "source_identifier": "agatha-christie/the-mysterious-affair-at-styles",
        "source_url": "https://standardebooks.org/ebooks/agatha-christie/the-mysterious-affair-at-styles",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 1,
        "motif": "poirot-mustache",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-secret-adversary",
        "title": "The Secret Adversary",
        "author": "Agatha Christie",
        "publication_year": 1922,
        "categories": ["Mystery", "Adventure", "Detective Fiction", "Classics"],
        "description": "The spirited young detective duo Tommy and Tuppence Beresford take on espionage, hidden treaties, and the elusive mastermind Mr. Brown.",
        "source": "standard-ebooks",
        "source_identifier": "agatha-christie/the-secret-adversary",
        "source_url": "https://standardebooks.org/ebooks/agatha-christie/the-secret-adversary",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 2,
        "motif": "daring-duo",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-murder-on-the-links",
        "title": "The Murder on the Links",
        "author": "Agatha Christie",
        "publication_year": 1923,
        "categories": ["Mystery", "Detective Fiction", "Classics"],
        "description": "Hercule Poirot travels to northern France to investigate a baffling murder on a golf course alongside his friend Arthur Hastings.",
        "source": "standard-ebooks",
        "source_identifier": "agatha-christie/the-murder-on-the-links",
        "source_url": "https://standardebooks.org/ebooks/agatha-christie/the-murder-on-the-links",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 7,
        "motif": "french-villa",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-man-in-the-brown-suit",
        "title": "The Man in the Brown Suit",
        "author": "Agatha Christie",
        "publication_year": 1924,
        "categories": ["Mystery", "Adventure", "Romance", "Classics"],
        "description": "Anne Beddingfeld plunges into international diamond smuggling, South African ocean voyages, and thrilling romantic adventure.",
        "source": "standard-ebooks",
        "source_identifier": "agatha-christie/the-man-in-the-brown-suit",
        "source_url": "https://standardebooks.org/ebooks/agatha-christie/the-man-in-the-brown-suit",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 5,
        "motif": "diamond-facet",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-secret-of-chimneys",
        "title": "The Secret of Chimneys",
        "author": "Agatha Christie",
        "publication_year": 1925,
        "categories": ["Mystery", "Detective Fiction", "Classics"],
        "description": "Anthony Cade is entangled in a murder mystery at an historic country estate involving royal memoirs, jewels, and Superintendent Battle.",
        "source": "standard-ebooks",
        "source_identifier": "agatha-christie/the-secret-of-chimneys",
        "source_url": "https://standardebooks.org/ebooks/agatha-christie/the-secret-of-chimneys",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 0,
        "motif": "chimneys-manor",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-murder-of-roger-ackroyd",
        "title": "The Murder of Roger Ackroyd",
        "author": "Agatha Christie",
        "publication_year": 1926,
        "categories": ["Mystery", "Detective Fiction", "Classics"],
        "description": "Christie's celebrated masterpiece featuring Hercule Poirot investigating a murder in King's Abbot with an unforgettable twist.",
        "source": "standard-ebooks",
        "source_identifier": "agatha-christie/the-murder-of-roger-ackroyd",
        "source_url": "https://standardebooks.org/ebooks/agatha-christie/the-murder-of-roger-ackroyd",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 4,
        "motif": "study-dagger",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-moonstone",
        "title": "The Moonstone",
        "author": "Wilkie Collins",
        "publication_year": 1868,
        "categories": ["Mystery", "Detective Fiction", "Victorian Literature", "Classics"],
        "description": "Regarded as the first modern English detective novel, following the theft of an invaluable sacred Indian diamond.",
        "source": "standard-ebooks",
        "source_identifier": "wilkie-collins/the-moonstone",
        "source_url": "https://standardebooks.org/ebooks/wilkie-collins/the-moonstone",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 0,
        "motif": "moonstone-gem",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-woman-in-white",
        "title": "The Woman in White",
        "author": "Wilkie Collins",
        "publication_year": 1859,
        "categories": ["Mystery", "Gothic Fiction", "Victorian Literature", "Classics"],
        "description": "A thrilling Victorian sensation novel involving mistaken identities, asylum escapes, and the villainous Count Fosco.",
        "source": "standard-ebooks",
        "source_identifier": "wilkie-collins/the-woman-in-white",
        "source_url": "https://standardebooks.org/ebooks/wilkie-collins/the-woman-in-white",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 5,
        "motif": "veiled-woman",
        "edition_tag": "Nook Edition"
    },

    # 41-55 SCIENCE FICTION & SPECULATIVE FICTION
    {
        "id": "the-time-machine",
        "title": "The Time Machine",
        "author": "H. G. Wells",
        "publication_year": 1895,
        "categories": ["Science Fiction", "Classics", "Dystopian", "Adventure"],
        "description": "A Victorian scientist invents a device to journey to the year 802,701 AD, discovering the gentle Eloi and the subterranean Morlocks.",
        "source": "standard-ebooks",
        "source_identifier": "h-g-wells/the-time-machine",
        "source_url": "https://standardebooks.org/ebooks/h-g-wells/the-time-machine",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 2,
        "motif": "time-dial",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-war-of-the-worlds",
        "title": "The War of the Worlds",
        "author": "H. G. Wells",
        "publication_year": 1898,
        "categories": ["Science Fiction", "Classics", "Horror", "Adventure"],
        "description": "Martian invaders arrive on Earth in deadly heat-ray tripods, plunging Victorian England into panic and desperate survival.",
        "source": "standard-ebooks",
        "source_identifier": "h-g-wells/the-war-of-the-worlds",
        "source_url": "https://standardebooks.org/ebooks/h-g-wells/the-war-of-the-worlds",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 6,
        "motif": "martian-tripod",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-invisible-man",
        "title": "The Invisible Man",
        "author": "H. G. Wells",
        "publication_year": 1897,
        "categories": ["Science Fiction", "Classics", "Horror", "Psychological Fiction"],
        "description": "A brilliant scientist discovers optics of invisibility but descends into megalomaniacal madness and terror.",
        "source": "standard-ebooks",
        "source_identifier": "h-g-wells/the-invisible-man",
        "source_url": "https://standardebooks.org/ebooks/h-g-wells/the-invisible-man",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 4,
        "motif": "bandaged-spectacles",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-island-of-doctor-moreau",
        "title": "The Island of Doctor Moreau",
        "author": "H. G. Wells",
        "publication_year": 1896,
        "categories": ["Science Fiction", "Horror", "Classics", "Gothic Fiction"],
        "description": "A shipwrecked man discovers a remote South Pacific island where a disgraced scientist conducts terrifying biological experiments.",
        "source": "standard-ebooks",
        "source_identifier": "h-g-wells/the-island-of-doctor-moreau",
        "source_url": "https://standardebooks.org/ebooks/h-g-wells/the-island-of-doctor-moreau",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 1,
        "motif": "tropical-island",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "twenty-thousand-leagues-under-the-sea",
        "title": "Twenty Thousand Leagues Under the Sea",
        "author": "Jules Verne",
        "publication_year": 1870,
        "categories": ["Science Fiction", "Adventure", "Classics"],
        "description": "Captain Nemo commands the futuristic submarine Nautilus on an extraordinary voyage beneath the world's oceans.",
        "source": "gutenberg",
        "source_identifier": "164",
        "source_url": "https://www.gutenberg.org/ebooks/164",
        "license_or_rights": "Public Domain in the USA",
        "palette_idx": 0,
        "motif": "nautilus-submarine",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "journey-to-the-center-of-the-earth",
        "title": "Journey to the Center of the Earth",
        "author": "Jules Verne",
        "publication_year": 1864,
        "categories": ["Science Fiction", "Adventure", "Classics"],
        "description": "Professor Lidenbrock, his nephew Axel, and their guide Hans descend through an Icelandic volcano into prehistoric subterranean wonders.",
        "source": "gutenberg",
        "source_identifier": "18857",
        "source_url": "https://www.gutenberg.org/ebooks/18857",
        "license_or_rights": "Public Domain in the USA",
        "palette_idx": 5,
        "motif": "volcanic-compass",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "around-the-world-in-eighty-days",
        "title": "Around the World in Eighty Days",
        "author": "Jules Verne",
        "publication_year": 1872,
        "categories": ["Adventure", "Classics", "Historical Fiction"],
        "description": "The unflappable Phileas Fogg and his valet Passepartout attempt to circumnavigate the globe in eighty days on a high-stakes wager.",
        "source": "standard-ebooks",
        "source_identifier": "jules-verne/around-the-world-in-eighty-days/george-makepeace-towle",
        "source_url": "https://standardebooks.org/ebooks/jules-verne/around-the-world-in-eighty-days",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 2,
        "motif": "steam-locomotive",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-lost-world",
        "title": "The Lost World",
        "author": "Arthur Conan Doyle",
        "publication_year": 1912,
        "categories": ["Science Fiction", "Adventure", "Classics"],
        "description": "Professor Challenger leads an expedition to an isolated South American plateau where living dinosaurs still roam.",
        "source": "standard-ebooks",
        "source_identifier": "arthur-conan-doyle/the-lost-world",
        "source_url": "https://standardebooks.org/ebooks/arthur-conan-doyle/the-lost-world",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 7,
        "motif": "pterodactyl-wing",
        "edition_tag": "Nook Edition"
    },

    # 56-70 FANTASY, CHILDREN'S & CLASSIC YA
    {
        "id": "the-wonderful-wizard-of-oz",
        "title": "The Wonderful Wizard of Oz",
        "author": "L. Frank Baum",
        "publication_year": 1900,
        "categories": ["Fantasy", "Children's Literature", "Classics", "Adventure"],
        "description": "Dorothy and her dog Toto are swept by a Kansas cyclone to the magical Land of Oz, seeking the Emerald City.",
        "source": "standard-ebooks",
        "source_identifier": "l-frank-baum/the-wonderful-wizard-of-oz",
        "source_url": "https://standardebooks.org/ebooks/l-frank-baum/the-wonderful-wizard-of-oz",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 1,
        "motif": "emerald-slippers",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "peter-and-wendy",
        "title": "Peter and Wendy",
        "author": "J. M. Barrie",
        "publication_year": 1911,
        "categories": ["Fantasy", "Children's Literature", "Classics", "Adventure"],
        "description": "The boy who wouldn't grow up leads Wendy, John, and Michael Darling to Neverland to battle Captain Hook.",
        "source": "standard-ebooks",
        "source_identifier": "j-m-barrie/peter-and-wendy",
        "source_url": "https://standardebooks.org/ebooks/j-m-barrie/peter-and-wendy",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 0,
        "motif": "fairy-feather",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-secret-garden",
        "title": "The Secret Garden",
        "author": "Frances Hodgson Burnett",
        "publication_year": 1911,
        "categories": ["Children's Literature", "Classics", "Coming-of-Age"],
        "description": "Orphaned Mary Lennox uncovers an overgrown walled garden and helps bring healing to Misselthwaite Manor.",
        "source": "standard-ebooks",
        "source_identifier": "frances-hodgson-burnett/the-secret-garden",
        "source_url": "https://standardebooks.org/ebooks/frances-hodgson-burnett/the-secret-garden",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 1,
        "motif": "ivy-key",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "a-little-princess",
        "title": "A Little Princess",
        "author": "Frances Hodgson Burnett",
        "publication_year": 1905,
        "categories": ["Children's Literature", "Classics", "Coming-of-Age"],
        "description": "Sara Crewe relies on imagination and inner kindness when sudden misfortune strikes her boarding school life.",
        "source": "standard-ebooks",
        "source_identifier": "frances-hodgson-burnett/a-little-princess",
        "source_url": "https://standardebooks.org/ebooks/frances-hodgson-burnett/a-little-princess",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 3,
        "motif": "attic-hearth",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "little-women",
        "title": "Little Women",
        "author": "Louisa May Alcott",
        "publication_year": 1868,
        "categories": ["Classics", "Coming-of-Age", "Romance", "Historical Fiction"],
        "description": "The heartwarming coming-of-age chronicle of the four March sisters—Meg, Jo, Beth, and Amy—in Civil War-era Massachusetts.",
        "source": "standard-ebooks",
        "source_identifier": "louisa-may-alcott/little-women",
        "source_url": "https://standardebooks.org/ebooks/louisa-may-alcott/little-women",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 5,
        "motif": "orchard-house",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "little-men",
        "title": "Little Men",
        "author": "Louisa May Alcott",
        "publication_year": 1871,
        "categories": ["Children's Literature", "Classics", "Coming-of-Age"],
        "description": "Jo March and Professor Bhaer establish an unconventional and joyful school for spirited young boys at Plumfield.",
        "source": "gutenberg",
        "source_identifier": "2788",
        "source_url": "https://www.gutenberg.org/ebooks/2788",
        "license_or_rights": "Public Domain in the USA",
        "palette_idx": 2,
        "motif": "schoolhouse-bell",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "jos-boys",
        "title": "Jo's Boys",
        "author": "Louisa May Alcott",
        "publication_year": 1886,
        "categories": ["Children's Literature", "Classics", "Coming-of-Age"],
        "description": "The concluding volume of the March family saga, following the Plumfield boys as they enter adulthood and careers.",
        "source": "gutenberg",
        "source_identifier": "2789",
        "source_url": "https://www.gutenberg.org/ebooks/2789",
        "license_or_rights": "Public Domain in the USA",
        "palette_idx": 4,
        "motif": "laurel-wreath",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "anne-of-green-gables",
        "title": "Anne of Green Gables",
        "author": "L. M. Montgomery",
        "publication_year": 1908,
        "categories": ["Children's Literature", "Classics", "Coming-of-Age", "Romance"],
        "description": "The endearing, imaginative redheaded orphan Anne Shirley transforms Prince Edward Island with her irrepressible spirit.",
        "source": "standard-ebooks",
        "source_identifier": "l-m-montgomery/anne-of-green-gables",
        "source_url": "https://standardebooks.org/ebooks/l-m-montgomery/anne-of-green-gables",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 1,
        "motif": "green-gables",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "anne-of-avonlea",
        "title": "Anne of Avonlea",
        "author": "L. M. Montgomery",
        "publication_year": 1909,
        "categories": ["Children's Literature", "Classics", "Coming-of-Age"],
        "description": "Anne Shirley steps into the role of schoolteacher in Avonlea, continuing her cheerful misadventures.",
        "source": "standard-ebooks",
        "source_identifier": "l-m-montgomery/anne-of-avonlea",
        "source_url": "https://standardebooks.org/ebooks/l-m-montgomery/anne-of-avonlea",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 2,
        "motif": "island-blossom",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "anne-of-the-island",
        "title": "Anne of the Island",
        "author": "L. M. Montgomery",
        "publication_year": 1915,
        "categories": ["Children's Literature", "Romance", "Classics", "Coming-of-Age"],
        "description": "Anne Shirley leaves Avonlea for Redmond College, balancing higher education, friendships, and suitors.",
        "source": "standard-ebooks",
        "source_identifier": "l-m-montgomery/anne-of-the-island",
        "source_url": "https://standardebooks.org/ebooks/l-m-montgomery/anne-of-the-island",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 3,
        "motif": "college-ivy",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-wind-in-the-willows",
        "title": "The Wind in the Willows",
        "author": "Kenneth Grahame",
        "publication_year": 1908,
        "categories": ["Children's Literature", "Fantasy", "Classics"],
        "description": "The beloved pastoral adventures of Mole, Ratty, Badger, and the impulsive Mr. Toad along the English riverbank.",
        "source": "standard-ebooks",
        "source_identifier": "kenneth-grahame/the-wind-in-the-willows",
        "source_url": "https://standardebooks.org/ebooks/kenneth-grahame/the-wind-in-the-willows",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 7,
        "motif": "river-willow",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-jungle-book",
        "title": "The Jungle Book",
        "author": "Rudyard Kipling",
        "publication_year": 1894,
        "categories": ["Children's Literature", "Adventure", "Classics"],
        "description": "Mowgli the man-cub is raised by wolves in the Indian jungle with the aid of Baloo the bear and Bagheera the panther.",
        "source": "standard-ebooks",
        "source_identifier": "rudyard-kipling/the-jungle-book",
        "source_url": "https://standardebooks.org/ebooks/rudyard-kipling/the-jungle-book",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 1,
        "motif": "jungle-leaf",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-second-jungle-book",
        "title": "The Second Jungle Book",
        "author": "Rudyard Kipling",
        "publication_year": 1895,
        "categories": ["Children's Literature", "Adventure", "Classics"],
        "description": "Further enchanting tales of Mowgli and the animals of the Seeonee jungle as he matures toward adulthood.",
        "source": "gutenberg",
        "source_identifier": "1937",
        "source_url": "https://www.gutenberg.org/ebooks/1937",
        "license_or_rights": "Public Domain in the USA",
        "palette_idx": 7,
        "motif": "tiger-claw",
        "edition_tag": "Nook Edition"
    },

    # 71-85 ADVENTURE & HISTORICAL NOVELS
    {
        "id": "treasure-island",
        "title": "Treasure Island",
        "author": "Robert Louis Stevenson",
        "publication_year": 1883,
        "categories": ["Adventure", "Classics", "Children's Literature"],
        "description": "Young Jim Hawkins sails aboard the Hispaniola in search of buried pirate gold while contending with Long John Silver.",
        "source": "standard-ebooks",
        "source_identifier": "robert-louis-stevenson/treasure-island",
        "source_url": "https://standardebooks.org/ebooks/robert-louis-stevenson/treasure-island",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 5,
        "motif": "skull-crossbones",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "kidnapped",
        "title": "Kidnapped",
        "author": "Robert Louis Stevenson",
        "publication_year": 1886,
        "categories": ["Adventure", "Historical Fiction", "Classics"],
        "description": "David Balfour is betrayed by his uncle, kidnapped at sea, and journeys across the Scottish Highlands with Alan Breck Stewart.",
        "source": "standard-ebooks",
        "source_identifier": "robert-louis-stevenson/kidnapped",
        "source_url": "https://standardebooks.org/ebooks/robert-louis-stevenson/kidnapped",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 0,
        "motif": "highland-heather",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-call-of-the-wild",
        "title": "The Call of the Wild",
        "author": "Jack London",
        "publication_year": 1903,
        "categories": ["Adventure", "Classics", "Nature"],
        "description": "Buck, a pampered domestic dog, is stolen and sold into the brutal Klondike Gold Rush, awakening his ancestral instincts.",
        "source": "standard-ebooks",
        "source_identifier": "jack-london/the-call-of-the-wild",
        "source_url": "https://standardebooks.org/ebooks/jack-london/the-call-of-the-wild",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 4,
        "motif": "yukon-wolf",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "white-fang",
        "title": "White Fang",
        "author": "Jack London",
        "publication_year": 1906,
        "categories": ["Adventure", "Classics", "Nature"],
        "description": "The companion story to Call of the Wild, charting a wild wolf-dog's journey from the harsh Yukon wilderness to human affection.",
        "source": "standard-ebooks",
        "source_identifier": "jack-london/white-fang",
        "source_url": "https://standardebooks.org/ebooks/jack-london/white-fang",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 0,
        "motif": "glacier-fang",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-sea-wolf",
        "title": "The Sea-Wolf",
        "author": "Jack London",
        "publication_year": 1904,
        "categories": ["Adventure", "Psychological Fiction", "Classics"],
        "description": "Humphrey Van Weyden is rescued from a ferry accident by the brutal sealing schooner captain Wolf Larsen.",
        "source": "standard-ebooks",
        "source_identifier": "jack-london/the-sea-wolf",
        "source_url": "https://standardebooks.org/ebooks/jack-london/the-sea-wolf",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 7,
        "motif": "schooner-helm",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-count-of-monte-cristo",
        "title": "The Count of Monte Cristo",
        "author": "Alexandre Dumas",
        "publication_year": 1844,
        "categories": ["Adventure", "Historical Fiction", "Classics", "Drama"],
        "description": "Edmond Dantès is falsely imprisoned in the Château d'If, escapes with a secret fortune, and exacts meticulous revenge.",
        "source": "standard-ebooks",
        "source_identifier": "alexandre-dumas/the-count-of-monte-cristo/chapman-and-hall",
        "source_url": "https://standardebooks.org/ebooks/alexandre-dumas/the-count-of-monte-cristo",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 6,
        "motif": "fortress-keys",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-three-musketeers",
        "title": "The Three Musketeers",
        "author": "Alexandre Dumas",
        "publication_year": 1844,
        "categories": ["Adventure", "Historical Fiction", "Classics"],
        "description": "Young d'Artagnan joins Athos, Porthos, and Aramis in chivalric swashbuckling intrigue against Cardinal Richelieu.",
        "source": "standard-ebooks",
        "source_identifier": "alexandre-dumas/the-three-musketeers/william-robson",
        "source_url": "https://standardebooks.org/ebooks/alexandre-dumas/the-three-musketeers",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 2,
        "motif": "crossed-rapiers",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "twenty-years-after",
        "title": "Twenty Years After",
        "author": "Alexandre Dumas",
        "publication_year": 1845,
        "categories": ["Adventure", "Historical Fiction", "Classics"],
        "description": "The four musketeers reunite twenty years later during the Fronde uprising and the English Civil War.",
        "source": "gutenberg",
        "source_identifier": "1259",
        "source_url": "https://www.gutenberg.org/ebooks/1259",
        "license_or_rights": "Public Domain in the USA",
        "palette_idx": 4,
        "motif": "fleur-de-lis",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-adventures-of-tom-sawyer",
        "title": "The Adventures of Tom Sawyer",
        "author": "Mark Twain",
        "publication_year": 1876,
        "categories": ["Adventure", "Classics", "Coming-of-Age", "Satire"],
        "description": "Tom Sawyer's lively escapades along the Mississippi River, from whitewashing fences to witnessing grave robberies.",
        "source": "standard-ebooks",
        "source_identifier": "mark-twain/the-adventures-of-tom-sawyer",
        "source_url": "https://standardebooks.org/ebooks/mark-twain/the-adventures-of-tom-sawyer",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 5,
        "motif": "mississippi-raft",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "adventures-of-huckleberry-finn",
        "title": "Adventures of Huckleberry Finn",
        "author": "Mark Twain",
        "publication_year": 1884,
        "categories": ["Classics", "Adventure", "Satire", "Historical Fiction"],
        "description": "Huck Finn and the runaway slave Jim journey down the Mississippi River in search of freedom and moral truth.",
        "source": "standard-ebooks",
        "source_identifier": "mark-twain/the-adventures-of-huckleberry-finn",
        "source_url": "https://standardebooks.org/ebooks/mark-twain/the-adventures-of-huckleberry-finn",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 1,
        "motif": "riverboat-paddle",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-prince-and-the-pauper",
        "title": "The Prince and the Pauper",
        "author": "Mark Twain",
        "publication_year": 1881,
        "categories": ["Historical Fiction", "Classics", "Children's Literature"],
        "description": "Two identical young boys—Prince Edward and the pauper Tom Canty—switch places in 16th-century London.",
        "source": "standard-ebooks",
        "source_identifier": "mark-twain/the-prince-and-the-pauper",
        "source_url": "https://standardebooks.org/ebooks/mark-twain/the-prince-and-the-pauper",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 3,
        "motif": "tudor-crown",
        "edition_tag": "Nook Edition"
    },

    # 86-105 LITERARY FICTION, DRAMA & WORLD CLASSICS
    {
        "id": "moby-dick",
        "title": "Moby-Dick; or, The Whale",
        "author": "Herman Melville",
        "publication_year": 1851,
        "categories": ["Classics", "Adventure", "Literary Fiction", "Philosophy"],
        "description": "Captain Ahab obsessively steers the whaling ship Pequod across the seas to hunt the legendary white whale.",
        "source": "standard-ebooks",
        "source_identifier": "herman-melville/moby-dick",
        "source_url": "https://standardebooks.org/ebooks/herman-melville/moby-dick",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 0,
        "motif": "whale-tail",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "bartleby-the-scrivener",
        "title": "Bartleby, the Scrivener",
        "author": "Herman Melville",
        "publication_year": 1853,
        "categories": ["Classics", "Literary Fiction", "Novella"],
        "description": "A Wall Street lawyer's life is disrupted by a quiet copyist who steadfastly declares, 'I would prefer not to.'",
        "source": "gutenberg",
        "source_identifier": "11231",
        "source_url": "https://www.gutenberg.org/ebooks/11231",
        "license_or_rights": "Public Domain in the USA",
        "palette_idx": 4,
        "motif": "scrivener-quill",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "crime-and-punishment",
        "title": "Crime and Punishment",
        "author": "Fyodor Dostoevsky",
        "publication_year": 1866,
        "categories": ["Classics", "Psychological Fiction", "Literary Fiction", "Philosophy"],
        "description": "Impoverished student Rodion Raskolnikov commits murder in Saint Petersburg and grapples with intense guilt and redemption.",
        "source": "standard-ebooks",
        "source_identifier": "fyodor-dostoevsky/crime-and-punishment/constance-garnett",
        "source_url": "https://standardebooks.org/ebooks/fyodor-dostoevsky/crime-and-punishment",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 6,
        "motif": "orthodox-cross",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "notes-from-underground",
        "title": "Notes from Underground",
        "author": "Fyodor Dostoevsky",
        "publication_year": 1864,
        "categories": ["Classics", "Philosophy", "Psychological Fiction", "Novella"],
        "description": "The bitter, existential confessional diary of a retired civil servant living alienated in Saint Petersburg.",
        "source": "standard-ebooks",
        "source_identifier": "fyodor-dostoevsky/notes-from-underground/constance-garnett",
        "source_url": "https://standardebooks.org/ebooks/fyodor-dostoevsky/notes-from-underground",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 4,
        "motif": "subterranean-lamp",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-brothers-karamazov",
        "title": "The Brothers Karamazov",
        "author": "Fyodor Dostoevsky",
        "publication_year": 1880,
        "categories": ["Classics", "Literary Fiction", "Philosophy", "Drama"],
        "description": "Dostoevsky's monumental epic exploring faith, free will, morality, and patricide through the three Karamazov brothers.",
        "source": "standard-ebooks",
        "source_identifier": "fyodor-dostoevsky/the-brothers-karamazov/constance-garnett",
        "source_url": "https://standardebooks.org/ebooks/fyodor-dostoevsky/the-brothers-karamazov",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 5,
        "motif": "cathedral-dome",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-idiot",
        "title": "The Idiot",
        "author": "Fyodor Dostoevsky",
        "publication_year": 1869,
        "categories": ["Classics", "Literary Fiction", "Psychological Fiction"],
        "description": "The saintly, guileless Prince Myshkin enters Russian high society with tragic consequences.",
        "source": "standard-ebooks",
        "source_identifier": "fyodor-dostoevsky/the-idiot/eva-m-martin",
        "source_url": "https://standardebooks.org/ebooks/fyodor-dostoevsky/the-idiot",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 7,
        "motif": "snow-carriage",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "war-and-peace",
        "title": "War and Peace",
        "author": "Leo Tolstoy",
        "publication_year": 1869,
        "categories": ["Classics", "Historical Fiction", "Literary Fiction", "Philosophy"],
        "description": "Tolstoy's masterwork weaving five aristocratic Russian families through Napoleon's 1812 invasion of Russia.",
        "source": "standard-ebooks",
        "source_identifier": "leo-tolstoy/war-and-peace/louise-maude_aylmer-maude",
        "source_url": "https://standardebooks.org/ebooks/leo-tolstoy/war-and-peace",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 6,
        "motif": "imperial-eagle",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "anna-karenina",
        "title": "Anna Karenina",
        "author": "Leo Tolstoy",
        "publication_year": 1878,
        "categories": ["Classics", "Romance", "Literary Fiction", "Drama"],
        "description": "The tragic passion of Anna Karenina and Count Vronsky contrasted with Levin's search for rural fulfillment.",
        "source": "standard-ebooks",
        "source_identifier": "leo-tolstoy/anna-karenina/constance-garnett",
        "source_url": "https://standardebooks.org/ebooks/leo-tolstoy/anna-karenina",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 3,
        "motif": "train-tracks",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-death-of-ivan-ilyich",
        "title": "The Death of Ivan Ilyich",
        "author": "Leo Tolstoy",
        "publication_year": 1886,
        "categories": ["Classics", "Philosophical Fiction", "Novella"],
        "description": "A High Court judge confronts mortality and the hollow vanity of his bourgeois existence in Tolstoy's profound novella.",
        "source": "gutenberg",
        "source_identifier": "289",
        "source_url": "https://www.gutenberg.org/ebooks/289",
        "license_or_rights": "Public Domain in the USA",
        "palette_idx": 4,
        "motif": "hourglass-candle",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "madame-bovary",
        "title": "Madame Bovary",
        "author": "Gustave Flaubert",
        "publication_year": 1856,
        "categories": ["Classics", "Literary Fiction", "Romance", "Tragedy"],
        "description": "Emma Bovary seeks romantic ecstasy and luxury to escape the suffocating banality of provincial French marriage.",
        "source": "standard-ebooks",
        "source_identifier": "gustave-flaubert/madame-bovary/eleanor-marx-aveling",
        "source_url": "https://standardebooks.org/ebooks/gustave-flaubert/madame-bovary",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 3,
        "motif": "norman-lace",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "les-miserables",
        "title": "Les Misérables",
        "author": "Victor Hugo",
        "publication_year": 1862,
        "categories": ["Classics", "Historical Fiction", "Literary Fiction", "Drama"],
        "description": "The epic story of ex-convict Jean Valjean's redemption and pursuit by Inspector Javert amidst the 1832 Paris Uprising.",
        "source": "standard-ebooks",
        "source_identifier": "victor-hugo/les-miserables/isabel-f-hapgood",
        "source_url": "https://standardebooks.org/ebooks/victor-hugo/les-miserables",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 0,
        "motif": "barricade-banner",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-hunchback-of-notre-dame",
        "title": "The Hunchback of Notre-Dame",
        "author": "Victor Hugo",
        "publication_year": 1831,
        "categories": ["Gothic Fiction", "Historical Fiction", "Classics", "Tragedy"],
        "description": "The deformed bell-ringer Quasimodo risks everything to protect the kind-hearted dancer Esmeralda in medieval Paris.",
        "source": "gutenberg",
        "source_identifier": "2610",
        "source_url": "https://www.gutenberg.org/ebooks/2610",
        "license_or_rights": "Public Domain in the USA",
        "palette_idx": 6,
        "motif": "notre-dame-rose",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "great-expectations",
        "title": "Great Expectations",
        "author": "Charles Dickens",
        "publication_year": 1861,
        "categories": ["Classics", "Victorian Literature", "Coming-of-Age", "Literary Fiction"],
        "description": "The orphan Pip rises to London gentlemanhood under the influence of an anonymous benefactor, Miss Havisham, and Estella.",
        "source": "standard-ebooks",
        "source_identifier": "charles-dickens/great-expectations",
        "source_url": "https://standardebooks.org/ebooks/charles-dickens/great-expectations",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 1,
        "motif": "satis-house",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "a-tale-of-two-cities",
        "title": "A Tale of Two Cities",
        "author": "Charles Dickens",
        "publication_year": 1859,
        "categories": ["Historical Fiction", "Classics", "Drama", "Tragedy"],
        "description": "Set in London and Paris during the Reign of Terror, culminating in Sydney Carton's supreme act of self-sacrifice.",
        "source": "standard-ebooks",
        "source_identifier": "charles-dickens/a-tale-of-two-cities",
        "source_url": "https://standardebooks.org/ebooks/charles-dickens/a-tale-of-two-cities",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 6,
        "motif": "guillotine-shadow",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "david-copperfield",
        "title": "David Copperfield",
        "author": "Charles Dickens",
        "publication_year": 1850,
        "categories": ["Classics", "Coming-of-Age", "Victorian Literature", "Literary Fiction"],
        "description": "Dickens's favorite semi-autobiographical novel charting David's journey from an unhappy childhood to successful author.",
        "source": "standard-ebooks",
        "source_identifier": "charles-dickens/david-copperfield",
        "source_url": "https://standardebooks.org/ebooks/charles-dickens/david-copperfield",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 0,
        "motif": "peggotty-boat",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "oliver-twist",
        "title": "Oliver Twist",
        "author": "Charles Dickens",
        "publication_year": 1838,
        "categories": ["Classics", "Victorian Literature", "Coming-of-Age", "Drama"],
        "description": "The orphan Oliver Twist escapes a cruel parish workhouse and falls in with Fagin's gang of juvenile pickpockets in London.",
        "source": "standard-ebooks",
        "source_identifier": "charles-dickens/oliver-twist",
        "source_url": "https://standardebooks.org/ebooks/charles-dickens/oliver-twist",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 4,
        "motif": "london-bridge",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "a-christmas-carol",
        "title": "A Christmas Carol",
        "author": "Charles Dickens",
        "publication_year": 1843,
        "categories": ["Classics", "Fantasy", "Holiday", "Novella"],
        "description": "The miserly Ebenezer Scrooge is visited on Christmas Eve by the Ghosts of Christmas Past, Present, and Yet to Come.",
        "source": "standard-ebooks",
        "source_identifier": "charles-dickens/a-christmas-carol",
        "source_url": "https://standardebooks.org/ebooks/charles-dickens/a-christmas-carol",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 7,
        "motif": "holly-bell",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-metamorphosis",
        "title": "The Metamorphosis",
        "author": "Franz Kafka",
        "publication_year": 1915,
        "categories": ["Classics", "Absurdist Fiction", "Psychological Fiction", "Novella"],
        "description": "Gregor Samsa wakes up one morning to discover he has been transformed into a monstrous vermin.",
        "source": "gutenberg",
        "source_identifier": "5200",
        "source_url": "https://www.gutenberg.org/ebooks/5200",
        "license_or_rights": "Public Domain in the USA",
        "palette_idx": 5,
        "motif": "beetle-silhouette",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-trial",
        "title": "The Trial",
        "author": "Franz Kafka",
        "publication_year": 1925,
        "categories": ["Classics", "Absurdist Fiction", "Literary Fiction", "Philosophy"],
        "description": "Josef K. is suddenly arrested and prosecuted by a remote, inaccessible authority without ever learning the nature of his crime.",
        "source": "gutenberg",
        "source_identifier": "7849",
        "source_url": "https://www.gutenberg.org/ebooks/7849",
        "license_or_rights": "Public Domain in the USA",
        "palette_idx": 4,
        "motif": "courtroom-pillars",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "dubliners",
        "title": "Dubliners",
        "author": "James Joyce",
        "publication_year": 1914,
        "categories": ["Classics", "Literary Fiction", "Short Stories"],
        "description": "Fifteen illuminating portraits of Irish middle-class life in and around Dublin at the turn of the 20th century.",
        "source": "standard-ebooks",
        "source_identifier": "james-joyce/dubliners",
        "source_url": "https://standardebooks.org/ebooks/james-joyce/dubliners",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 1,
        "motif": "dublin-bridge",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "a-portrait-of-the-artist-as-a-young-man",
        "title": "A Portrait of the Artist as a Young Man",
        "author": "James Joyce",
        "publication_year": 1916,
        "categories": ["Classics", "Coming-of-Age", "Literary Fiction", "Modernist"],
        "description": "Stephen Dedalus rebels against religious, familial, and national constraints to dedicate his life to art.",
        "source": "standard-ebooks",
        "source_identifier": "james-joyce/a-portrait-of-the-artist-as-a-young-man",
        "source_url": "https://standardebooks.org/ebooks/james-joyce/a-portrait-of-the-artist-as-a-young-man",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 0,
        "motif": "daedalus-wings",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-awakening",
        "title": "The Awakening",
        "author": "Kate Chopin",
        "publication_year": 1899,
        "categories": ["Classics", "Romance", "Literary Fiction", "Drama"],
        "description": "Edna Pontellier discovers personal autonomy, artistic passion, and sensual freedom along the Louisiana Gulf Coast.",
        "source": "standard-ebooks",
        "source_identifier": "kate-chopin/the-awakening",
        "source_url": "https://standardebooks.org/ebooks/kate-chopin/the-awakening",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 2,
        "motif": "gulf-waves",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "heart-of-darkness",
        "title": "Heart of Darkness",
        "author": "Joseph Conrad",
        "publication_year": 1899,
        "categories": ["Classics", "Psychological Fiction", "Novella", "Adventure"],
        "description": "Charles Marlow journeys up the Congo River in search of the enigmatic, ivory-trading Kurtz.",
        "source": "standard-ebooks",
        "source_identifier": "joseph-conrad/heart-of-darkness",
        "source_url": "https://standardebooks.org/ebooks/joseph-conrad/heart-of-darkness",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 4,
        "motif": "congo-steamboat",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-secret-agent",
        "title": "The Secret Agent",
        "author": "Joseph Conrad",
        "publication_year": 1907,
        "categories": ["Mystery", "Thriller", "Classics", "Political Fiction"],
        "description": "A dark, gripping espionage tale set in Victorian London involving double agents, anarchists, and Greenwich Observatory.",
        "source": "standard-ebooks",
        "source_identifier": "joseph-conrad/the-secret-agent",
        "source_url": "https://standardebooks.org/ebooks/joseph-conrad/the-secret-agent",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 6,
        "motif": "greenwich-chronometer",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "tess-of-the-durbervilles",
        "title": "Tess of the d'Urbervilles",
        "author": "Thomas Hardy",
        "publication_year": 1891,
        "categories": ["Classics", "Victorian Literature", "Romance", "Tragedy"],
        "description": "Tess Durbeyfield endures moral prejudice, social hypocrisy, and tragic love in pastoral Wessex.",
        "source": "standard-ebooks",
        "source_identifier": "thomas-hardy/tess-of-the-durbervilles",
        "source_url": "https://standardebooks.org/ebooks/thomas-hardy/tess-of-the-durbervilles",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 1,
        "motif": "stonehenge-sun",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "far-from-the-madding-crowd",
        "title": "Far from the Madding Crowd",
        "author": "Thomas Hardy",
        "publication_year": 1874,
        "categories": ["Romance", "Victorian Literature", "Classics", "Drama"],
        "description": "The spirited Bathsheba Everdene manages her own farm while pursued by three contrasting suitors in rural England.",
        "source": "standard-ebooks",
        "source_identifier": "thomas-hardy/far-from-the-madding-crowd",
        "source_url": "https://standardebooks.org/ebooks/thomas-hardy/far-from-the-madding-crowd",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 5,
        "motif": "wessex-flock",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-mayor-of-casterbridge",
        "title": "The Mayor of Casterbridge",
        "author": "Thomas Hardy",
        "publication_year": 1886,
        "categories": ["Classics", "Victorian Literature", "Tragedy", "Drama"],
        "description": "Michael Henchard's past misdeed comes back to haunt him as he rises and falls in the town of Casterbridge.",
        "source": "standard-ebooks",
        "source_identifier": "thomas-hardy/the-mayor-of-casterbridge",
        "source_url": "https://standardebooks.org/ebooks/thomas-hardy/the-mayor-of-casterbridge",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 7,
        "motif": "town-hall-clock",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-odyssey",
        "title": "The Odyssey",
        "author": "Homer",
        "publication_year": -800,
        "categories": ["Classics", "Epic Poetry", "Adventure", "Mythology"],
        "description": "The ten-year journey of Odysseus returning home to Ithaca after the fall of Troy, confronting monsters and sirens.",
        "source": "gutenberg",
        "source_identifier": "1727",
        "source_url": "https://www.gutenberg.org/ebooks/1727",
        "license_or_rights": "Public Domain in the USA",
        "palette_idx": 0,
        "motif": "greek-galley",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-iliad",
        "title": "The Iliad",
        "author": "Homer",
        "publication_year": -800,
        "categories": ["Classics", "Epic Poetry", "Historical Fiction", "Mythology"],
        "description": "The wrath of Achilles and the fierce siege of Troy during the final weeks of the Trojan War.",
        "source": "gutenberg",
        "source_identifier": "6130",
        "source_url": "https://www.gutenberg.org/ebooks/6130",
        "license_or_rights": "Public Domain in the USA",
        "palette_idx": 6,
        "motif": "trojan-helm",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "meditations",
        "title": "Meditations",
        "author": "Marcus Aurelius",
        "publication_year": 180,
        "categories": ["Philosophy", "Classics", "Non-Fiction"],
        "description": "The private Stoic reflections and ethical journaling of Roman Emperor Marcus Aurelius on duty, self-discipline, and nature.",
        "source": "standard-ebooks",
        "source_identifier": "marcus-aurelius/meditations/george-long",
        "source_url": "https://standardebooks.org/ebooks/marcus-aurelius/meditations",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 4,
        "motif": "stoic-column",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-importance-of-being-earnest",
        "title": "The Importance of Being Earnest",
        "author": "Oscar Wilde",
        "publication_year": 1895,
        "categories": ["Drama", "Satire", "Classics", "Comedy"],
        "description": "Wilde's sparkling farcical comedy of manners concerning fictitious personas, cucumber sandwiches, and matrimonial confusion.",
        "source": "project-gutenberg",
        "source_identifier": "844",
        "source_url": "https://www.gutenberg.org/ebooks/844",
        "license_or_rights": "Public Domain in the USA",
        "palette_idx": 2,
        "motif": "victorian-handbag",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "silas-marner",
        "title": "Silas Marner",
        "author": "George Eliot",
        "publication_year": 1861,
        "categories": ["Classics", "Victorian Literature", "Drama", "Literary Fiction"],
        "description": "An embittered weaver finds redemption and purpose when a golden-haired foundling child wanders into his secluded cottage.",
        "source": "standard-ebooks",
        "source_identifier": "george-eliot/silas-marner",
        "source_url": "https://standardebooks.org/ebooks/george-eliot/silas-marner",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 1,
        "motif": "golden-hearth",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-first-men-in-the-moon",
        "title": "The First Men in the Moon",
        "author": "H. G. Wells",
        "publication_year": 1901,
        "categories": ["Science Fiction", "Classics", "Adventure", "Space Fiction"],
        "description": "Mr. Bedford and the eccentric scientist Dr. Cavor invent cavorite and journey to the Moon, discovering the underground Selenite civilization.",
        "source": "standard-ebooks",
        "source_identifier": "h-g-wells/the-first-men-in-the-moon",
        "source_url": "https://standardebooks.org/ebooks/h-g-wells/the-first-men-in-the-moon",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 0,
        "motif": "lunar-crescent",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-red-badge-of-courage",
        "title": "The Red Badge of Courage",
        "author": "Stephen Crane",
        "publication_year": 1895,
        "categories": ["Historical Fiction", "Classics", "War", "Psychological"],
        "description": "Young Union soldier Henry Fleming confronts fear, duty, and the brutal reality of the American Civil War.",
        "source": "standard-ebooks",
        "source_identifier": "stephen-crane/the-red-badge-of-courage",
        "source_url": "https://standardebooks.org/ebooks/stephen-crane/the-red-badge-of-courage",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 6,
        "motif": "battle-banner",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-scarlet-pimpernel",
        "title": "The Scarlet Pimpernel",
        "author": "Baroness Orczy",
        "publication_year": 1905,
        "categories": ["Historical Fiction", "Adventure", "Classics", "Romance"],
        "description": "During the Reign of Terror, a chivalrous English aristocrat in disguise rescues condemned French nobles from the guillotine.",
        "source": "standard-ebooks",
        "source_identifier": "baroness-orczy/the-scarlet-pimpernel",
        "source_url": "https://standardebooks.org/ebooks/baroness-orczy/the-scarlet-pimpernel",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 7,
        "motif": "scarlet-flower",
        "edition_tag": "Nook Edition"
    },
    {
        "id": "the-prisoner-of-zenda",
        "title": "The Prisoner of Zenda",
        "author": "Anthony Hope",
        "publication_year": 1894,
        "categories": ["Adventure", "Classics", "Romance", "Historical Fiction"],
        "description": "Rudolf Rassendyll impersonates his royal doppelgänger, the King of Ruritania, to save him from abduction and palace intrigue.",
        "source": "standard-ebooks",
        "source_identifier": "anthony-hope/the-prisoner-of-zenda",
        "source_url": "https://standardebooks.org/ebooks/anthony-hope/the-prisoner-of-zenda",
        "license_or_rights": "Public Domain (CC0 1.0 Universal / Standard Ebooks dedication)",
        "palette_idx": 3,
        "motif": "ruritanian-crown",
        "edition_tag": "Nook Edition"
    }
]


def process_single_book(book_def, index, total):
    book_id = book_def["id"]
    title = book_def["title"]
    author = book_def["author"]
    source_id = book_def["source_identifier"]
    palette = EDITORIAL_PALETTES[book_def.get("palette_idx", index % len(EDITORIAL_PALETTES))]

    content_path = DATA_DIR / "books" / book_id / "content.json"
    frontend_content_path = FRONTEND_DATA_DIR / "books" / book_id / "content.json"

    # Check if preserved seed book
    if book_def.get("preserve_content") and content_path.exists():
        with open(content_path, "r", encoding="utf-8") as f:
            content_payload = json.load(f)
    else:
        # Check if local content is already complete (> 1000 words and no empty chapters)
        if content_path.exists():
            try:
                with open(content_path, "r", encoding="utf-8") as f:
                    content_payload = json.load(f)
                total_w = sum(len(c.get("content", "").split()) for c in content_payload.get("chapters", []))
                has_empty_chapter = any(not c.get("content", "").strip() for c in content_payload.get("chapters", []))
                if total_w < 1000 or has_empty_chapter:
                    content_payload = None
            except Exception:
                content_payload = None
        else:
            content_payload = None

        if not content_payload:
            try:
                if book_def.get("source") in ("project-gutenberg", "gutenberg"):
                    content_payload = GutenbergAdapter.fetch_full_content(
                        gutenberg_id=source_id,
                        book_id=book_id,
                        title=title,
                        author=author
                    )
                else:
                    content_payload = StandardEbooksAdapter.fetch_full_content(
                        source_identifier=source_id,
                        book_id=book_id,
                        title=title,
                        author=author
                    )
            except Exception as e:
                # If error, try fallback from local content if present
                if content_path.exists():
                    with open(content_path, "r", encoding="utf-8") as f:
                        content_payload = json.load(f)
                else:
                    return None, f"Fetch failed: {e}"

    try:
        total_words = validate_content_structure(content_payload, min_chapters=1, min_words=1000)
        total_reading_time = calculate_reading_time(total_words, words_per_minute=225)
    except Exception as e:
        return None, f"Validation failed: {e}"

    num_chapters = len(content_payload.get("chapters", []))

    # Persist data/books/{id}/content.json
    content_path.parent.mkdir(parents=True, exist_ok=True)
    with open(content_path, "w", encoding="utf-8") as f:
        json.dump(content_payload, f, indent=2, ensure_ascii=False)

    # Mirror to frontend/data/books/{id}/content.json
    frontend_content_path.parent.mkdir(parents=True, exist_ok=True)
    with open(frontend_content_path, "w", encoding="utf-8") as f:
        json.dump(content_payload, f, indent=2, ensure_ascii=False)

    cover_config = {
        "palette": palette,
        "motif": book_def.get("motif", "book-ornament"),
        "edition_tag": book_def.get("edition_tag", "Nook Edition")
    }

    book_record = {
        "id": book_id,
        "title": title,
        "author": author,
        "language": "en",
        "description": book_def["description"],
        "coverColor": palette["bg"],
        "source": book_def["source"],
        "source_url": book_def["source_url"],
        "source_identifier": source_id,
        "license_or_rights": book_def["license_or_rights"],
        "publication_year": book_def["publication_year"],
        "categories": book_def["categories"],
        "text_location": f"data/books/{book_id}/content.json",
        "word_count": total_words,
        "estimated_reading_time": total_reading_time,
        "reading_availability": "hostable",
        "cover_config": cover_config
    }

    validate_provenance(book_record)
    validate_book_schema(book_record)

    return book_record, None


def main():
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    print("==========================================================")
    print("NOOK 105-BOOK CONCURRENT MASTER FULL-TEXT INGESTION")
    print("==========================================================")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    FRONTEND_DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "seed").mkdir(parents=True, exist_ok=True)
    (FRONTEND_DATA_DIR / "seed").mkdir(parents=True, exist_ok=True)

    verified_catalog = []
    failed_books = []

    print(f"Starting concurrent ingestion of {len(CATALOG_DEFINITIONS)} books with 10 worker threads...")

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {
            executor.submit(process_single_book, b, idx, len(CATALOG_DEFINITIONS)): b
            for idx, b in enumerate(CATALOG_DEFINITIONS)
        }

        for future in concurrent.futures.as_completed(futures):
            b_def = futures[future]
            bid = b_def["id"]
            try:
                record, err = future.result()
                if record:
                    verified_catalog.append(record)
                    print(f"[OK] [{len(verified_catalog)}/{len(CATALOG_DEFINITIONS)}] Ingested & Validated: {record['title']} ({record['word_count']:,} words)")
                else:
                    failed_books.append((bid, err))
                    print(f"[FAIL] {bid} -> {err}")
            except Exception as e:
                failed_books.append((bid, str(e)))
                print(f"[EXCEPTION] {bid}: {e}")

    print("\n==========================================================")
    print(f"INGESTION COMPLETE: {len(verified_catalog)}/{len(CATALOG_DEFINITIONS)} BOOKS FULLY VALIDATED")
    if failed_books:
        print(f"Failed books ({len(failed_books)}):", failed_books)
    print("==========================================================")

    # Sort verified catalog to maintain deterministic canonical order matching CATALOG_DEFINITIONS
    order_map = {b["id"]: i for i, b in enumerate(CATALOG_DEFINITIONS)}
    verified_catalog.sort(key=lambda b: order_map.get(b["id"], 999))

    # Persist data/seed/books.json
    with open(BOOKS_SEED_FILE, "w", encoding="utf-8") as f:
        json.dump(verified_catalog, f, indent=2, ensure_ascii=False)
    print(f"Saved: {BOOKS_SEED_FILE}")

    # Persist frontend/data/seed/books.json
    with open(FRONTEND_SEED_FILE, "w", encoding="utf-8") as f:
        json.dump(verified_catalog, f, indent=2, ensure_ascii=False)
    print(f"Saved: {FRONTEND_SEED_FILE}")

    # Persist frontend/js/catalog-data.js
    catalog_js_file = Path("frontend/js/catalog-data.js")
    js_content = "/**\n * Nook Verified Catalog Data\n * Expanded Curated Catalog (105 books)\n */\n\nexport const NOOK_CATALOG = " + json.dumps(verified_catalog, indent=2) + ";\n"
    with open(catalog_js_file, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"Saved: {catalog_js_file}")


if __name__ == "__main__":
    main()
