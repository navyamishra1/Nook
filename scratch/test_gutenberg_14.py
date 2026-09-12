import urllib.request
import re

gutenberg_test_books = [
    ("the-yellow-wallpaper", 1952, "The Yellow Wallpaper", "Charlotte Perkins Gilman"),
    ("twenty-thousand-leagues-under-the-sea", 164, "Twenty Thousand Leagues Under the Sea", "Jules Verne"),
    ("journey-to-the-center-of-the-earth", 18857, "A Journey to the Centre of the Earth", "Jules Verne"),
    ("little-men", 2788, "Little Men", "Louisa May Alcott"),
    ("jos-boys", 2789, "Jo's Boys", "Louisa May Alcott"),
    ("the-second-jungle-book", 1937, "The Second Jungle Book", "Rudyard Kipling"),
    ("twenty-years-after", 1259, "Twenty Years After", "Alexandre Dumas"),
    ("bartleby-the-scrivener", 11231, "Bartleby, the Scrivener: A Story of Wall-Street", "Herman Melville"),
    ("the-death-of-ivan-ilyich", 289, "The Death of Ivan Ilyitch", "Leo Tolstoy"),
    ("the-hunchback-of-notre-dame", 2610, "The Hunchback of Notre Dame", "Victor Hugo"),
    ("the-metamorphosis", 5200, "Metamorphosis", "Franz Kafka"),
    ("the-trial", 7849, "The Trial", "Franz Kafka"),
    ("the-odyssey", 1727, "The Odyssey", "Homer"),
    ("the-iliad", 6130, "The Iliad", "Homer"),
]

for bid, gid, title, author in gutenberg_test_books:
    url = f"https://www.gutenberg.org/files/{gid}/{gid}-0.txt"
    alt_url = f"https://www.gutenberg.org/cache/epub/{gid}/pg{gid}.txt"
    found = False
    for u in [alt_url, url]:
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (Nook-Ingestion/1.0)"})
        try:
            with urllib.request.urlopen(req, timeout=8) as r:
                content = r.read().decode("utf-8", errors="replace")
                words = len(content.split())
                print(f"[GUTENBERG OK] {bid} (pg{gid}): {words:,} words from {u}")
                found = True
                break
        except Exception as e:
            pass
    if not found:
        print(f"[GUTENBERG FAIL] {bid} (pg{gid})")
