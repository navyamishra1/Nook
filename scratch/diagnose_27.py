import urllib.request
import json
import re
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scratch.probe_and_ingest_all_105 import CATALOG_DEFINITIONS
from ingestion.adapters.standard_ebooks import StandardEbooksAdapter

failed_ids = [
    'the-yellow-wallpaper', 'journey-to-the-center-of-the-earth', 'twenty-thousand-leagues-under-the-sea',
    'jos-boys', 'little-men', 'the-second-jungle-book', 'twenty-years-after', 'bartleby-the-scrivener',
    'a-room-with-a-view', 'the-house-of-mirth', 'white-fang', 'the-death-of-ivan-ilyich',
    'the-hunchback-of-notre-dame', 'the-age-of-innocence', 'the-trial', 'the-metamorphosis',
    'the-odyssey', 'the-iliad', 'the-importance-of-being-earnest', 'little-women',
    'crime-and-punishment', 'the-idiot', 'the-woman-in-white', 'madame-bovary',
    'the-brothers-karamazov', 'anna-karenina', 'war-and-peace'
]

for b in CATALOG_DEFINITIONS:
    if b['id'] in failed_ids:
        source_id = b['source_identifier']
        repo = source_id.strip().strip('/').replace('/', '_')
        url = f"https://raw.githubusercontent.com/standardebooks/{repo}/master/src/epub/toc.xhtml"
        req = urllib.request.Request(url, headers={'User-Agent': 'Nook-Ingestion/1.0'})
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                print(f"[FOUND SE] {b['id']} -> {source_id} (code {resp.status})")
        except urllib.error.HTTPError as e:
            print(f"[404 SE]   {b['id']} -> {source_id} ({e.code})")
        except Exception as e:
            print(f"[ERR]      {b['id']} -> {e}")
