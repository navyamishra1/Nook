import re
from pathlib import Path

path = Path("scratch/probe_and_ingest_all_105.py")
text = path.read_text(encoding="utf-8")

# 1. Update fetch logic
old_fetch = """        if not content_payload:
            try:
                content_payload = StandardEbooksAdapter.fetch_full_content(
                    source_identifier=source_id,
                    book_id=book_id,
                    title=title,
                    author=author
                )
            except Exception as e:"""

new_fetch = """        if not content_payload:
            try:
                if book_def.get("source") == "gutenberg":
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
            except Exception as e:"""

if old_fetch in text:
    text = text.replace(old_fetch, new_fetch)
    print("Updated process_single_book fetch logic.")
else:
    print("Fetch logic already updated or pattern differed.")

# 2. Update 14 book definitions to Gutenberg
gutenberg_maps = {
    "the-yellow-wallpaper": ("1952", "https://www.gutenberg.org/ebooks/1952"),
    "twenty-thousand-leagues-under-the-sea": ("164", "https://www.gutenberg.org/ebooks/164"),
    "journey-to-the-center-of-the-earth": ("18857", "https://www.gutenberg.org/ebooks/18857"),
    "little-men": ("2788", "https://www.gutenberg.org/ebooks/2788"),
    "jos-boys": ("2789", "https://www.gutenberg.org/ebooks/2789"),
    "the-second-jungle-book": ("1937", "https://www.gutenberg.org/ebooks/1937"),
    "twenty-years-after": ("1259", "https://www.gutenberg.org/ebooks/1259"),
    "bartleby-the-scrivener": ("11231", "https://www.gutenberg.org/ebooks/11231"),
    "the-death-of-ivan-ilyich": ("289", "https://www.gutenberg.org/ebooks/289"),
    "the-hunchback-of-notre-dame": ("2610", "https://www.gutenberg.org/ebooks/2610"),
    "the-metamorphosis": ("5200", "https://www.gutenberg.org/ebooks/5200"),
    "the-trial": ("7849", "https://www.gutenberg.org/ebooks/7849"),
    "the-odyssey": ("1727", "https://www.gutenberg.org/ebooks/1727"),
    "the-iliad": ("6130", "https://www.gutenberg.org/ebooks/6130"),
}

for bid, (gid, gurl) in gutenberg_maps.items():
    pat = re.compile(
        rf'(\"id\":\s*\"{bid}\",.*?\"source\":\s*)\"standard-ebooks\"(.*?)(\"source_identifier\":\s*)\"[^\"]+\"(.*?)(\"source_url\":\s*)\"[^\"]+\"(.*?)(\"license_or_rights\":\s*)\"[^\"]+\"',
        re.DOTALL
    )
    def repl(m):
        return f'{m.group(1)}"gutenberg"{m.group(2)}{m.group(3)}"{gid}"{m.group(4)}{m.group(5)}"{gurl}"{m.group(6)}{m.group(7)}"Public Domain in the USA"'
    new_text, count = pat.subn(repl, text)
    if count > 0:
        text = new_text
        print(f"Replaced: {bid} -> Gutenberg {gid}")
    else:
        print(f"NOT MATCHED: {bid}")

path.write_text(text, encoding="utf-8")
print("Saved probe_and_ingest_all_105.py")
