import json

with open("data/seed/books.json", "r", encoding="utf-8") as f:
    books = json.load(f)

book_map = {b['id']: b for b in books}

sheet1_titles = [
    ('The Phantom of the Opera', 'Gaston Leroux', 'the-phantom-of-the-opera'),
    ('The Yellow Wallpaper', 'Charlotte Perkins Gilman', 'the-yellow-wallpaper'),
    ('The Scarlet Letter', 'Nathaniel Hawthorne', 'the-scarlet-letter'),
    ('The House of the Seven Gables', 'Nathaniel Hawthorne', 'the-house-of-the-seven-gables'),
    ('The Adventures of Sherlock Holmes', 'Arthur Conan Doyle', 'the-adventures-of-sherlock-holmes'),
    ('The Hound of the Baskervilles', 'Arthur Conan Doyle', 'the-hound-of-the-baskervilles'),
    ('A Study in Scarlet', 'Arthur Conan Doyle', 'a-study-in-scarlet'),
    ('The Sign of the Four', 'Arthur Conan Doyle', 'the-sign-of-the-four'),
    ('The Memoirs of Sherlock Holmes', 'Arthur Conan Doyle', 'the-memoirs-of-sherlock-holmes'),
    ('The Return of Sherlock Holmes', 'Arthur Conan Doyle', 'the-return-of-sherlock-holmes'),
    ('The Mysterious Affair at Styles', 'Agatha Christie', 'the-mysterious-affair-at-styles'),
    ('The Secret Adversary', 'Agatha Christie', 'the-secret-adversary'),
    ('The Murder on the Links', 'Agatha Christie', 'the-murder-on-the-links'),
    ('The Man in the Brown Suit', 'Agatha Christie', 'the-man-in-the-brown-suit'),
    ('The Secret of Chimneys', 'Agatha Christie', 'the-secret-of-chimneys'),
    ('The Murder of Roger Ackroyd', 'Agatha Christie', 'the-murder-of-roger-ackroyd')
]

sheet2_titles = [
    ('The Moonstone', 'Wilkie Collins', 'the-moonstone'),
    ('The Woman in White', 'Wilkie Collins', 'the-woman-in-white'),
    ('The Island of Doctor Moreau', 'H. G. Wells', 'the-island-of-doctor-moreau'),
    ('Twenty Thousand Leagues Under the Sea', 'Jules Verne', 'twenty-thousand-leagues-under-the-sea'),
    ('Journey to the Centre of the Earth', 'Jules Verne', 'journey-to-the-centre-of-the-earth'),
    ('Around the World in Eighty Days', 'Jules Verne', 'around-the-world-in-eighty-days'),
    ('The Lost World', 'Arthur Conan Doyle', 'the-lost-world'),
    ('Peter and Wendy', 'J. M. Barrie', 'peter-and-wendy'),
    ('Little Men', 'Louisa May Alcott', 'little-men'),
    ("Jo's Boys", 'Louisa May Alcott', 'jos-boys'),
    ('Anne of Avonlea', 'L. M. Montgomery', 'anne-of-avonlea'),
    ('Little Women', 'Louisa May Alcott', 'little-women'),
    ('Anne of the Island', 'L. M. Montgomery', 'anne-of-the-island'),
    ('The Second Jungle Book', 'Rudyard Kipling', 'the-second-jungle-book'),
    ('Treasure Island', 'Robert Louis Stevenson', 'treasure-island'),
    ('Kidnapped', 'Robert Louis Stevenson', 'kidnapped')
]

print("=== CHECKING SHEET 1 (16 BOOKS) ===")
for title, author, bid in sheet1_titles:
    if bid in book_map:
        b = book_map[bid]
        print(f"OK: {bid} -> '{b['title']}' by {b['author']}")
    else:
        print(f"MISSING: {bid} (expected '{title}' by {author})")

print("\n=== CHECKING SHEET 2 (16 BOOKS) ===")
for title, author, bid in sheet2_titles:
    if bid in book_map:
        b = book_map[bid]
        print(f"OK: {bid} -> '{b['title']}' by {b['author']}")
    else:
        print(f"MISSING: {bid} (expected '{title}' by {author})")
