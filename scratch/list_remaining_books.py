import json

with open('data/seed/books.json', 'r', encoding='utf-8') as f:
    books = json.load(f)

ref_ids = {
    'pride-and-prejudice',
    'frankenstein',
    'alices-adventures-in-wonderland',
    'the-adventures-of-sherlock-holmes',
    'the-great-gatsby',
    'moby-dick',
    'little-women',
    'dracula',
    'jane-eyre',
    'wuthering-heights',
    'great-expectations',
    'the-count-of-monte-cristo',
    'the-odyssey',
    'the-iliad',
    'meditations',
    'the-importance-of-being-earnest'
}

remaining = [b for b in books if b['id'] not in ref_ids]
print(f'Total catalog: {len(books)}')
print(f'Reference books: {len(ref_ids)}')
print(f'Remaining books to generate: {len(remaining)}')

for i, b in enumerate(remaining):
    print(f"{i+1:02d}. [{b['id']}] {b['title']} - {b['author']} ({b['publication_year']}) [{', '.join(b['categories'][:2])}]")
