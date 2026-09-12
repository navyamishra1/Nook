import json
import os

ROOT_DIR = r"d:\Nook"
with open(os.path.join(ROOT_DIR, "data", "seed", "books.json"), "r", encoding="utf-8") as f:
    books = json.load(f)

book_map = {b['id']: b for b in books}

expected_36 = [
    # Reference Image 1
    ("The Sea-Wolf", "Jack London", 1, 1, 1),
    ("The Count of Monte Cristo", "Alexandre Dumas", 1, 1, 2),
    ("The Three Musketeers", "Alexandre Dumas", 1, 1, 3),
    ("Twenty Years After", "Alexandre Dumas", 1, 1, 4),
    ("The Prince and the Pauper", "Mark Twain", 1, 1, 5),
    ("Moby-Dick; or, the Whale", "Herman Melville", 1, 2, 1),
    ("Bartleby, the Scrivener", "Herman Melville", 1, 2, 2),
    ("Crime and Punishment", "Fyodor Dostoevsky", 1, 2, 3),
    ("Notes from Underground", "Fyodor Dostoevsky", 1, 2, 4),
    ("The Brothers Karamazov", "Fyodor Dostoevsky", 1, 2, 5),
    ("The Idiot", "Fyodor Dostoevsky", 1, 3, 1),
    ("War and Peace", "Leo Tolstoy", 1, 3, 2),
    ("Anna Karenina", "Leo Tolstoy", 1, 3, 3),
    ("The Death of Ivan Ilyich", "Leo Tolstoy", 1, 3, 4),
    ("Madame Bovary", "Gustave Flaubert", 1, 3, 5),
    ("Les Misérables", "Victor Hugo", 1, 4, 1),

    # Reference Image 2
    ("The Hunchback of Notre-Dame", "Victor Hugo", 2, 1, 1),
    ("Great Expectations", "Charles Dickens", 2, 1, 2),
    ("A Tale of Two Cities", "Charles Dickens", 2, 1, 3),
    ("David Copperfield", "Charles Dickens", 2, 1, 4),
    ("Oliver Twist", "Charles Dickens", 2, 1, 5),
    ("A Christmas Carol", "Charles Dickens", 2, 2, 1),
    ("The Metamorphosis", "Franz Kafka", 2, 2, 2),
    ("The Trial", "Franz Kafka", 2, 2, 3),
    ("Dubliners", "James Joyce", 2, 2, 4),
    ("A Portrait of the Artist as a Young Man", "James Joyce", 2, 2, 5),
    ("The Awakening", "Kate Chopin", 2, 3, 1),
    ("Heart of Darkness", "Joseph Conrad", 2, 3, 2),
    ("The Secret Agent", "Joseph Conrad", 2, 3, 3),
    ("Tess of the d'Urbervilles", "Thomas Hardy", 2, 3, 4),
    ("Far from the Madding Crowd", "Thomas Hardy", 2, 3, 5),
    ("The Mayor of Casterbridge", "Thomas Hardy", 2, 4, 1),
    ("The Odyssey", "Homer", 2, 4, 2),
    ("The Iliad", "Homer", 2, 4, 3),
    ("Meditations", "Marcus Aurelius", 2, 4, 4),
    ("The Importance of Being Earnest", "Oscar Wilde", 2, 4, 5),
]

print(f"Total catalog books: {len(books)}")

matched_items = []
for title, author, sheet_num, r, c in expected_36:
    # Try exact match or fuzzy match
    match = None
    t_clean = title.lower().replace(";", "").replace(",", "").replace("-", " ").replace("'", "").replace("’", "").replace("é", "e")
    
    for b in books:
        bt_clean = b['title'].lower().replace(";", "").replace(",", "").replace("-", " ").replace("'", "").replace("’", "").replace("é", "e")
        ba_clean = b['author'].lower().replace(";", "").replace(",", "").replace("-", " ").replace("'", "").replace("’", "").replace("é", "e")
        
        if t_clean in bt_clean or bt_clean in t_clean or b['id'] == title.lower().replace(" ", "-").replace("'", ""):
            match = b
            break
        # also check if first few words match
        first_words = t_clean.split()[:2]
        if len(first_words) >= 2 and all(w in bt_clean for w in first_words) and author.split()[-1].lower() in ba_clean:
            match = b
            break

    if match:
        print(f"[FOUND] Sheet {sheet_num} (R{r}, C{c}): '{title}' by {author} -> ID: '{match['id']}' ({match['title']} / {match['author']})")
        matched_items.append((match['id'], title, author, sheet_num, r, c))
    else:
        print(f"[NOT FOUND] Sheet {sheet_num} (R{r}, C{c}): '{title}' by {author}")

print(f"\nMatched {len(matched_items)} / {len(expected_36)}")
