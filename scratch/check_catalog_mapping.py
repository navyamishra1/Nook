import json

with open('data/seed/books.json', 'r', encoding='utf-8') as f:
    books = json.load(f)

print(f'Total books in seed catalog: {len(books)}')

ref_16_titles = [
    ('Pride and Prejudice', 'pride-and-prejudice'),
    ('Frankenstein', 'frankenstein'),
    ("Alice's Adventures in Wonderland", 'alices-adventures-in-wonderland'),
    ('The Adventures of Sherlock Holmes', 'the-adventures-of-sherlock-holmes'),
    ('The Great Gatsby', 'the-great-gatsby'),
    ('Moby-Dick', 'moby-dick'),
    ('Little Women', 'little-women'),
    ('Dracula', 'dracula'),
    ('Jane Eyre', 'jane-eyre'),
    ('Wuthering Heights', 'wuthering-heights'),
    ('Great Expectations', 'great-expectations'),
    ('The Count of Monte Cristo', 'the-count-of-monte-cristo'),
    ('The Odyssey', 'the-odyssey'),
    ('The Iliad', 'the-iliad'),
    ('Meditations', 'meditations'),
    ('The Importance of Being Earnest', 'the-importance-of-being-earnest')
]

book_ids = {b['id']: b for b in books}

for title, expected_id in ref_16_titles:
    if expected_id in book_ids:
        b = book_ids[expected_id]
        print(f'[MATCH] "{title}" -> ID: {b["id"]} | Title: "{b["title"]}"')
    else:
        # Search by title match
        match = [b for b in books if title.lower() in b['title'].lower() or b['title'].lower() in title.lower()]
        if match:
            print(f'[PARTIAL] "{title}" -> ID: {match[0]["id"]} | Title: "{match[0]["title"]}"')
        else:
            print(f'[MISSING] "{title}"')
