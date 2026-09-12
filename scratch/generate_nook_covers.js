/**
 * Nook 105-Book Pastel Storybook Vector Cover Generator
 * 
 * Generates bespoke, pastel illustrated SVG covers for all 105 books in the Nook catalog.
 * Follows the approved visual direction:
 * - Playful, pastel, cozy, charming, literary, whimsical storybook aesthetic
 * - 2:3 aspect ratio (600 × 900)
 * - Cohesive Nook typography & framing:
 *     - Top header: ✦ A NOOK EDITION · <YEAR> ✦
 *     - Large, prominent, readable title in serif display
 *     - Author name below title
 *     - Rich illustrated object/setting scene in middle & lower area
 *     - Bottom category tag: <GENRE> · CLASSIC
 * - Storytelling through objects, settings, architecture, props, and decorative details (NO human faces/bodies)
 */

const fs = require('fs');
const path = require('path');

const booksPath = path.resolve('data/seed/books.json');
const outDir = path.resolve('frontend/assets/covers');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const books = JSON.parse(fs.readFileSync(booksPath, 'utf8'));
console.log(`Loaded ${books.length} books for SVG cover generation.`);

// Helper to escape XML
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Word wrapper for SVG title lines
function wrapTitle(title, maxCharsPerLine = 18) {
  const words = title.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

// 105 Bespoke Book Metadata Mapping with rich scenery, props, motifs, and pastel color harmonies
const BOOK_COVER_DEFS = {
  // ==========================================
  // 1. AUSTEN & REGENCY ROMANCE
  // ==========================================
  "pride-and-prejudice": {
    palette: { bg: "#FDF4F5", primary: "#7A3546", accent: "#D48B9B", border: "#E8BFC7", leaf: "#7EA089", gold: "#D4AF67" },
    scenery: "pemberley-window",
    props: ["daisy-pitcher", "wax-letter-pair", "pearl-necklace", "cameo-brooch", "pink-ribbon"],
    bannerYear: "1813",
    tag: "ROMANCE · CLASSIC",
    titleLines: ["Pride and", "Prejudice"],
    author: "JANE AUSTEN",
    noteText: "Better Together Always"
  },
  "sense-and-sensibility": {
    palette: { bg: "#F9F5EE", primary: "#6B4434", accent: "#C4927A", border: "#E2C8B8", leaf: "#7F9A86", gold: "#CCA462" },
    scenery: "cottage-hills-window",
    props: ["wildflower-vase", "artist-palette", "wax-letter", "sheet-music-scroll", "lavender-ribbon"],
    bannerYear: "1811",
    tag: "ROMANCE · CLASSIC",
    titleLines: ["Sense and", "Sensibility"],
    author: "JANE AUSTEN",
    noteText: "Heart & Mind"
  },
  "emma": {
    palette: { bg: "#FEF9F0", primary: "#78502A", accent: "#D4A45D", border: "#EAD4A8", leaf: "#82A280", gold: "#CCA462" },
    scenery: "highbury-window",
    props: ["strawberry-bowl", "archery-bow", "porcelain-teacup", "wax-letter", "yellow-ribbon"],
    bannerYear: "1815",
    tag: "ROMANCE · COMEDY",
    titleLines: ["Emma"],
    author: "JANE AUSTEN",
    noteText: "Matchless Matchmaker"
  },
  "persuasion": {
    palette: { bg: "#EEF4F8", primary: "#2A4560", accent: "#6B94B8", border: "#B4CEE2", leaf: "#769A8E", gold: "#D0B06A" },
    scenery: "coastal-cliffs-window",
    props: ["brass-telescope", "ocean-shell", "wax-letter", "compass-rose", "navy-ribbon"],
    bannerYear: "1817",
    tag: "ROMANCE · CLASSIC",
    titleLines: ["Persuasion"],
    author: "JANE AUSTEN",
    noteText: "You pierce my soul"
  },
  "northanger-abbey": {
    palette: { bg: "#F2F5F0", primary: "#3A5540", accent: "#7EA284", border: "#BCD0C0", leaf: "#5E7E64", gold: "#C8A866" },
    scenery: "gothic-abbey-window",
    props: ["candelabra", "ancient-key", "wax-letter", "antique-novel", "ivy-spray"],
    bannerYear: "1817",
    tag: "GOTHIC · SATIRE",
    titleLines: ["Northanger", "Abbey"],
    author: "JANE AUSTEN",
    noteText: "Delightful Horrors"
  },
  "mansfield-park": {
    palette: { bg: "#F4F7F4", primary: "#385246", accent: "#78A08E", border: "#B8D2C6", leaf: "#5E8070", gold: "#CEA866" },
    scenery: "estate-park-window",
    props: ["glass-cloche-botanical", "amber-beads", "writing-slope", "wax-letter", "green-ribbon"],
    bannerYear: "1814",
    tag: "ROMANCE · CLASSIC",
    titleLines: ["Mansfield", "Park"],
    author: "JANE AUSTEN",
    noteText: "Patience & Grace"
  },
  "the-tenant-of-wildfell-hall": {
    palette: { bg: "#F6F1F3", primary: "#603A4E", accent: "#B07A98", border: "#D8B8C8", leaf: "#748E7C", gold: "#CCA462" },
    scenery: "wildfell-manor-window",
    props: ["oil-easel", "palette-brushes", "locked-diary", "wax-letter", "wild-roses"],
    bannerYear: "1848",
    tag: "VICTORIAN · DRAMA",
    titleLines: ["The Tenant of", "Wildfell Hall"],
    author: "ANNE BRONTË",
    noteText: "Truth & Courage"
  },
  "jane-eyre": {
    palette: { bg: "#F4F0F8", primary: "#4A3660", accent: "#947AB4", border: "#C8BAD8", leaf: "#789484", gold: "#D4B066" },
    scenery: "thornfield-hall-window",
    props: ["taper-candlestick", "book-stack-independence", "wax-letter-home", "lilac-vase", "silk-ribbon"],
    bannerYear: "1847",
    tag: "ROMANCE · GOTHIC",
    titleLines: ["Jane Eyre"],
    author: "CHARLOTTE BRONTË",
    noteText: "I am my own home."
  },
  "wuthering-heights": {
    palette: { bg: "#EFF3F2", primary: "#384E48", accent: "#70948A", border: "#AEC4BE", leaf: "#506A62", gold: "#C6A264" },
    scenery: "moorland-window",
    props: ["heather-pitcher", "antique-locket", "casement-window", "inkwell-quill", "wind-ribbon"],
    bannerYear: "1847",
    tag: "GOTHIC · TRAGEDY",
    titleLines: ["Wuthering", "Heights"],
    author: "EMILY BRONTË",
    noteText: "Whatever our souls are"
  },
  "a-room-with-a-view": {
    palette: { bg: "#FEF7EE", primary: "#764A28", accent: "#C88656", border: "#E6BA9A", leaf: "#809E7E", gold: "#D6AC5C" },
    scenery: "florence-duomo-window",
    props: ["terracotta-violets", "baedeker-guide", "porcelain-teacup", "sun-straw-hat", "amber-ribbon"],
    bannerYear: "1908",
    tag: "ROMANCE · CLASSIC",
    titleLines: ["A Room with", "a View"],
    author: "E. M. FORSTER",
    noteText: "Eternal Florence"
  },
  "the-age-of-innocence": {
    palette: { bg: "#F9F2F6", primary: "#64344E", accent: "#B67296", border: "#DCB0C8", leaf: "#789680", gold: "#D8AF60" },
    scenery: "gilded-parlor-window",
    props: ["yellow-roses-vase", "opera-glasses", "sealed-calling-card", "lace-fan", "gold-pendant"],
    bannerYear: "1920",
    tag: "LITERARY · ROMANCE",
    titleLines: ["The Age of", "Innocence"],
    author: "EDITH WHARTON",
    noteText: "Old New York"
  },
  "the-house-of-mirth": {
    palette: { bg: "#F5F3EF", primary: "#4A463C", accent: "#969080", border: "#C6C2B4", leaf: "#748870", gold: "#D2AA5C" },
    scenery: "fifth-avenue-terrace",
    props: ["gilded-lily-vase", "bridge-score-card", "opera-fan", "pearl-brooch", "parchment-letter"],
    bannerYear: "1905",
    tag: "LITERARY · TRAGEDY",
    titleLines: ["The House of", "Mirth"],
    author: "EDITH WHARTON",
    noteText: "Fragile Beauty"
  },
  "the-awakening": {
    palette: { bg: "#EEF6F7", primary: "#284A54", accent: "#689EAE", border: "#B0D4DC", leaf: "#74A08E", gold: "#D4B066" },
    scenery: "grand-isle-seashore",
    props: ["ocean-shells-bowl", "sun-parasol", "wicker-chair-porch", "gull-feathers", "sea-ribbon"],
    bannerYear: "1899",
    tag: "ROMANCE · LITERARY",
    titleLines: ["The Awakening"],
    author: "KATE CHOPIN",
    noteText: "The Voice of the Sea"
  },

  // ==========================================
  // 2. GOTHIC, DARK & SUPERNATURAL
  // ==========================================
  "frankenstein": {
    palette: { bg: "#EEF4EE", primary: "#264832", accent: "#669674", border: "#A8C8B2", leaf: "#446C50", gold: "#D4B46A" },
    scenery: "alchemy-lab-arch",
    props: ["lightning-chamber", "apothecary-flasks", "anatomy-sketch", "book-stack-science", "ivy-tendrils"],
    bannerYear: "1818",
    tag: "SCIENCE FICTION · GOTHIC",
    titleLines: ["Frankenstein"],
    author: "MARY SHELLEY",
    noteText: "What is life?"
  },
  "dracula": {
    palette: { bg: "#F8EDF1", primary: "#66182C", accent: "#B2526E", border: "#DCA0B4", leaf: "#6E8274", gold: "#D2AA60" },
    scenery: "transylvanian-castle-moon",
    props: ["tall-taper-candle", "wax-envelope-dripping", "crimson-roses", "book-stack-shadow", "bat-silhouettes"],
    bannerYear: "1897",
    tag: "GOTHIC · HORROR",
    titleLines: ["Dracula"],
    author: "BRAM STOKER",
    noteText: "Shadow & Eternity"
  },
  "the-picture-of-dorian-gray": {
    palette: { bg: "#F6EFF7", primary: "#522E58", accent: "#9C68A4", border: "#CCACD2", leaf: "#6E8876", gold: "#D6AF58" },
    scenery: "gilded-atelier-window",
    props: ["ornate-gold-frame", "peacock-feather", "decanter-glass", "wilting-yellow-rose", "purple-velvet"],
    bannerYear: "1890",
    tag: "GOTHIC · PHILOSOPHY",
    titleLines: ["The Picture of", "Dorian Gray"],
    author: "OSCAR WILDE",
    noteText: "Youth & Soul"
  },
  "the-strange-case-of-dr-jekyll-and-mr-hyde": {
    palette: { bg: "#EDF2EE", primary: "#284438", accent: "#6A9280", border: "#A4C2B4", leaf: "#4C6E5C", gold: "#C8A660" },
    scenery: "london-fog-streetlamp",
    props: ["boiling-flask-purple", "broken-cane", "laboratory-notes", "dual-keys", "apothecary-rack"],
    bannerYear: "1886",
    tag: "GOTHIC · MYSTERY",
    titleLines: ["Dr. Jekyll and", "Mr. Hyde"],
    author: "ROBERT LOUIS STEVENSON",
    noteText: "The Dual Nature"
  },
  "the-phantom-of-the-opera": {
    palette: { bg: "#F7EEF0", primary: "#682030", accent: "#B85C70", border: "#DCAEB8", leaf: "#708476", gold: "#D8B058" },
    scenery: "opera-house-chandelier",
    props: ["porcelain-mask", "crimson-rose-black-ribbon", "opera-sheet-music", "violin-bow", "velvet-drapes"],
    bannerYear: "1910",
    tag: "GOTHIC · ROMANCE",
    titleLines: ["The Phantom", "of the Opera"],
    author: "GASTON LEROUX",
    noteText: "Music of the Night"
  },
  "the-turn-of-the-screw": {
    palette: { bg: "#F5F3EB", primary: "#4A4636", accent: "#969074", border: "#C4BEA4", leaf: "#6C8068", gold: "#CCA860" },
    scenery: "bly-estate-twilight",
    props: ["antique-music-box", "spectral-window", "locked-diary", "taper-candle", "rose-bush"],
    bannerYear: "1898",
    tag: "GOTHIC · HORROR",
    titleLines: ["The Turn of", "the Screw"],
    author: "HENRY JAMES",
    noteText: "Unseen Whispers"
  },
  "the-woman-in-white": {
    palette: { bg: "#F1F5F7", primary: "#304652", accent: "#7496A6", border: "#B4CCD8", leaf: "#668478", gold: "#CAA864" },
    scenery: "moonlit-graveyard-willow",
    props: ["flowing-white-veil", "glowing-lantern", "sealed-cipher-letter", "tombstone-sketch", "silver-key"],
    bannerYear: "1859",
    tag: "GOTHIC · MYSTERY",
    titleLines: ["The Woman", "in White"],
    author: "WILKIE COLLINS",
    noteText: "Secret & Identity"
  },
  "the-yellow-wallpaper": {
    palette: { bg: "#FFFCEE", primary: "#725C22", accent: "#C4A446", border: "#E6D28C", leaf: "#7C9472", gold: "#DAAE4A" },
    scenery: "arabesque-wallpaper-room",
    props: ["barred-window-sun", "journal-inkpot", "flowing-creeping-vines", "carved-bedpost", "yellow-ribbon"],
    bannerYear: "1892",
    tag: "GOTHIC · PSYCHOLOGICAL",
    titleLines: ["The Yellow", "Wallpaper"],
    author: "CHARLOTTE PERKINS GILMAN",
    noteText: "Behind the Pattern"
  },
  "the-house-of-the-seven-gables": {
    palette: { bg: "#EEF3F0", primary: "#324E40", accent: "#709682", border: "#AEC4B8", leaf: "#527260", gold: "#CCA462" },
    scenery: "seven-gables-house",
    props: ["ancient-elm-branch", "antique-portrait-frame", "stained-glass-panel", "heirloom-silver-key", "moss-stone"],
    bannerYear: "1851",
    tag: "GOTHIC · CLASSIC",
    titleLines: ["The House of the", "Seven Gables"],
    author: "NATHANIEL HAWTHORNE",
    noteText: "The Ancestral Curse"
  },
  "the-scarlet-letter": {
    palette: { bg: "#F9ECEE", primary: "#6E1E2A", accent: "#B65866", border: "#DC9EAA", leaf: "#6A8270", gold: "#CEA45C" },
    scenery: "puritan-scaffold-boston",
    props: ["embroidered-scarlet-a", "wooden-scaffold", "wild-rose-bush", "parchment-bible", "black-velvet"],
    bannerYear: "1850",
    tag: "CLASSIC · DRAMA",
    titleLines: ["The Scarlet", "Letter"],
    author: "NATHANIEL HAWTHORNE",
    noteText: "Truth & Dignity"
  },

  // ==========================================
  // 3. SHERLOCK HOLMES & DETECTIVE MYSTERIES
  // ==========================================
  "the-adventures-of-sherlock-holmes": {
    palette: { bg: "#F8F3E9", primary: "#563C22", accent: "#A87C4C", border: "#D8BCA0", leaf: "#6B886E", gold: "#CEA65C" },
    scenery: "baker-street-study",
    props: ["brass-desk-lamp", "deerstalker-cap", "magnifying-glass-newspaper", "briar-pipe-smoke", "case-books"],
    bannerYear: "1892",
    tag: "MYSTERY · CLASSIC",
    titleLines: ["Sherlock", "Holmes"],
    author: "ARTHUR CONAN DOYLE",
    noteText: "Observe Deduce Solve"
  },
  "the-memoirs-of-sherlock-holmes": {
    palette: { bg: "#F5F2EC", primary: "#4E4032", accent: "#968068", border: "#C8B8A4", leaf: "#668470", gold: "#CAA45C" },
    scenery: "reichenbach-falls-window",
    props: ["magnifying-glass", "cipher-note", "pocket-compass", "leather-ledger", "violin-bow"],
    bannerYear: "1894",
    tag: "MYSTERY · CLASSIC",
    titleLines: ["The Memoirs of", "Sherlock Holmes"],
    author: "ARTHUR CONAN DOYLE",
    noteText: "The Final Problem"
  },
  "the-return-of-sherlock-holmes": {
    palette: { bg: "#F7F4EB", primary: "#50422C", accent: "#9E845A", border: "#CEBCA0", leaf: "#6A866E", gold: "#CEA65C" },
    scenery: "baker-street-gaslamp",
    props: ["dancing-men-cipher", "wax-bust", "revolver-antique", "magnifying-glass", "tweed-gloves"],
    bannerYear: "1905",
    tag: "MYSTERY · CLASSIC",
    titleLines: ["The Return of", "Sherlock Holmes"],
    author: "ARTHUR CONAN DOYLE",
    noteText: "221B Resurrected"
  },
  "a-study-in-scarlet": {
    palette: { bg: "#FAF0EF", primary: "#6E2A2E", accent: "#BA686E", border: "#DCABB0", leaf: "#688270", gold: "#C8A25A" },
    scenery: "abandoned-london-room",
    props: ["rache-blood-writing", "wedding-ring-string", "magnifying-glass", "cab-lantern", "notebook-sketch"],
    bannerYear: "1887",
    tag: "MYSTERY · DETECTIVE",
    titleLines: ["A Study in", "Scarlet"],
    author: "ARTHUR CONAN DOYLE",
    noteText: "The Thread of Scarlet"
  },
  "the-sign-of-the-four": {
    palette: { bg: "#FBF5EB", primary: "#624424", accent: "#B0824E", border: "#D8BCA0", leaf: "#6E8C76", gold: "#D8AE50" },
    scenery: "thames-wharf-fog",
    props: ["agra-treasure-chest", "four-crossed-strokes", "poisoned-dart", "river-launch-boat", "wooden-peg-sketch"],
    bannerYear: "1890",
    tag: "MYSTERY · ADVENTURE",
    titleLines: ["The Sign of", "the Four"],
    author: "ARTHUR CONAN DOYLE",
    noteText: "The Treasure of Agra"
  },
  "the-hound-of-the-baskervilles": {
    palette: { bg: "#EEF4F0", primary: "#2A4638", accent: "#68947C", border: "#A4C6B2", leaf: "#4E725E", gold: "#CCA860" },
    scenery: "dartmoor-tor-moon",
    props: ["glowing-pawprints", "brass-lantern", "baskerville-gates", "deerstalker-hat", "heather-sprig"],
    bannerYear: "1902",
    tag: "MYSTERY · GOTHIC",
    titleLines: ["The Hound of the", "Baskervilles"],
    author: "ARTHUR CONAN DOYLE",
    noteText: "The Footprints of a Gigantic Hound"
  },
  "the-moonstone": {
    palette: { bg: "#FEF9EC", primary: "#685020", accent: "#C29E40", border: "#E4CA88", leaf: "#7A9876", gold: "#DCB040" },
    scenery: "shivering-sands-coast",
    props: ["glowing-yellow-diamond", "hindu-idol-statue", "opium-vial", "detective-diary", "velvet-cushion"],
    bannerYear: "1868",
    tag: "MYSTERY · DETECTIVE",
    titleLines: ["The Moonstone"],
    author: "WILKIE COLLINS",
    noteText: "The First Detective Novel"
  },
  "the-mysterious-affair-at-styles": {
    palette: { bg: "#F7F5EE", primary: "#4E4632", accent: "#968A66", border: "#C6BEA2", leaf: "#708A72", gold: "#CCA65A" },
    scenery: "styles-court-study",
    props: ["strychnine-poison-bottle", "spilled-coffee-cup", "burned-will-fragment", "monocle-magnifier", "mantel-clock"],
    bannerYear: "1920",
    tag: "MYSTERY · DETECTIVE",
    titleLines: ["The Mysterious", "Affair at Styles"],
    author: "AGATHA CHRISTIE",
    noteText: "Enter Hercule Poirot"
  },
  "the-murder-of-roger-ackroyd": {
    palette: { bg: "#F6F2EB", primary: "#523C2A", accent: "#A27E5E", border: "#D0BAA4", leaf: "#6E8870", gold: "#CEA458" },
    scenery: "fernly-park-study",
    props: ["silver-dictaphone", "mahjong-tiles", "grandfather-clock-930", "blue-envelope-letter", "study-lamp"],
    bannerYear: "1926",
    tag: "MYSTERY · DETECTIVE",
    titleLines: ["The Murder of", "Roger Ackroyd"],
    author: "AGATHA CHRISTIE",
    noteText: "A Masterpiece of Deception"
  },
  "the-murder-on-the-links": {
    palette: { bg: "#F1F7EE", primary: "#2E5034", accent: "#6EA078", border: "#AECDB4", leaf: "#4A7452", gold: "#D0AA5C" },
    scenery: "french-links-coast",
    props: ["golf-sand-bunker", "lead-pipe-clue", "matching-love-letters", "paris-train-ticket", "poirot-mustache-pin"],
    bannerYear: "1923",
    tag: "MYSTERY · DETECTIVE",
    titleLines: ["The Murder on", "the Links"],
    author: "AGATHA CHRISTIE",
    noteText: "Little Grey Cells"
  },
  "the-secret-adversary": {
    palette: { bg: "#F5F3EC", primary: "#4A4034", accent: "#968470", border: "#C6BAA8", leaf: "#68846C", gold: "#CAA45C" },
    scenery: "london-wharf-roadster",
    props: ["draft-treaty-dossier", "silver-compact-mirror", "lusitania-telegram", "speeding-roadster", "secret-agent-notes"],
    bannerYear: "1922",
    tag: "MYSTERY · THRILLER",
    titleLines: ["The Secret", "Adversary"],
    author: "AGATHA CHRISTIE",
    noteText: "Tommy & Tuppence"
  },
  "the-secret-of-chimneys": {
    palette: { bg: "#F8F5EE", primary: "#54462E", accent: "#A28A60", border: "#D2C2A2", leaf: "#728E74", gold: "#D2AC58" },
    scenery: "chimneys-manor-window",
    props: ["koh-i-noor-blueprint", "antique-dueling-pistol", "secret-brick-latch", "royal-herzogovinian-seal", "leather-trunk"],
    bannerYear: "1925",
    tag: "MYSTERY · ADVENTURE",
    titleLines: ["The Secret of", "Chimneys"],
    author: "AGATHA CHRISTIE",
    noteText: "The Diamond of Kings"
  },
  "the-man-in-the-brown-suit": {
    palette: { bg: "#FAF4EB", primary: "#5A4226", accent: "#A88252", border: "#D6BC96", leaf: "#708A70", gold: "#D4AC54" },
    scenery: "steamship-african-coast",
    props: ["ocean-liner-deck", "african-rough-diamonds", "passport-visas", "mill-race-clue", "brown-leather-satchel"],
    bannerYear: "1924",
    tag: "MYSTERY · ADVENTURE",
    titleLines: ["The Man in the", "Brown Suit"],
    author: "AGATHA CHRISTIE",
    noteText: "The Mill House Mystery"
  },

  // ==========================================
  // 4. WHIMSICAL, FANTASY & STORYBOOK
  // ==========================================
  "alices-adventures-in-wonderland": {
    palette: { bg: "#FCEDF2", primary: "#7E2A4A", accent: "#D66C94", border: "#EAAEC4", leaf: "#76A08A", gold: "#D6AE5C" },
    scenery: "wonderland-mushroom-vines",
    props: ["stacked-teacups-hearts", "pocket-watch-chain", "brass-key", "drink-me-bottle", "ace-of-hearts-card"],
    bannerYear: "1865",
    tag: "FANTASY · CLASSIC",
    titleLines: ["Alice's", "Adventures in", "Wonderland"],
    author: "LEWIS CARROLL",
    noteText: "Curiouser and Curiouser"
  },
  "the-wonderful-wizard-of-oz": {
    palette: { bg: "#FEFCEE", primary: "#26543A", accent: "#5CA278", border: "#A8D4BC", leaf: "#3C7852", gold: "#E4B83C" },
    scenery: "emerald-city-towers",
    props: ["yellow-brick-road", "ruby-slippers", "hot-air-balloon", "poppy-flowers", "sunflower-basket"],
    bannerYear: "1900",
    tag: "FANTASY · ADVENTURE",
    titleLines: ["The Wonderful", "Wizard of Oz"],
    author: "L. FRANK BAUM",
    noteText: "There's no place like home"
  },
  "peter-and-wendy": {
    palette: { bg: "#EDF5FA", primary: "#24425A", accent: "#6090BA", border: "#A8CBE6", leaf: "#6E9C88", gold: "#DCB450" },
    scenery: "london-nursery-bigben",
    props: ["glowing-fairy-jar", "second-star-sky", "pirate-ship-cloud", "thimble-kiss", "clock-crocodile-silhouette"],
    bannerYear: "1911",
    tag: "FANTASY · CLASSIC",
    titleLines: ["Peter and", "Wendy"],
    author: "J. M. BARRIE",
    noteText: "Neverland Forever"
  },
  "the-secret-garden": {
    palette: { bg: "#F1F7EE", primary: "#2E5236", accent: "#6AA476", border: "#A8D0B4", leaf: "#44744E", gold: "#D2AA58" },
    scenery: "walled-garden-arch",
    props: ["rusty-antique-key", "robin-perched-branch", "blooming-rose-trellis", "watering-can", "crocus-sprouts"],
    bannerYear: "1911",
    tag: "CHILDREN · CLASSIC",
    titleLines: ["The Secret", "Garden"],
    author: "FRANCES HODGSON BURNETT",
    noteText: "Magic in the Garden"
  },
  "a-little-princess": {
    palette: { bg: "#F7EFF3", primary: "#62324A", accent: "#B26C92", border: "#DAB2C8", leaf: "#748E7C", gold: "#D4AC5C" },
    scenery: "attic-skylight-snow",
    props: ["emily-porcelain-doll", "warm-brazier-stove", "warm-buns-basket", "storybook-open", "indian-silk-shawl"],
    bannerYear: "1905",
    tag: "CHILDREN · CLASSIC",
    titleLines: ["A Little", "Princess"],
    author: "FRANCES HODGSON BURNETT",
    noteText: "Princess in Rags"
  },
  "little-women": {
    palette: { bg: "#FAF6EB", primary: "#32503A", accent: "#78A082", border: "#BED6C2", leaf: "#52785A", gold: "#D4AE60" },
    scenery: "orchard-house-window",
    props: ["daisy-pitcher-vase", "book-stack-sisterhood", "good-things-teacup", "open-journal-pen", "sewing-basket"],
    bannerYear: "1868",
    tag: "CLASSIC · COMING OF AGE",
    titleLines: ["Little Women"],
    author: "LOUISA MAY ALCOTT",
    noteText: "Good Things Ahead"
  },
  "little-men": {
    palette: { bg: "#FAF4EB", primary: "#4A4628", accent: "#96905A", border: "#C8C49A", leaf: "#688458", gold: "#D4AE58" },
    scenery: "plumfield-school-orchard",
    props: ["wooden-cricket-bat", "botanical-press", "apple-basket", "schoolroom-desk", "pillow-fight-feather"],
    bannerYear: "1871",
    tag: "CHILDREN · CLASSIC",
    titleLines: ["Little Men"],
    author: "LOUISA MAY ALCOTT",
    noteText: "Life at Plumfield"
  },
  "jos-boys": {
    palette: { bg: "#F4F6EE", primary: "#384E34", accent: "#789C72", border: "#B4D0B0", leaf: "#50724C", gold: "#CAA458" },
    scenery: "college-quad-ivy",
    props: ["printing-press-galley", "conductor-baton", "nautical-compass", "graduation-scroll", "open-ledger"],
    bannerYear: "1886",
    tag: "CHILDREN · CLASSIC",
    titleLines: ["Jo's Boys"],
    author: "LOUISA MAY ALCOTT",
    noteText: "How They Turned Out"
  },
  "anne-of-green-gables": {
    palette: { bg: "#F4F8EE", primary: "#325232", accent: "#76A676", border: "#B6D6B6", leaf: "#4E7E4E", gold: "#D6AF5C" },
    scenery: "green-gables-farmhouse",
    props: ["puffed-sleeve-dress", "apple-blossom-bough", "straw-hat-ribbon", "wildflower-posy", "slate-pencil"],
    bannerYear: "1908",
    tag: "CLASSIC · COMING OF AGE",
    titleLines: ["Anne of", "Green Gables"],
    author: "L. M. MONTGOMERY",
    noteText: "Scope for Imagination"
  },
  "anne-of-avonlea": {
    palette: { bg: "#FAF6ED", primary: "#425634", accent: "#86A472", border: "#C2DAB2", leaf: "#5C7E4E", gold: "#D2AA58" },
    scenery: "avonlea-school-window",
    props: ["chalkboard-rhyme", "fresh-cherries-basket", "pe-island-sea-cliffs", "bell-schoolhouse", "wild-roses"],
    bannerYear: "1909",
    tag: "CHILDREN · CLASSIC",
    titleLines: ["Anne of", "Avonlea"],
    author: "L. M. MONTGOMERY",
    noteText: "The Schoolmistress"
  },
  "anne-of-the-island": {
    palette: { bg: "#F6F1F7", primary: "#52365A", accent: "#9C76A6", border: "#CEB2D6", leaf: "#6E8C78", gold: "#D6AF5C" },
    scenery: "kingsport-college-arches",
    props: ["patty-place-hearth", "lily-of-valley-bouquet", "stack-of-love-letters", "college-gong", "quill-inkstand"],
    bannerYear: "1915",
    tag: "ROMANCE · CLASSIC",
    titleLines: ["Anne of", "the Island"],
    author: "L. M. MONTGOMERY",
    noteText: "College Days & Dreams"
  },
  "the-wind-in-the-willows": {
    palette: { bg: "#F2F7ED", primary: "#2C4E2C", accent: "#6AA06A", border: "#AED2AE", leaf: "#447444", gold: "#D4AC54" },
    scenery: "riverbank-willow-tree",
    props: ["green-rowing-boat", "picnic-hamper", "lantern-boathouse", "panpipes", "motorcar-goggles"],
    bannerYear: "1908",
    tag: "CHILDREN · FANTASY",
    titleLines: ["The Wind in", "the Willows"],
    author: "KENNETH GRAHAME",
    noteText: "Messing About in Boats"
  },
  "the-jungle-book": {
    palette: { bg: "#F4F7EE", primary: "#284A28", accent: "#649864", border: "#A6CCA6", leaf: "#3E703E", gold: "#D8AE4C" },
    scenery: "seeonee-jungle-ruins",
    props: ["carved-temple-ruins", "banyan-vines", "red-flower-pot-fire", "lotus-pond", "law-of-the-jungle-scroll"],
    bannerYear: "1894",
    tag: "CHILDREN · ADVENTURE",
    titleLines: ["The Jungle", "Book"],
    author: "RUDYARD KIPLING",
    noteText: "The Law of the Jungle"
  },
  "the-second-jungle-book": {
    palette: { bg: "#F2F6ED", primary: "#2E5030", accent: "#6EA470", border: "#AED4B0", leaf: "#447846", gold: "#D6AC50" },
    scenery: "ancient-treasure-vault",
    props: ["king-ankus-ruby", "white-seal-waves", "red-dog-cliffs", "snow-mountain-pass", "bamboo-flute"],
    bannerYear: "1895",
    tag: "CHILDREN · ADVENTURE",
    titleLines: ["The Second", "Jungle Book"],
    author: "RUDYARD KIPLING",
    noteText: "Songs of the Jungle"
  },

  // ==========================================
  // 5. JAZZ AGE, MODERNIST & TWENTIETH CENTURY
  // ==========================================
  "the-great-gatsby": {
    palette: { bg: "#EDF2F8", primary: "#243E5E", accent: "#6286B2", border: "#A6C2E2", leaf: "#688EA0", gold: "#D8B45E" },
    scenery: "gatsby-mansion-lake",
    props: ["champagne-coupe", "art-deco-balustrade", "book-dreams-build", "crescent-moon-water", "pink-clouds"],
    bannerYear: "1925",
    tag: "CLASSIC · LITERARY FICTION",
    titleLines: ["The Great", "Gatsby"],
    author: "F. SCOTT FITZGERALD",
    noteText: "Dreams We Build"
  },
  "the-metamorphosis": {
    palette: { bg: "#F8F4EE", primary: "#524434", accent: "#9E8870", border: "#CEBAA2", leaf: "#748870", gold: "#C69E58" },
    scenery: "samsa-bedroom-floor",
    props: ["red-apple-floor", "framed-fur-boa-picture", "pocket-watch-stopped", "room-key-keyhole", "violin-propped"],
    bannerYear: "1915",
    tag: "CLASSIC · ABSURDIST",
    titleLines: ["The", "Metamorphosis"],
    author: "FRANZ KAFKA",
    noteText: "Unsettling Dreams"
  },
  "the-trial": {
    palette: { bg: "#F4F3ED", primary: "#444038", accent: "#8A8474", border: "#BCB6A6", leaf: "#6E7A70", gold: "#C29C58" },
    scenery: "cathedral-court-arches",
    props: ["judicial-summons-scroll", "titorelli-palette-brush", "cathedral-pillar-torch", "massive-brass-key", "scales-justice"],
    bannerYear: "1925",
    tag: "CLASSIC · PHILOSOPHY",
    titleLines: ["The Trial"],
    author: "FRANZ KAFKA",
    noteText: "Before the Law"
  },
  "dubliners": {
    palette: { bg: "#F1F5F0", primary: "#304A36", accent: "#6E9478", border: "#ACCEB6", leaf: "#4A7252", gold: "#C6A258" },
    scenery: "dublin-georgian-door",
    props: ["fanlight-doorway", "street-gaslamp", "tram-ticket", "pint-and-biscuit", "araby-bazaar-lamp"],
    bannerYear: "1914",
    tag: "CLASSIC · SHORT STORIES",
    titleLines: ["Dubliners"],
    author: "JAMES JOYCE",
    noteText: "Epiphanies of Dublin"
  },
  "a-portrait-of-the-artist-as-a-young-man": {
    palette: { bg: "#EEF4F6", primary: "#264250", accent: "#628E9E", border: "#A2C8D6", leaf: "#668C7E", gold: "#D2AC5C" },
    scenery: "clongowes-chapel-window",
    props: ["icarus-wings-sketch", "celtic-harp", "leather-notebook", "seashore-bird-girl", "green-rose"],
    bannerYear: "1916",
    tag: "CLASSIC · MODERNIST",
    titleLines: ["A Portrait of the", "Artist as a Young Man"],
    author: "JAMES JOYCE",
    noteText: "Silence, Exile & Cunning"
  },
  "heart-of-darkness": {
    palette: { bg: "#F0F3EC", primary: "#324830", accent: "#6E8E6C", border: "#AAC6A8", leaf: "#4A6E48", gold: "#BE9C54" },
    scenery: "congo-river-steamer",
    props: ["river-steamboat-deck", "ivory-tusks", "brass-compass", "jungle-fog-mist", "trading-post-ledger"],
    bannerYear: "1899",
    tag: "CLASSIC · LITERARY",
    titleLines: ["Heart of", "Darkness"],
    author: "JOSEPH CONRAD",
    noteText: "The Horror! The Horror!"
  },
  "the-secret-agent": {
    palette: { bg: "#F5F2EB", primary: "#4A3C2E", accent: "#947C66", border: "#C4AEA0", leaf: "#688070", gold: "#C49C54" },
    scenery: "greenwich-observatory-fog",
    props: ["clockwork-time-bomb", "london-bowler-hat", "anarchist-press-pamphlet", "gaslamp-glow", "shopkeeper-bell"],
    bannerYear: "1907",
    tag: "MYSTERY · POLITICAL",
    titleLines: ["The Secret", "Agent"],
    author: "JOSEPH CONRAD",
    noteText: "A Simple Tale"
  },

  // ==========================================
  // 6. SCI-FI, VOYAGES & ADVENTURE
  // ==========================================
  "the-time-machine": {
    palette: { bg: "#F5F0F7", primary: "#482E56", accent: "#8E66A2", border: "#C6AAD6", leaf: "#6E8A78", gold: "#D4AE58" },
    scenery: "white-sphinx-garden",
    props: ["brass-ivory-console", "quartz-dials", "wilted-future-flowers", "hourglass", "golden-age-sundial"],
    bannerYear: "1895",
    tag: "SCIENCE FICTION · CLASSIC",
    titleLines: ["The Time", "Machine"],
    author: "H. G. WELLS",
    noteText: "Into the Year 802,701"
  },
  "the-war-of-the-worlds": {
    palette: { bg: "#F5EFF2", primary: "#5A2838", accent: "#A65A70", border: "#D496A6", leaf: "#647E6E", gold: "#D6A854" },
    scenery: "martian-tripod-london",
    props: ["green-meteor-streak", "heat-ray-glow", "ruined-telescope", "cylinder-pit", "red-weed-creeping"],
    bannerYear: "1898",
    tag: "SCIENCE FICTION · ADVENTURE",
    titleLines: ["The War of", "the Worlds"],
    author: "H. G. WELLS",
    noteText: "The Eve of the War"
  },
  "the-invisible-man": {
    palette: { bg: "#F0F4F6", primary: "#2C4656", accent: "#6892A8", border: "#A8C8DC", leaf: "#628678", gold: "#CAA45C" },
    scenery: "iping-inn-snow",
    props: ["dark-spectacles", "bandaged-mask", "chemical-vials-rack", "tweed-overcoat", "coaching-inn-sign"],
    bannerYear: "1897",
    tag: "SCIENCE FICTION · HORROR",
    titleLines: ["The Invisible", "Man"],
    author: "H. G. WELLS",
    noteText: "A Grotesque Romance"
  },
  "the-island-of-doctor-moreau": {
    palette: { bg: "#F0F6F2", primary: "#264A38", accent: "#62967A", border: "#A0CAB4", leaf: "#407254", gold: "#C8A256" },
    scenery: "volcanic-island-compound",
    props: ["surgical-instruments", "bamboo-enclosure", "jungle-torch", "island-map-compass", "strange-pawprints"],
    bannerYear: "1896",
    tag: "SCIENCE FICTION · GOTHIC",
    titleLines: ["The Island of", "Doctor Moreau"],
    author: "H. G. WELLS",
    noteText: "The Law of Moreau"
  },
  "twenty-thousand-leagues-under-the-sea": {
    palette: { bg: "#EAF4F6", primary: "#1E4454", accent: "#4E8EA4", border: "#92C2D4", leaf: "#4E887E", gold: "#D8B45E" },
    scenery: "nautilus-iris-window",
    props: ["giant-squid-silhouette", "deep-sea-coral", "diver-helmet", "nautical-depth-gauge", "sea-pearl"],
    bannerYear: "1870",
    tag: "SCIENCE FICTION · ADVENTURE",
    titleLines: ["Twenty Thousand", "Leagues Under", "the Sea"],
    author: "JULES VERNE",
    noteText: "Mobilis in Mobili"
  },
  "journey-to-the-center-of-the-earth": {
    palette: { bg: "#F6F1EC", primary: "#523C2A", accent: "#A47E5C", border: "#D2B8A0", leaf: "#6E8A74", gold: "#D4AC54" },
    scenery: "crystal-cavern-glow",
    props: ["geological-hammer", "antique-barometer", "ammonite-fossil", "volcanic-compass", "subterranean-sea"],
    bannerYear: "1864",
    tag: "SCIENCE FICTION · ADVENTURE",
    titleLines: ["Journey to the", "Center of the Earth"],
    author: "JULES VERNE",
    noteText: "Descend into Sneffels"
  },
  "around-the-world-in-eighty-days": {
    palette: { bg: "#FAF5EC", primary: "#584428", accent: "#AA8654", border: "#D6BC96", leaf: "#6E8C76", gold: "#D8AE50" },
    scenery: "globe-railway-balloon",
    props: ["hot-air-balloon", "steam-locomotive", "pocket-chronometer", "steamship-ticket", "passport-stamps"],
    bannerYear: "1872",
    tag: "ADVENTURE · CLASSIC",
    titleLines: ["Around the World", "in Eighty Days"],
    author: "JULES VERNE",
    noteText: "Phileas Fogg's Wager"
  },
  "the-first-men-in-the-moon": {
    palette: { bg: "#EEF3F8", primary: "#283C56", accent: "#6484AA", border: "#A4C2E0", leaf: "#64848E", gold: "#D8B45E" },
    scenery: "lunar-crater-earthrise",
    props: ["cavorite-sphere", "earthrise-starry-sky", "selenite-crystal", "brass-pressure-gauge", "space-blanket"],
    bannerYear: "1901",
    tag: "SCIENCE FICTION · SPACE",
    titleLines: ["The First Men", "in the Moon"],
    author: "H. G. WELLS",
    noteText: "Journey via Cavorite"
  },
  "the-lost-world": {
    palette: { bg: "#F3F7EE", primary: "#2E4E28", accent: "#6E9C64", border: "#AECDA8", leaf: "#46763E", gold: "#CEA650" },
    scenery: "prehistoric-plateau-mist",
    props: ["pterodactyl-sky", "expedition-field-notebook", "brass-compass", "fossilized-dino-footprint", "jungle-ferns"],
    bannerYear: "1912",
    tag: "SCIENCE FICTION · ADVENTURE",
    titleLines: ["The Lost World"],
    author: "ARTHUR CONAN DOYLE",
    noteText: "Professor Challenger"
  },
  "treasure-island": {
    palette: { bg: "#F8F3E8", primary: "#5A3C1E", accent: "#AA7844", border: "#D8B48E", leaf: "#6A8C6A", gold: "#D8AC48" },
    scenery: "caribbean-cove-palms",
    props: ["treasure-map-x", "brass-spyglass", "flintlock-pistol", "gold-doubloons", "palm-trees-schooner"],
    bannerYear: "1883",
    tag: "ADVENTURE · CLASSIC",
    titleLines: ["Treasure", "Island"],
    author: "ROBERT LOUIS STEVENSON",
    noteText: "Fifteen Men on the Chest"
  },
  "kidnapped": {
    palette: { bg: "#F1F5F2", primary: "#30483E", accent: "#6E9084", border: "#ABC0B8", leaf: "#4E7064", gold: "#C8A45C" },
    scenery: "scottish-highlands-brig",
    props: ["highland-dirk-dagger", "brig-covenant-shipwreck", "silver-button-coat", "heather-moor", "tartan-ribbon"],
    bannerYear: "1886",
    tag: "ADVENTURE · HISTORICAL",
    titleLines: ["Kidnapped"],
    author: "ROBERT LOUIS STEVENSON",
    noteText: "David Balfour's Trials"
  },
  "the-call-of-the-wild": {
    palette: { bg: "#EDF5F5", primary: "#22444C", accent: "#5C8E9A", border: "#9EC4CE", leaf: "#52807C", gold: "#D2AA56" },
    scenery: "yukon-aurora-pines",
    props: ["northern-lights-aurora", "dogsled-harness", "gold-pan-nuggets", "snowshoes", "pine-boughs"],
    bannerYear: "1903",
    tag: "ADVENTURE · NATURE",
    titleLines: ["The Call of", "the Wild"],
    author: "JACK LONDON",
    noteText: "Buck's Awakening"
  },
  "white-fang": {
    palette: { bg: "#EDF2F7", primary: "#263E56", accent: "#6084A8", border: "#A2C0DC", leaf: "#58788C", gold: "#D0A858" },
    scenery: "wild-river-canyon",
    props: ["spruce-forest-snow", "campfire-smoke", "teepee-silhouette", "wolf-pawprint-snow", "frost-stars"],
    bannerYear: "1906",
    tag: "ADVENTURE · NATURE",
    titleLines: ["White Fang"],
    author: "JACK LONDON",
    noteText: "From the Wild"
  },
  "the-sea-wolf": {
    palette: { bg: "#EFF4F7", primary: "#2A4456", accent: "#6A8EA4", border: "#A8C4D8", leaf: "#5E828E", gold: "#CBA45A" },
    scenery: "pacific-fog-ghost-schooner",
    props: ["ships-wooden-wheel", "nautical-sextant", "seal-pelt", "foggy-ocean-waves", "ship-lantern"],
    bannerYear: "1904",
    tag: "ADVENTURE · PSYCHOLOGICAL",
    titleLines: ["The Sea-Wolf"],
    author: "JACK LONDON",
    noteText: "Wolf Larsen's Ghost"
  },
  "moby-dick": {
    palette: { bg: "#EEF4F8", primary: "#1E3C56", accent: "#5284B0", border: "#9CC2E0", leaf: "#508092", gold: "#D4AC54" },
    scenery: "ocean-waves-whale-tail",
    props: ["whale-tail-flukes", "whaling-harpoon-rope", "nantucket-lighthouse", "scrimshaw-whalebone", "sea-spray"],
    bannerYear: "1851",
    tag: "CLASSIC · SEA ADVENTURE",
    titleLines: ["Moby-Dick"],
    author: "HERMAN MELVILLE",
    noteText: "Call Me Ishmael"
  },
  "bartleby-the-scrivener": {
    palette: { bg: "#F6F4ED", primary: "#4C4436", accent: "#968A72", border: "#C6BEA8", leaf: "#6E7E6E", gold: "#C4A058" },
    scenery: "wall-street-brick-wall",
    props: ["tall-scrivener-desk", "quill-pens-ink", "folded-legal-deeds", "green-folding-screen", "brick-window"],
    bannerYear: "1853",
    tag: "CLASSIC · NOVELLA",
    titleLines: ["Bartleby, the", "Scrivener"],
    author: "HERMAN MELVILLE",
    noteText: "I would prefer not to"
  },
  "the-count-of-monte-cristo": {
    palette: { bg: "#F1F6F8", primary: "#204456", accent: "#528AA4", border: "#98C4DC", leaf: "#528482", gold: "#DCB04C" },
    scenery: "chateau-dif-mediterranean",
    props: ["treasure-chest-gold", "fencing-rapier", "prison-file-tunnel", "sea-waves-rocks", "dantes-map"],
    bannerYear: "1844",
    tag: "ADVENTURE · CLASSIC",
    titleLines: ["The Count of", "Monte Cristo"],
    author: "ALEXANDRE DUMAS",
    noteText: "Wait and Hope"
  },
  "the-three-musketeers": {
    palette: { bg: "#FAF2EE", primary: "#6A2E28", accent: "#B66860", border: "#DCAC9E", leaf: "#68846C", gold: "#DAAE48" },
    scenery: "palais-royal-courtyard",
    props: ["three-crossed-rapiers", "musketeer-plumed-hat", "diamond-studs-pouch", "royal-fleur-de-lis", "sash-ribbon"],
    bannerYear: "1844",
    tag: "ADVENTURE · HISTORICAL",
    titleLines: ["The Three", "Musketeers"],
    author: "ALEXANDRE DUMAS",
    noteText: "All for One, One for All"
  },
  "twenty-years-after": {
    palette: { bg: "#F8F3EC", primary: "#5C382C", accent: "#A67262", border: "#CEAAA0", leaf: "#66806C", gold: "#D4AC50" },
    scenery: "louvre-palace-arches",
    props: ["royal-crown-rapiers", "cardinal-sealed-letter", "paris-bridge-seine", "antique-spurs", "fleur-de-lis"],
    bannerYear: "1845",
    tag: "ADVENTURE · HISTORICAL",
    titleLines: ["Twenty Years", "After"],
    author: "ALEXANDRE DUMAS",
    noteText: "The Musketeers Return"
  },
  "the-adventures-of-tom-sawyer": {
    palette: { bg: "#FEF9EC", primary: "#6A461E", accent: "#BC864A", border: "#E2BE88", leaf: "#749E68", gold: "#DCB048" },
    scenery: "mississippi-river-steamboat",
    props: ["whitewashed-fence-brush", "riverboat-paddlewheel", "glass-marbles-pouch", "treasure-chest-cave", "straw-hat"],
    bannerYear: "1876",
    tag: "CLASSIC · COMING OF AGE",
    titleLines: ["The Adventures of", "Tom Sawyer"],
    author: "MARK TWAIN",
    noteText: "Adventures on the River"
  },
  "adventures-of-huckleberry-finn": {
    palette: { bg: "#F2F7EE", primary: "#2C482A", accent: "#689864", border: "#A8CAA4", leaf: "#447040", gold: "#D4AC4C" },
    scenery: "mississippi-raft-stars",
    props: ["log-raft-river", "corncob-pipe", "fishing-pole-line", "fireflies-willow", "starry-night-water"],
    bannerYear: "1884",
    tag: "CLASSIC · ADVENTURE",
    titleLines: ["Adventures of", "Huckleberry Finn"],
    author: "MARK TWAIN",
    noteText: "Lighting out for the Territory"
  },
  "the-prince-and-the-pauper": {
    palette: { bg: "#FAF3ED", primary: "#623828", accent: "#B06E58", border: "#D8A896", leaf: "#668270", gold: "#DCB048" },
    scenery: "westminster-tudor-palace",
    props: ["tudor-gold-crown", "ragged-peasant-cap", "great-seal-england", "ermine-velvet-cushion", "royal-scepter"],
    bannerYear: "1881",
    tag: "HISTORICAL · CLASSIC",
    titleLines: ["The Prince and", "the Pauper"],
    author: "MARK TWAIN",
    noteText: "A Tale of Two Destinies"
  },
  "the-prisoner-of-zenda": {
    palette: { bg: "#F9EEF1", primary: "#682434", accent: "#B25C6E", border: "#DC9EAE", leaf: "#668272", gold: "#D8AF50" },
    scenery: "castle-zenda-moat",
    props: ["moated-fortress-drawbridge", "coronation-scepter", "dueling-swords-crossed", "red-elphberg-rose", "royal-seal"],
    bannerYear: "1894",
    tag: "ADVENTURE · ROMANCE",
    titleLines: ["The Prisoner", "of Zenda"],
    author: "ANTHONY HOPE",
    noteText: "King for a Day"
  },
  "the-scarlet-pimpernel": {
    palette: { bg: "#F9ECEF", primary: "#6C1A2E", accent: "#B45268", border: "#DC96A8", leaf: "#66806C", gold: "#D6AA4C" },
    scenery: "paris-guillotine-dusk",
    props: ["scarlet-pimpernel-flower", "tricorne-hat-mask", "wax-seal-pimpernel", "speeding-coach", "french-flag-ribbon"],
    bannerYear: "1905",
    tag: "HISTORICAL · ADVENTURE",
    titleLines: ["The Scarlet", "Pimpernel"],
    author: "BARONESS ORCZY",
    noteText: "They seek him here"
  },
  "the-red-badge-of-courage": {
    palette: { bg: "#F6F1EC", primary: "#523C2A", accent: "#9C7656", border: "#C8A688", leaf: "#647E64", gold: "#C69C4E" },
    scenery: "civil-war-pine-ridge",
    props: ["regimental-battle-flag", "brass-bugle-horn", "forage-cap-canteen", "pine-tree-smoke", "oak-leaf-cluster"],
    bannerYear: "1895",
    tag: "HISTORICAL · WAR",
    titleLines: ["The Red Badge", "of Courage"],
    author: "STEPHEN CRANE",
    noteText: "A Youth in Battle"
  },

  // ==========================================
  // 7. DICKENS & VICTORIAN SOCIETY
  // ==========================================
  "great-expectations": {
    palette: { bg: "#F4F1EA", primary: "#443E32", accent: "#8C826E", border: "#BCB49E", leaf: "#647A66", gold: "#CCA256" },
    scenery: "satis-house-cobwebs",
    props: ["blacksmith-forge-anvil", "pocket-watch-chain", "iron-file", "river-mists-marsh", "havisham-wedding-veil"],
    bannerYear: "1861",
    tag: "CLASSIC · VICTORIAN",
    titleLines: ["Great", "Expectations"],
    author: "CHARLES DICKENS",
    noteText: "Pip's Great Journey"
  },
  "a-tale-of-two-cities": {
    palette: { bg: "#F7EFF0", primary: "#5E2834", accent: "#A85E6E", border: "#D29EAA", leaf: "#687E70", gold: "#CEA456" },
    scenery: "twin-cities-london-paris",
    props: ["knitting-needles-red-yarn", "bastille-iron-key", "cobblestones-carriage", "revolutionary-tricolor", "guillotine-shadow"],
    bannerYear: "1859",
    tag: "HISTORICAL · CLASSIC",
    titleLines: ["A Tale of", "Two Cities"],
    author: "CHARLES DICKENS",
    noteText: "It was the best of times"
  },
  "david-copperfield": {
    palette: { bg: "#EEF4F7", primary: "#264252", accent: "#608A9E", border: "#A2C2D4", leaf: "#668C7C", gold: "#D0AA56" },
    scenery: "peggotty-boathouse-beach",
    props: ["peggotty-boat-home", "writing-paper-box", "inkwell-quill", "donkey-cart-silhouette", "sea-pebbles"],
    bannerYear: "1850",
    tag: "CLASSIC · COMING OF AGE",
    titleLines: ["David", "Copperfield"],
    author: "CHARLES DICKENS",
    noteText: "The Hero of My Own Life"
  },
  "oliver-twist": {
    palette: { bg: "#F3F1EC", primary: "#423E36", accent: "#8A8274", border: "#BCB4A4", leaf: "#687E6A", gold: "#C69E52" },
    scenery: "london-stpauls-chimneys",
    props: ["pewter-gruel-bowl", "gold-locket-hair", "watchmaker-tools", "victorian-gaslamp", "london-bridge-mist"],
    bannerYear: "1838",
    tag: "CLASSIC · VICTORIAN",
    titleLines: ["Oliver Twist"],
    author: "CHARLES DICKENS",
    noteText: "Please, sir, I want some more"
  },
  "a-christmas-carol": {
    palette: { bg: "#F6F1ED", primary: "#562228", accent: "#A24E56", border: "#D0949A", leaf: "#3C6842", gold: "#DCAE48" },
    scenery: "victorian-hearth-fire",
    props: ["smoking-bishop-bowl", "holly-ivy-wreath", "golden-pocket-watch", "scrooge-ledger", "candle-snuffer"],
    bannerYear: "1843",
    tag: "CLASSIC · HOLIDAY",
    titleLines: ["A Christmas", "Carol"],
    author: "CHARLES DICKENS",
    noteText: "God Bless Us, Every One"
  },
  "silas-marner": {
    palette: { bg: "#FAF5EA", primary: "#544626", accent: "#A28A4E", border: "#D2BE8E", leaf: "#6C8A66", gold: "#DCB044" },
    scenery: "raveloe-cottage-hearth",
    props: ["weaver-loom-shuttle", "golden-coins-hearth", "child-golden-curls", "earthen-pitcher", "stone-cottage"],
    bannerYear: "1861",
    tag: "CLASSIC · VICTORIAN",
    titleLines: ["Silas Marner"],
    author: "GEORGE ELIOT",
    noteText: "The Weaver of Raveloe"
  },
  "tess-of-the-durbervilles": {
    palette: { bg: "#F4F7EE", primary: "#324E2E", accent: "#749E70", border: "#B2D2AE", leaf: "#4E7848", gold: "#D2AA56" },
    scenery: "stonehenge-sunrise",
    props: ["stonehenge-monoliths", "may-day-flower-crown", "dairy-milk-pail", "durberville-silver-seal", "wessex-clover"],
    bannerYear: "1891",
    tag: "CLASSIC · TRAGEDY",
    titleLines: ["Tess of the", "d'Urbervilles"],
    author: "THOMAS HARDY",
    noteText: "A Pure Woman"
  },
  "far-from-the-madding-crowd": {
    palette: { bg: "#FAF6ED", primary: "#42542E", accent: "#86A462", border: "#C4DE9E", leaf: "#5A7C44", gold: "#D8B04E" },
    scenery: "weatherbury-farm-barn",
    props: ["shepherd-crook", "wheat-sheaf-poppies", "weather-vane", "sheep-bell", "farm-lantern"],
    bannerYear: "1874",
    tag: "ROMANCE · VICTORIAN",
    titleLines: ["Far from the", "Madding Crowd"],
    author: "THOMAS HARDY",
    noteText: "Wessex Fields & Hearts"
  },
  "the-mayor-of-casterbridge": {
    palette: { bg: "#F6F2EB", primary: "#4E4032", accent: "#988066", border: "#C8B69E", leaf: "#66826C", gold: "#CAA052" },
    scenery: "casterbridge-amphitheater",
    props: ["mayoral-gold-chain", "hay-truss-knife", "inn-sign-three-mariners", "roman-ruins-arch", "furity-pot"],
    bannerYear: "1886",
    tag: "CLASSIC · TRAGEDY",
    titleLines: ["The Mayor of", "Casterbridge"],
    author: "THOMAS HARDY",
    noteText: "The Life and Death of Henchard"
  },
  "the-importance-of-being-earnest": {
    palette: { bg: "#FEF7F0", primary: "#623E28", accent: "#B67C52", border: "#E0B492", leaf: "#5C8E64", gold: "#DCB254" },
    scenery: "victorian-drawing-room",
    props: ["cucumber-sandwiches-silver", "green-carnation-boutonniere", "black-leather-handbag", "tea-service-tray", "calling-card-case"],
    bannerYear: "1895",
    tag: "COMEDY · SATIRE",
    titleLines: ["The Importance", "of Being Earnest"],
    author: "OSCAR WILDE",
    noteText: "A Trivial Comedy for Serious People"
  },

  // ==========================================
  // 8. RUSSIAN CLASSICS & WORLD LITERATURE
  // ==========================================
  "war-and-peace": {
    palette: { bg: "#EFF3F8", primary: "#223C56", accent: "#5C84AC", border: "#A2C0DC", leaf: "#608070", gold: "#D8B054" },
    scenery: "st-petersburg-winter-palace",
    props: ["ballroom-crystal-chandelier", "officer-gold-epaulettes", "dance-fan-lace", "snowy-birch-trees", "saber-scabbard"],
    bannerYear: "1869",
    tag: "CLASSIC · HISTORICAL",
    titleLines: ["War and", "Peace"],
    author: "LEO TOLSTOY",
    noteText: "Epic of Russia"
  },
  "anna-karenina": {
    palette: { bg: "#F8EDF0", primary: "#641E30", accent: "#B2566E", border: "#DC9CAE", leaf: "#6E8474", gold: "#D6AE56" },
    scenery: "moscow-railway-station-snow",
    props: ["snowy-train-lantern", "russian-fur-muff", "pearl-necklace", "red-velvet-curtains", "railway-tracks-snow"],
    bannerYear: "1878",
    tag: "ROMANCE · TRAGEDY",
    titleLines: ["Anna", "Karenina"],
    author: "LEO TOLSTOY",
    noteText: "All happy families are alike"
  },
  "the-death-of-ivan-ilyich": {
    palette: { bg: "#F5F3EB", primary: "#424036", accent: "#8C8674", border: "#BCB6A4", leaf: "#687E6C", gold: "#CAA456" },
    scenery: "judges-chamber-light",
    props: ["high-court-gavel", "leather-law-volumes", "pocket-watch-stopped", "beam-of-pure-white-light", "velvet-drapes"],
    bannerYear: "1886",
    tag: "PHILOSOPHY · NOVELLA",
    titleLines: ["The Death of", "Ivan Ilyich"],
    author: "LEO TOLSTOY",
    noteText: "There was no death"
  },
  "crime-and-punishment": {
    palette: { bg: "#F4F1EA", primary: "#4A3A2C", accent: "#967A60", border: "#C6AC92", leaf: "#688070", gold: "#C69C50" },
    scenery: "st-petersburg-canal-bridge",
    props: ["yellow-passport-ticket", "copper-cross-pendant", "gaslamp-glow-cobblestones", "axe-silhouette", "attic-skylight"],
    bannerYear: "1866",
    tag: "CLASSIC · PSYCHOLOGICAL",
    titleLines: ["Crime and", "Punishment"],
    author: "FYODOR DOSTOEVSKY",
    noteText: "Raskolnikov's Conscience"
  },
  "notes-from-underground": {
    palette: { bg: "#F3F1EC", primary: "#403C34", accent: "#847E70", border: "#B4AEA0", leaf: "#647668", gold: "#BE984E" },
    scenery: "underground-basement-room",
    props: ["flickering-candle-flame", "scattered-manuscript-pages", "spilled-black-inkpot", "cracked-window-pane", "tea-glass-holder"],
    bannerYear: "1864",
    tag: "PHILOSOPHY · NOVELLA",
    titleLines: ["Notes from", "Underground"],
    author: "FYODOR DOSTOEVSKY",
    noteText: "I am a sick man"
  },
  "the-brothers-karamazov": {
    palette: { bg: "#F6F3EC", primary: "#463828", accent: "#947C60", border: "#C4AC90", leaf: "#68806A", gold: "#D4AC4C" },
    scenery: "russian-monastery-domes",
    props: ["gold-onion-domes", "monastic-icon-candle", "three-silver-roubles", "glass-vigil-lamp", "holy-elder-staff"],
    bannerYear: "1880",
    tag: "CLASSIC · PHILOSOPHY",
    titleLines: ["The Brothers", "Karamazov"],
    author: "FYODOR DOSTOEVSKY",
    noteText: "Love All Creation"
  },
  "the-idiot": {
    palette: { bg: "#EFF3F6", primary: "#283E50", accent: "#648AA8", border: "#A4C4DC", leaf: "#60847A", gold: "#D0AA56" },
    scenery: "swiss-alps-salon-window",
    props: ["porcelain-tea-service", "swiss-mountain-sketch", "silver-cross-pendant", "train-window-view", "camellia-flower"],
    bannerYear: "1869",
    tag: "CLASSIC · PSYCHOLOGICAL",
    titleLines: ["The Idiot"],
    author: "FYODOR DOSTOEVSKY",
    noteText: "Prince Myshkin's Soul"
  },
  "madame-bovary": {
    palette: { bg: "#F8EDF2", primary: "#662238", accent: "#B45E78", border: "#DC9EB2", leaf: "#708E7A", gold: "#D6AE56" },
    scenery: "rouen-cathedral-hotel-window",
    props: ["blue-silk-ribbon", "bridal-orange-blossoms", "arsenic-poison-bottle", "velvet-jewelry-box", "opera-ticket"],
    bannerYear: "1856",
    tag: "ROMANCE · TRAGEDY",
    titleLines: ["Madame", "Bovary"],
    author: "GUSTAVE FLAUBERT",
    noteText: "Emma's Illusions"
  },
  "les-miserables": {
    palette: { bg: "#F7EEF0", primary: "#5C2630", accent: "#A65A68", border: "#D298A4", leaf: "#647E6E", gold: "#DCAE4C" },
    scenery: "paris-barricade-cobbles",
    props: ["silver-candlesticks-pair", "red-liberty-flag", "loaf-of-french-bread", "street-lamp-mist", "sewer-grate-key"],
    bannerYear: "1862",
    tag: "HISTORICAL · CLASSIC",
    titleLines: ["Les Misérables"],
    author: "VICTOR HUGO",
    noteText: "To Love is to See God"
  },
  "the-hunchback-of-notre-dame": {
    palette: { bg: "#F5F0F5", primary: "#4E2C52", accent: "#96629C", border: "#C8A0CE", leaf: "#668270", gold: "#D8AF50" },
    scenery: "notre-dame-rose-window",
    props: ["gargoyle-cathedral-spire", "notre-dame-bell", "tambourine-ribbons", "esmeralda-goat-silhouette", "gothic-arch"],
    bannerYear: "1831",
    tag: "GOTHIC · TRAGEDY",
    titleLines: ["The Hunchback", "of Notre-Dame"],
    author: "VICTOR HUGO",
    noteText: "Ananke: Destiny"
  },

  // ==========================================
  // 9. ANCIENT & PHILOSOPHICAL CLASSICS
  // ==========================================
  "the-odyssey": {
    palette: { bg: "#EEF5F8", primary: "#1C3C56", accent: "#4E82A8", border: "#94BFDC", leaf: "#52887A", gold: "#DCB24A" },
    scenery: "aegean-trireme-island",
    props: ["ancient-greek-galley", "olive-tree-branch", "bow-of-odysseus", "loom-of-penelope", "aegean-waves"],
    bannerYear: "800 BC",
    tag: "EPIC POETRY · ADVENTURE",
    titleLines: ["The Odyssey"],
    author: "HOMER",
    noteText: "The Journey Home"
  },
  "the-iliad": {
    palette: { bg: "#F8F0EC", primary: "#623024", accent: "#AE6452", border: "#D8A090", leaf: "#68846C", gold: "#DCB044" },
    scenery: "trojan-plain-sky",
    props: ["bronze-helmet-horsehair", "trojan-horse-silhouette", "shield-of-achilles", "olive-wreath-gold", "spear-and-chariot"],
    bannerYear: "800 BC",
    tag: "EPIC POETRY · WAR",
    titleLines: ["The Iliad"],
    author: "HOMER",
    noteText: "The Wrath of Achilles"
  },
  "meditations": {
    palette: { bg: "#F8F4EC", primary: "#4E3E2A", accent: "#9C825C", border: "#CCB492", leaf: "#648464", gold: "#D8AE48" },
    scenery: "roman-colonnade-temple",
    props: ["roman-marble-column", "laurel-wreath-gold", "bronze-stylus-wax-tablet", "philosopher-scroll", "roman-aqueduct"],
    bannerYear: "180 AD",
    tag: "PHILOSOPHY · CLASSIC",
    titleLines: ["Meditations"],
    author: "MARCUS AURELIUS",
    noteText: "To live for this present hour"
  }
};

// SVG Scene Generator Functions based on scenery type
function generateScenerySvg(scenery, pal) {
  switch (scenery) {
    case "pemberley-window":
      return `
        <!-- Window Frame -->
        <path d="M 120 340 C 120 250, 480 250, 480 340 L 480 580 L 120 580 Z" fill="#FFFFFF" fill-opacity="0.9" stroke="${pal.border}" stroke-width="3" />
        <path d="M 135 345 C 135 270, 465 270, 465 345 L 465 565 L 135 565 Z" fill="#EBF4F6" />
        <!-- Distant English Manor Estate & Rolling Hills -->
        <path d="M 135 480 Q 240 440, 360 470 Q 420 485, 465 460 L 465 565 L 135 565 Z" fill="#D2E4D4" />
        <path d="M 135 510 Q 220 490, 310 515 Q 400 500, 465 520 L 465 565 L 135 565 Z" fill="#B2D0B6" />
        <!-- Estate Manor Silhouette -->
        <rect x="250" y="440" width="100" height="40" fill="#88A890" rx="1" />
        <polygon points="245,440 300,415 355,440" fill="#72947A" />
        <rect x="270" y="430" width="18" height="15" fill="#72947A" />
        <rect x="312" y="430" width="18" height="15" fill="#72947A" />
        <!-- Window Panes Grids -->
        <line x1="300" y1="260" x2="300" y2="565" stroke="${pal.border}" stroke-width="2.5" />
        <line x1="135" y1="380" x2="465" y2="380" stroke="${pal.border}" stroke-width="2" />
        <line x1="135" y1="460" x2="465" y2="460" stroke="${pal.border}" stroke-width="2" />
        <!-- Gentle sunbeams -->
        <polygon points="140,280 280,260 480,560 200,560" fill="#FFFDE8" fill-opacity="0.2" />
      `;
    case "alchemy-lab-arch":
      return `
        <!-- Laboratory Brick Arch Window -->
        <path d="M 120 340 C 120 250, 480 250, 480 340 L 480 580 L 120 580 Z" fill="#E2EBE2" stroke="${pal.border}" stroke-width="3" />
        <!-- Night sky & distant Swiss Alps / Lightning streak -->
        <path d="M 135 345 C 135 270, 465 270, 465 345 L 465 565 L 135 565 Z" fill="#2C4032" />
        <polygon points="135,565 210,480 280,520 360,460 440,530 465,565" fill="#1C2E24" />
        <polygon points="210,480 220,495 200,505" fill="#FFFFFF" fill-opacity="0.3" />
        <polygon points="360,460 375,480 350,490" fill="#FFFFFF" fill-opacity="0.3" />
        <!-- Lightning bolt in sky -->
        <polyline points="290,290 280,340 305,345 295,410" stroke="#FFF8C0" stroke-width="2.5" fill="none" filter="drop-shadow(0 0 6px #FFF)" />
        <!-- Window Mullions -->
        <line x1="300" y1="260" x2="300" y2="565" stroke="${pal.border}" stroke-width="2.5" />
        <line x1="135" y1="400" x2="465" y2="400" stroke="${pal.border}" stroke-width="2" />
        <!-- Creeping ivy vines from top arch -->
        <path d="M 130 290 Q 180 320, 240 280 Q 280 330, 350 290 Q 420 330, 470 290" stroke="${pal.leaf}" stroke-width="3" fill="none" />
        <circle cx="160" cy="305" r="7" fill="${pal.leaf}" />
        <circle cx="210" cy="295" r="8" fill="${pal.leaf}" />
        <circle cx="260" cy="315" r="7" fill="${pal.leaf}" />
        <circle cx="320" cy="300" r="8" fill="${pal.leaf}" />
        <circle cx="390" cy="315" r="7" fill="${pal.leaf}" />
        <circle cx="440" cy="300" r="8" fill="${pal.leaf}" />
      `;
    case "wonderland-mushroom-vines":
      return `
        <!-- Whimsical Storybook Garden Backdrop -->
        <rect x="120" y="260" width="360" height="320" rx="16" fill="#FDE6ED" stroke="${pal.border}" stroke-width="2" />
        <!-- Whimsical Swirling Hills -->
        <path d="M 120 480 Q 210 420, 300 470 Q 390 430, 480 470 L 480 580 L 120 580 Z" fill="#D4EAD8" />
        <path d="M 120 520 Q 240 480, 360 520 Q 420 500, 480 530 L 480 580 L 120 580 Z" fill="#B4DCBE" />
        <!-- Giant Polka Dot Mushrooms -->
        <g transform="translate(140, 430)">
          <path d="M 20 50 C 20 20, 90 20, 90 50 Z" fill="#E8587C" />
          <path d="M 45 50 L 48 80 L 62 80 L 65 50 Z" fill="#FFF2E6" />
          <circle cx="35" cy="35" r="5" fill="#FFFFFF" />
          <circle cx="55" cy="28" r="6" fill="#FFFFFF" />
          <circle cx="75" cy="38" r="5" fill="#FFFFFF" />
        </g>
        <g transform="translate(380, 450)">
          <path d="M 15 40 C 15 15, 70 15, 70 40 Z" fill="#9C6BB4" />
          <path d="M 35 40 L 37 65 L 48 65 L 50 40 Z" fill="#FFF2E6" />
          <circle cx="28" cy="28" r="4" fill="#FFFFFF" />
          <circle cx="45" cy="22" r="5" fill="#FFFFFF" />
          <circle cx="58" cy="30" r="4" fill="#FFFFFF" />
        </g>
        <!-- Playing card suit sparkles floating -->
        <text x="180" y="320" fill="#E8587C" font-size="20" opacity="0.6">♥</text>
        <text x="400" y="310" fill="#7C5295" font-size="22" opacity="0.6">♠</text>
        <text x="320" y="290" fill="#E8587C" font-size="18" opacity="0.6">♦</text>
        <text x="240" y="340" fill="#7C5295" font-size="19" opacity="0.6">♣</text>
      `;
    case "gatsby-mansion-lake":
      return `
        <!-- Gatsby Moonlit Sound & Estate Backdrop -->
        <rect x="120" y="260" width="360" height="320" rx="16" fill="#1C2E46" stroke="${pal.border}" stroke-width="2" />
        <!-- Twilight sky with soft stars -->
        <circle cx="180" cy="290" r="1.5" fill="#FFF" opacity="0.8" />
        <circle cx="240" cy="275" r="1.5" fill="#FFF" opacity="0.9" />
        <circle cx="360" cy="285" r="1.5" fill="#FFF" opacity="0.7" />
        <circle cx="440" cy="295" r="1.5" fill="#FFF" opacity="0.8" />
        <!-- Golden Full Moon -->
        <circle cx="410" cy="320" r="28" fill="#FFF6D0" />
        <circle cx="410" cy="320" r="34" fill="#FFF6D0" fill-opacity="0.18" />
        <!-- Pink twilight clouds -->
        <ellipse cx="220" cy="340" rx="60" ry="14" fill="#D098B8" opacity="0.35" />
        <ellipse cx="340" cy="355" rx="80" ry="18" fill="#D098B8" opacity="0.3" />
        <!-- Distant Gatsby Estate Across Bay with Glowing Windows -->
        <rect x="220" y="420" width="160" height="50" fill="#0E1B2C" />
        <polygon points="215,420 300,380 385,420" fill="#0A1524" />
        <rect x="240" y="410" width="20" height="15" fill="#0A1524" />
        <rect x="340" y="410" width="20" height="15" fill="#0A1524" />
        <!-- Glowing Estate Windows -->
        <rect x="235" y="430" width="8" height="12" fill="#FFEB99" />
        <rect x="255" y="430" width="8" height="12" fill="#FFEB99" />
        <rect x="275" y="430" width="8" height="12" fill="#FFEB99" />
        <rect x="295" y="430" width="10" height="16" fill="#FFEB99" />
        <rect x="315" y="430" width="8" height="12" fill="#FFEB99" />
        <rect x="335" y="430" width="8" height="12" fill="#FFEB99" />
        <rect x="355" y="430" width="8" height="12" fill="#FFEB99" />
        <!-- Blue Water with Moon Shimmer Reflections -->
        <rect x="120" y="470" width="360" height="110" fill="#14263C" />
        <ellipse cx="300" cy="485" rx="90" ry="3" fill="#FFF2B0" opacity="0.5" />
        <ellipse cx="310" cy="505" rx="70" ry="3" fill="#FFF2B0" opacity="0.4" />
        <ellipse cx="295" cy="525" rx="50" ry="2.5" fill="#FFF2B0" opacity="0.3" />
      `;
    case "transylvanian-castle-moon":
      return `
        <!-- Transylvanian Twilight Crags Backdrop -->
        <rect x="120" y="260" width="360" height="320" rx="16" fill="#321828" stroke="${pal.border}" stroke-width="2" />
        <!-- Crimson/Rose Moon -->
        <circle cx="390" cy="330" r="32" fill="#FCE8EC" />
        <circle cx="390" cy="330" r="40" fill="#FCE8EC" fill-opacity="0.15" />
        <!-- Flying Bat Silhouettes -->
        <path d="M 370 310 Q 360 300, 350 305 Q 360 315, 365 312 Q 370 320, 375 312 Z" fill="#321828" />
        <path d="M 420 295 Q 412 288, 404 292 Q 412 300, 416 297 Q 420 304, 424 297 Z" fill="#321828" />
        <path d="M 340 330 Q 334 324, 328 327 Q 334 333, 337 331 Q 340 336, 343 331 Z" fill="#321828" />
        <!-- Gothic Castle on Jagged Mountain Peak -->
        <polygon points="120,580 180,480 260,420 340,400 420,440 480,580" fill="#1E0C18" />
        <!-- Castle Towers & Battlements -->
        <rect x="250" y="370" width="30" height="60" fill="#140810" />
        <polygon points="245,370 265,330 285,370" fill="#140810" />
        <rect x="290" y="355" width="36" height="75" fill="#140810" />
        <polygon points="285,355 308,310 331,355" fill="#140810" />
        <rect x="335" y="380" width="25" height="50" fill="#140810" />
        <polygon points="330,380 347,345 365,380" fill="#140810" />
        <!-- Glowing amber castle window -->
        <rect x="303" y="375" width="8" height="12" fill="#FFC870" rx="2" />
      `;
    case "baker-street-study":
      return `
        <!-- Victorian Study Wallpaper & Wainscoting -->
        <rect x="120" y="260" width="360" height="320" rx="16" fill="#EAE2D4" stroke="${pal.border}" stroke-width="2" />
        <!-- Vertical Victorian Wallpaper Pinstripes -->
        <line x1="160" y1="260" x2="160" y2="480" stroke="#D8CEBD" stroke-width="2" stroke-dasharray="8,6" />
        <line x1="200" y1="260" x2="200" y2="480" stroke="#D8CEBD" stroke-width="2" stroke-dasharray="8,6" />
        <line x1="240" y1="260" x2="240" y2="480" stroke="#D8CEBD" stroke-width="2" stroke-dasharray="8,6" />
        <line x1="280" y1="260" x2="280" y2="480" stroke="#D8CEBD" stroke-width="2" stroke-dasharray="8,6" />
        <line x1="320" y1="260" x2="320" y2="480" stroke="#D8CEBD" stroke-width="2" stroke-dasharray="8,6" />
        <line x1="360" y1="260" x2="360" y2="480" stroke="#D8CEBD" stroke-width="2" stroke-dasharray="8,6" />
        <line x1="400" y1="260" x2="400" y2="480" stroke="#D8CEBD" stroke-width="2" stroke-dasharray="8,6" />
        <line x1="440" y1="260" x2="440" y2="480" stroke="#D8CEBD" stroke-width="2" stroke-dasharray="8,6" />
        <!-- Wood Paneled Wainscot Divider -->
        <rect x="120" y="470" width="360" height="110" fill="#583C24" />
        <line x1="120" y1="470" x2="480" y2="470" stroke="#3E2814" stroke-width="4" />
        <rect x="140" y="490" width="80" height="70" fill="none" stroke="#7A5636" stroke-width="3" rx="2" />
        <rect x="260" y="490" width="80" height="70" fill="none" stroke="#7A5636" stroke-width="3" rx="2" />
        <rect x="380" y="490" width="80" height="70" fill="none" stroke="#7A5636" stroke-width="3" rx="2" />
      `;
    case "orchard-house-window":
      return `
        <!-- Cozy Sunny Orchard House Window -->
        <path d="M 120 340 C 120 250, 480 250, 480 340 L 480 580 L 120 580 Z" fill="#FFFFFF" fill-opacity="0.9" stroke="${pal.border}" stroke-width="3" />
        <path d="M 135 345 C 135 270, 465 270, 465 345 L 465 565 L 135 565 Z" fill="#EEF7EE" />
        <!-- Apple Orchard with blooming trees -->
        <path d="M 135 480 Q 240 450, 360 480 Q 420 495, 465 470 L 465 565 L 135 565 Z" fill="#CCE6CE" />
        <!-- Orchard apple trees -->
        <circle cx="200" cy="450" r="30" fill="#88C090" />
        <circle cx="280" cy="435" r="35" fill="#78B080" />
        <circle cx="380" cy="445" r="32" fill="#88C090" />
        <!-- Red apples on trees -->
        <circle cx="190" cy="445" r="3.5" fill="#E84858" />
        <circle cx="215" cy="460" r="3.5" fill="#E84858" />
        <circle cx="270" cy="430" r="4" fill="#E84858" />
        <circle cx="295" cy="445" r="4" fill="#E84858" />
        <circle cx="370" cy="440" r="3.5" fill="#E84858" />
        <circle cx="395" cy="455" r="3.5" fill="#E84858" />
        <!-- Window Mullions -->
        <line x1="300" y1="260" x2="300" y2="565" stroke="${pal.border}" stroke-width="2.5" />
        <line x1="135" y1="390" x2="465" y2="390" stroke="${pal.border}" stroke-width="2" />
        <line x1="135" y1="470" x2="465" y2="470" stroke="${pal.border}" stroke-width="2" />
      `;
    default:
      return `
        <!-- Classic Cozy Library Window & Shelf Backdrop -->
        <rect x="120" y="260" width="360" height="320" rx="16" fill="#F4EFE6" stroke="${pal.border}" stroke-width="2" />
        <path d="M 140 330 C 140 260, 460 260, 460 330 L 460 560 L 140 560 Z" fill="#E8F0F4" stroke="${pal.border}" stroke-width="2" />
        <line x1="300" y1="270" x2="300" y2="560" stroke="${pal.border}" stroke-width="2" />
        <line x1="140" y1="400" x2="460" y2="400" stroke="${pal.border}" stroke-width="2" />
      `;
  }
}

// SVG Props & Scene Foreground Objects Generator
function generatePropsSvg(props, pal, noteText) {
  let svg = `
    <!-- Wooden / Marble Tabletop Surface with Depth -->
    <rect x="40" y="560" width="520" height="220" fill="#FAF6EE" stroke="${pal.border}" stroke-width="2" rx="4" />
    <rect x="40" y="560" width="520" height="14" fill="#EAE2D4" />
  `;

  // Draw Props
  if (props.includes("daisy-pitcher") || props.includes("wildflower-vase") || props.includes("daisy-pitcher-vase") || props.includes("heather-pitcher")) {
    svg += `
      <!-- Ceramic Pitcher Vase with Floral Bouquet -->
      <g transform="translate(90, 470)">
        <path d="M 30 80 C 15 130, 20 170, 45 170 C 70 170, 75 130, 60 80 Z" fill="#FFFFFF" stroke="${pal.border}" stroke-width="2" filter="drop-shadow(2px 4px 6px rgba(0,0,0,0.08))" />
        <path d="M 25 105 C 5 115, 5 145, 25 155" stroke="#FFFFFF" stroke-width="5" fill="none" stroke-linecap="round" />
        <!-- Daisies / Blossoms -->
        <g transform="translate(45, 75)">
          <circle cx="-15" cy="-25" r="7" fill="#FFDC5E" />
          <circle cx="-15" cy="-37" r="6" fill="#FFF" /><circle cx="-5" cy="-33" r="6" fill="#FFF" />
          <circle cx="-5" cy="-20" r="6" fill="#FFF" /><circle cx="-15" cy="-13" r="6" fill="#FFF" />
          <circle cx="-25" cy="-20" r="6" fill="#FFF" /><circle cx="-25" cy="-33" r="6" fill="#FFF" />

          <circle cx="15" cy="-35" r="7" fill="#FFDC5E" />
          <circle cx="15" cy="-47" r="6" fill="#FFF" /><circle cx="25" cy="-43" r="6" fill="#FFF" />
          <circle cx="25" cy="-30" r="6" fill="#FFF" /><circle cx="15" cy="-23" r="6" fill="#FFF" />
          <circle cx="5" cy="-30" r="6" fill="#FFF" /><circle cx="5" cy="-43" r="6" fill="#FFF" />

          <circle cx="0" cy="-55" r="7" fill="#FFDC5E" />
          <circle cx="0" cy="-67" r="6" fill="#FFF" /><circle cx="10" cy="-63" r="6" fill="#FFF" />
          <circle cx="10" cy="-50" r="6" fill="#FFF" /><circle cx="0" cy="-43" r="6" fill="#FFF" />
          <circle cx="-10" cy="-50" r="6" fill="#FFF" /><circle cx="-10" cy="-63" r="6" fill="#FFF" />
        </g>
      </g>
    `;
  }

  if (props.includes("wax-letter-pair") || props.includes("wax-letter") || props.includes("wax-envelope-dripping")) {
    svg += `
      <!-- Elegant Pastel Love Letters with Red Wax Seal -->
      <g transform="translate(190, 580)">
        <!-- Lower Letter Envelope -->
        <rect x="0" y="20" width="180" height="110" rx="4" fill="#FDFBF7" stroke="${pal.border}" stroke-width="2" transform="rotate(-6)" filter="drop-shadow(2px 6px 8px rgba(0,0,0,0.06))" />
        <!-- Top Letter Note with handwritten text -->
        <rect x="70" y="40" width="150" height="95" rx="3" fill="#FFFDF8" stroke="${pal.border}" stroke-width="1.5" transform="rotate(8)" filter="drop-shadow(2px 6px 8px rgba(0,0,0,0.08))" />
        <text x="145" y="85" text-anchor="middle" fill="${pal.primary}" font-family="Caveat, 'Brush Script MT', cursive" font-size="19" transform="rotate(8, 145, 85)">${escapeXml(noteText || "With Love & Devotion")}</text>
        <!-- Crimson Wax Seal with Flourish -->
        <circle cx="95" cy="75" r="18" fill="#B43246" filter="drop-shadow(1px 2px 4px rgba(0,0,0,0.2))" />
        <circle cx="95" cy="75" r="14" fill="#9E2436" />
        <text x="95" y="81" text-anchor="middle" fill="#FCE8EC" font-family="Fraunces, serif" font-size="14" font-weight="bold">✦</text>
      </g>
    `;
  }

  if (props.includes("pearl-necklace") || props.includes("cameo-brooch")) {
    svg += `
      <!-- Cameo Brooch & Pearl Necklace -->
      <g transform="translate(410, 640)">
        <ellipse cx="60" cy="50" rx="20" ry="26" fill="#F5DCB4" stroke="#D4AF67" stroke-width="3" filter="drop-shadow(1px 3px 5px rgba(0,0,0,0.15))" />
        <ellipse cx="60" cy="50" rx="15" ry="20" fill="#E89AA8" />
        <circle cx="60" cy="46" r="6" fill="#FFFDF8" />
        <path d="M 54 58 C 54 52, 66 52, 66 58 Z" fill="#FFFDF8" />
        <!-- Pearl String -->
        <path d="M -20 70 Q 20 90, 60 76 Q 90 65, 110 40" stroke="#FFF" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="1,11" filter="drop-shadow(0 2px 3px rgba(0,0,0,0.15))" />
      </g>
    `;
  }

  if (props.includes("lightning-chamber") || props.includes("apothecary-flasks")) {
    svg += `
      <!-- Galvanic Bell Jar Chamber with Electrical Arc & Potions -->
      <g transform="translate(340, 480)">
        <!-- Glass Bell Jar -->
        <path d="M 40 180 L 40 70 C 40 20, 120 20, 120 70 L 120 180 Z" fill="#E4F4EC" fill-opacity="0.5" stroke="#90BC9E" stroke-width="2.5" filter="drop-shadow(0 4px 10px rgba(80,160,110,0.25))" />
        <!-- Wooden Base with Brass Terminals -->
        <rect x="25" y="180" width="110" height="18" rx="4" fill="#583C24" stroke="#3E2814" stroke-width="2" />
        <circle cx="50" cy="180" r="5" fill="#D4AF67" />
        <circle cx="110" cy="180" r="5" fill="#D4AF67" />
        <!-- Glowing Electrode Filament & Electrical Arc -->
        <line x1="80" y1="180" x2="80" y2="100" stroke="#D4AF67" stroke-width="4" />
        <circle cx="80" cy="95" r="10" fill="#FFF8C0" filter="drop-shadow(0 0 8px #FFEA60)" />
        <path d="M 80 95 Q 65 75, 75 60 Q 95 65, 80 95" stroke="#FFF080" stroke-width="2" fill="none" />
        <!-- Glass Apothecary Flasks -->
        <path d="M 0 170 L 10 145 L 10 130 L 22 130 L 22 145 L 32 170 Z" fill="#62A080" fill-opacity="0.8" stroke="#3A6C50" stroke-width="1.5" />
        <rect x="8" y="125" width="16" height="5" fill="#C49A6C" rx="1" />
      </g>
    `;
  }

  if (props.includes("book-stack-science") || props.includes("book-stack-independence") || props.includes("book-stack-sisterhood") || props.includes("book-stack-shadow")) {
    const b1 = props.includes("book-stack-science") ? "Science" : (props.includes("book-stack-sisterhood") ? "Sisterhood" : (props.includes("book-stack-shadow") ? "Shadow" : "Independence"));
    const b2 = props.includes("book-stack-science") ? "Creation" : (props.includes("book-stack-sisterhood") ? "Creativity" : (props.includes("book-stack-shadow") ? "Desire" : "Self-Respect"));
    const b3 = props.includes("book-stack-science") ? "Responsibility" : (props.includes("book-stack-sisterhood") ? "Kindness" : (props.includes("book-stack-shadow") ? "Eternity" : "A Fuller Life"));
    svg += `
      <!-- Elegant Pastel Stacked Leather Books with Spine Foil -->
      <g transform="translate(100, 520)">
        <!-- Book 1 (Bottom) -->
        <rect x="0" y="120" width="200" height="34" rx="3" fill="${pal.primary}" filter="drop-shadow(2px 5px 6px rgba(0,0,0,0.12))" />
        <rect x="5" y="123" width="190" height="28" fill="none" stroke="${pal.gold}" stroke-width="1" stroke-opacity="0.7" rx="2" />
        <text x="100" y="142" text-anchor="middle" fill="#FFFFFF" font-family="Fraunces, serif" font-size="14" font-weight="600" letter-spacing="0.08em">${escapeXml(b3)}</text>
        <!-- Book 2 (Middle) -->
        <rect x="15" y="85" width="180" height="32" rx="3" fill="${pal.accent}" filter="drop-shadow(2px 4px 5px rgba(0,0,0,0.1))" />
        <rect x="20" y="88" width="170" height="26" fill="none" stroke="${pal.gold}" stroke-width="1" stroke-opacity="0.7" rx="2" />
        <text x="105" y="106" text-anchor="middle" fill="#FFFFFF" font-family="Fraunces, serif" font-size="13" font-weight="600" letter-spacing="0.08em">${escapeXml(b2)}</text>
        <!-- Book 3 (Top) -->
        <rect x="30" y="52" width="160" height="30" rx="3" fill="${pal.leaf || pal.primary}" filter="drop-shadow(2px 3px 4px rgba(0,0,0,0.08))" />
        <rect x="34" y="55" width="152" height="24" fill="none" stroke="${pal.gold}" stroke-width="1" stroke-opacity="0.7" rx="2" />
        <text x="110" y="72" text-anchor="middle" fill="#FFFFFF" font-family="Fraunces, serif" font-size="13" font-weight="600" letter-spacing="0.08em">${escapeXml(b1)}</text>
      </g>
    `;
  }

  if (props.includes("stacked-teacups-hearts") || props.includes("good-things-teacup") || props.includes("porcelain-teacup")) {
    svg += `
      <!-- Whimsical Stacked Teacups & Drink Me Bottle -->
      <g transform="translate(110, 480)">
        <!-- Bottom Teacup with Saucer -->
        <ellipse cx="60" cy="180" rx="45" ry="10" fill="#E8EEF4" stroke="${pal.border}" stroke-width="2" />
        <path d="M 25 140 C 25 175, 95 175, 95 140 Z" fill="#FFFFFF" stroke="${pal.border}" stroke-width="2" />
        <path d="M 95 145 C 110 145, 110 165, 95 165" stroke="${pal.border}" stroke-width="3" fill="none" />
        <circle cx="50" cy="155" r="4" fill="#F288A0" /><circle cx="70" cy="155" r="4" fill="#F288A0" />
        <!-- Middle Teacup (Tilted) -->
        <g transform="translate(20, 95) rotate(-8)">
          <path d="M 25 20 C 25 50, 85 50, 85 20 Z" fill="#FDF2F5" stroke="${pal.border}" stroke-width="2" />
          <path d="M 85 25 C 98 25, 98 42, 85 42" stroke="${pal.border}" stroke-width="2.5" fill="none" />
          <text x="55" y="38" text-anchor="middle" fill="#E8587C" font-size="12">♥</text>
        </g>
      </g>
    `;
  }

  if (props.includes("pocket-watch-chain") || props.includes("pocket-watch-newspaper") || props.includes("golden-pocket-watch")) {
    svg += `
      <!-- Vintage Gold Pocket Watch with Chain -->
      <g transform="translate(340, 500)">
        <circle cx="70" cy="90" r="42" fill="#D4AF67" filter="drop-shadow(2px 5px 8px rgba(0,0,0,0.15))" />
        <circle cx="70" cy="90" r="36" fill="#FFFDF8" stroke="#B8924A" stroke-width="2" />
        <!-- Clock Face Numerals & Hands -->
        <circle cx="70" cy="90" r="2.5" fill="#3A2818" />
        <line x1="70" y1="90" x2="70" y2="65" stroke="#3A2818" stroke-width="2" stroke-linecap="round" />
        <line x1="70" y1="90" x2="88" y2="82" stroke="#3A2818" stroke-width="2.5" stroke-linecap="round" />
        <text x="70" y="62" text-anchor="middle" fill="#58422A" font-family="Fraunces, serif" font-size="9" font-weight="bold">XII</text>
        <text x="98" y="93" text-anchor="middle" fill="#58422A" font-family="Fraunces, serif" font-size="8" font-weight="bold">III</text>
        <text x="70" y="122" text-anchor="middle" fill="#58422A" font-family="Fraunces, serif" font-size="8" font-weight="bold">VI</text>
        <text x="42" y="93" text-anchor="middle" fill="#58422A" font-family="Fraunces, serif" font-size="8" font-weight="bold">IX</text>
        <!-- Top Crown & Loop -->
        <rect x="65" y="42" width="10" height="7" fill="#D4AF67" rx="1" />
        <circle cx="70" cy="40" r="8" fill="none" stroke="#D4AF67" stroke-width="3" />
        <!-- Golden Chain -->
        <path d="M 70 32 Q 100 10, 130 50 Q 150 90, 180 120" fill="none" stroke="#D4AF67" stroke-width="2.5" stroke-dasharray="3,2" />
      </g>
    `;
  }

  if (props.includes("drink-me-bottle") || props.includes("brass-key") || props.includes("ace-of-hearts-card")) {
    svg += `
      <!-- Drink Me Bottle, Brass Key & Ace of Hearts Card -->
      <g transform="translate(240, 600)">
        <!-- Ace of Hearts Playing Card -->
        <rect x="130" y="20" width="60" height="85" rx="4" fill="#FFFFFF" stroke="${pal.border}" stroke-width="1.5" transform="rotate(16)" filter="drop-shadow(2px 4px 6px rgba(0,0,0,0.1))" />
        <text x="145" y="42" fill="#E84858" font-size="14" font-weight="bold" transform="rotate(16, 145, 42)">A ♥</text>
        <text x="160" y="70" text-anchor="middle" fill="#E84858" font-size="22" transform="rotate(16, 160, 70)">♥</text>
        <!-- Vintage Brass Key -->
        <g transform="translate(100, 70) rotate(-25)">
          <circle cx="15" cy="15" r="12" fill="none" stroke="#D4AF67" stroke-width="4" />
          <line x1="27" y1="15" x2="70" y2="15" stroke="#D4AF67" stroke-width="4" stroke-linecap="round" />
          <line x1="60" y1="15" x2="60" y2="25" stroke="#D4AF67" stroke-width="3.5" stroke-linecap="round" />
          <line x1="67" y1="15" x2="67" y2="23" stroke="#D4AF67" stroke-width="3.5" stroke-linecap="round" />
        </g>
        <!-- Glass Vial with Drink Me Tag -->
        <g transform="translate(10, 10)">
          <path d="M 25 80 L 15 50 L 20 40 L 20 30 L 35 30 L 35 40 L 40 50 L 30 80 Z" fill="#E2F2EE" fill-opacity="0.8" stroke="#8CB8A8" stroke-width="1.5" filter="drop-shadow(2px 5px 6px rgba(0,0,0,0.1))" />
          <rect x="22" y="24" width="11" height="7" fill="#C29A6C" rx="1" />
          <rect x="16" y="52" width="23" height="18" fill="#FFFDF4" stroke="#D0BE9C" stroke-width="1" rx="1" />
          <text x="27.5" y="65" text-anchor="middle" fill="#443224" font-family="Caveat, cursive" font-size="8">Drink Me</text>
        </g>
      </g>
    `;
  }

  if (props.includes("champagne-coupe") || props.includes("book-dreams-build") || props.includes("art-deco-balustrade")) {
    svg += `
      <!-- Art Deco Stone Balustrade, Coupe Glass & Gold Book -->
      <g transform="translate(60, 560)">
        <!-- Stone Balustrade Railing -->
        <rect x="0" y="0" width="480" height="24" fill="#E2E6EE" stroke="#AAB8CC" stroke-width="2" />
        <rect x="30" y="24" width="24" height="60" fill="#D6DEEB" stroke="#AAB8CC" stroke-width="1.5" rx="3" />
        <rect x="110" y="24" width="24" height="60" fill="#D6DEEB" stroke="#AAB8CC" stroke-width="1.5" rx="3" />
        <rect x="190" y="24" width="24" height="60" fill="#D6DEEB" stroke="#AAB8CC" stroke-width="1.5" rx="3" />
        <rect x="270" y="24" width="24" height="60" fill="#D6DEEB" stroke="#AAB8CC" stroke-width="1.5" rx="3" />
        <rect x="350" y="24" width="24" height="60" fill="#D6DEEB" stroke="#AAB8CC" stroke-width="1.5" rx="3" />
        <rect x="430" y="24" width="24" height="60" fill="#D6DEEB" stroke="#AAB8CC" stroke-width="1.5" rx="3" />
        <!-- Champagne Coupe with Effervescent Bubbles -->
        <g transform="translate(130, -70)">
          <ellipse cx="40" cy="50" rx="34" ry="12" fill="#FFFFFF" fill-opacity="0.6" stroke="#B8CCE0" stroke-width="1.5" />
          <path d="M 6 50 Q 40 85, 74 50 Z" fill="#FFE8A0" fill-opacity="0.75" stroke="#B8CCE0" stroke-width="1.5" />
          <line x1="40" y1="78" x2="40" y2="120" stroke="#FFFFFF" stroke-width="3" />
          <ellipse cx="40" cy="120" rx="22" ry="5" fill="#FFFFFF" stroke="#B8CCE0" stroke-width="1.5" />
          <circle cx="34" cy="62" r="1.5" fill="#FFF" /><circle cx="44" cy="58" r="1.5" fill="#FFF" />
        </g>
        <!-- Blue Velvet Book "Dreams We Build" -->
        <g transform="translate(270, 20)">
          <rect x="0" y="0" width="160" height="90" rx="4" fill="#1C3252" stroke="#D4B066" stroke-width="2" transform="rotate(-4)" filter="drop-shadow(2px 5px 8px rgba(0,0,0,0.15))" />
          <rect x="6" y="6" width="148" height="78" fill="none" stroke="#D4B066" stroke-width="1" stroke-dasharray="3,3" transform="rotate(-4)" />
          <text x="80" y="48" text-anchor="middle" fill="#FCE8B0" font-family="Fraunces, serif" font-size="15" font-weight="600" letter-spacing="0.06em" transform="rotate(-4, 80, 48)">Dreams We Build</text>
        </g>
      </g>
    `;
  }

  if (props.includes("brass-desk-lamp") || props.includes("deerstalker-cap") || props.includes("magnifying-glass-newspaper") || props.includes("briar-pipe-smoke")) {
    svg += `
      <!-- Sherlock Holmes Victorian Study Desk Scene -->
      <g transform="translate(60, 520)">
        <!-- Newspaper "The Daily Chronicle" -->
        <g transform="translate(180, 70)">
          <rect x="0" y="0" width="180" height="120" rx="2" fill="#FFFDF4" stroke="#D2C4AE" stroke-width="1.5" transform="rotate(-8)" filter="drop-shadow(2px 5px 6px rgba(0,0,0,0.08))" />
          <text x="90" y="24" text-anchor="middle" fill="#3E2C1C" font-family="Fraunces, serif" font-size="12" font-weight="bold" transform="rotate(-8, 90, 24)">The Daily Chronicle</text>
          <line x1="15" y1="30" x2="165" y2="30" stroke="#3E2C1C" stroke-width="1" transform="rotate(-8, 90, 24)" />
          <text x="90" y="65" text-anchor="middle" fill="#6A4626" font-family="Caveat, cursive" font-size="20" font-weight="bold" transform="rotate(-8, 90, 65)">Observe Deduce Solve</text>
        </g>
        <!-- Tweed Deerstalker Hat -->
        <g transform="translate(20, 10)">
          <path d="M 20 70 C 20 15, 120 15, 120 70 Z" fill="#9C8264" stroke="#685036" stroke-width="2" filter="drop-shadow(2px 5px 6px rgba(0,0,0,0.12))" />
          <path d="M 0 70 Q 70 60, 140 70 Q 70 82, 0 70 Z" fill="#7C644A" stroke="#563E26" stroke-width="1.5" />
          <path d="M 55 20 L 85 20 L 70 55 Z" fill="#6E563E" />
          <circle cx="70" cy="18" r="5" fill="#563E26" />
        </g>
        <!-- Brass Magnifying Glass with Glass Sheen -->
        <g transform="translate(170, 70) rotate(15)">
          <circle cx="60" cy="60" r="38" fill="#FFF" fill-opacity="0.3" stroke="#D4AF67" stroke-width="5" filter="drop-shadow(3px 6px 8px rgba(0,0,0,0.15))" />
          <ellipse cx="50" cy="50" rx="20" ry="10" fill="#FFF" fill-opacity="0.4" transform="rotate(-30, 50, 50)" />
          <line x1="88" y1="88" x2="150" y2="150" stroke="#5A3A1E" stroke-width="9" stroke-linecap="round" />
          <line x1="88" y1="88" x2="105" y2="105" stroke="#D4AF67" stroke-width="9" />
        </g>
        <!-- Briar Wood Pipe with Curling Smoke -->
        <g transform="translate(60, 110)">
          <path d="M 20 30 Q 30 70, 65 65 Q 100 60, 110 20" fill="none" stroke="#5A2E16" stroke-width="8" stroke-linecap="round" filter="drop-shadow(2px 4px 5px rgba(0,0,0,0.15))" />
          <rect x="15" y="10" width="24" height="26" rx="4" fill="#6A361C" stroke="#48200E" stroke-width="2" />
          <path d="M 27 10 Q 20 -10, 32 -30 Q 22 -50, 36 -70" fill="none" stroke="#E6E2DC" stroke-width="3" stroke-linecap="round" opacity="0.6" />
        </g>
      </g>
    `;
  }

  if (props.includes("taper-candlestick") || props.includes("tall-taper-candle") || props.includes("candelabra")) {
    svg += `
      <!-- Lit Brass Candlestick with Glowing Flame -->
      <g transform="translate(370, 480)">
        <ellipse cx="40" cy="180" rx="30" ry="8" fill="#D4AF67" stroke="#9A7836" stroke-width="2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.15))" />
        <rect x="34" y="90" width="12" height="90" fill="#D4AF67" stroke="#9A7836" stroke-width="1.5" />
        <!-- White Candle Wax Column with Drips -->
        <rect x="36" y="20" width="8" height="70" fill="#FFFDF4" rx="1" />
        <path d="M 36 35 Q 33 42, 36 50" stroke="#FFFDF4" stroke-width="3" fill="none" stroke-linecap="round" />
        <line x1="40" y1="20" x2="40" y2="12" stroke="#222" stroke-width="1.5" />
        <!-- Glowing Warm Candle Flame -->
        <circle cx="40" cy="10" r="16" fill="#FFEAA0" fill-opacity="0.35" filter="drop-shadow(0 0 10px #FFD040)" />
        <path d="M 40 2 C 34 8, 35 15, 40 18 C 45 15, 46 8, 40 2 Z" fill="#FFA834" />
        <path d="M 40 6 C 37 10, 38 14, 40 16 C 42 14, 43 10, 40 6 Z" fill="#FFF8C0" />
      </g>
    `;
  }

  if (props.includes("open-journal-pen") || props.includes("writing-slope") || props.includes("inkwell-quill")) {
    svg += `
      <!-- Open Journal Sketchbook & Vintage Gold Nib Fountain Pen -->
      <g transform="translate(180, 620)">
        <!-- Open Double-Page Journal -->
        <rect x="0" y="0" width="180" height="110" rx="3" fill="#FFFDF8" stroke="${pal.border}" stroke-width="2" transform="rotate(-4)" filter="drop-shadow(2px 6px 8px rgba(0,0,0,0.08))" />
        <line x1="90" y1="0" x2="90" y2="110" stroke="#D8C8B4" stroke-width="2" transform="rotate(-4, 90, 55)" />
        <!-- Faint botanical sketch in journal -->
        <path d="M 40 85 Q 50 40, 70 30" stroke="#8EA692" stroke-width="1.5" fill="none" transform="rotate(-4, 90, 55)" />
        <ellipse cx="60" cy="45" rx="6" ry="10" fill="#B4D0B8" transform="rotate(20, 60, 45)" />
        <ellipse cx="48" cy="62" rx="6" ry="10" fill="#B4D0B8" transform="rotate(-30, 48, 62)" />
        <!-- Gold Nib Pen -->
        <g transform="translate(120, 20) rotate(35)">
          <rect x="0" y="0" width="8" height="90" rx="2" fill="#2E2822" />
          <rect x="0" y="15" width="8" height="6" fill="#D4AF67" />
          <polygon points="0,90 8,90 4,106" fill="#D4AF67" />
          <line x1="4" y1="92" x2="4" y2="102" stroke="#111" stroke-width="0.8" />
        </g>
      </g>
    `;
  }

  return svg;
}

// Full SVG Document Builder
function buildFullSvg(book) {
  const def = BOOK_COVER_DEFS[book.id] || {
    palette: {
      bg: "#FAF5EE",
      primary: "#5A4432",
      accent: "#A88258",
      border: "#D6C2A6",
      leaf: "#769476",
      gold: "#D4AC54"
    },
    scenery: "classic-window",
    props: ["daisy-pitcher", "wax-letter", "book-stack-sisterhood"],
    bannerYear: String(book.publication_year > 0 ? book.publication_year : "CLASSIC"),
    tag: `${(book.categories[0] || "CLASSICS").toUpperCase()} · ${(book.categories[1] || "CLASSIC").toUpperCase()}`,
    titleLines: wrapTitle(book.title, 18),
    author: (book.author || "NOOK AUTHOR").toUpperCase(),
    noteText: "A Timeless Classic"
  };

  const pal = def.palette;
  const yearText = def.bannerYear || (book.publication_year > 0 ? String(book.publication_year) : "CLASSIC");
  const lines = def.titleLines || wrapTitle(book.title, 18);
  const authorText = def.author || book.author.toUpperCase();
  const categoryTag = def.tag || `${(book.categories[0] || "CLASSIC").toUpperCase()} · CLASSIC`;

  // Compute dynamic vertical title positioning based on number of lines
  const titleLineHeight = lines.length > 2 ? 38 : 44;
  const titleFontSize = lines.length > 2 ? 32 : (lines.length === 2 ? 38 : 42);
  const titleStartY = lines.length === 1 ? 165 : (lines.length === 2 ? 148 : 138);
  const authorY = titleStartY + (lines.length * titleLineHeight) + 4;

  const scenerySvg = generateScenerySvg(def.scenery, pal);
  const propsSvg = generatePropsSvg(def.props, pal, def.noteText);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" width="100%" height="100%">
  <defs>
    <!-- Soft Pastel Grain & Shimmer Filters -->
    <linearGradient id="clothSheen" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.18" />
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.0" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.08" />
    </linearGradient>
    <radialGradient id="sunGlow" cx="50%" cy="30%" r="60%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.0" />
    </radialGradient>
    <filter id="gentleShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#2C1820" flood-opacity="0.12" />
    </filter>
  </defs>

  <!-- Base Cozy Pastel Book Background -->
  <rect width="600" height="900" fill="${pal.bg}" />
  <rect width="600" height="900" fill="url(#sunGlow)" />
  <rect width="600" height="900" fill="url(#clothSheen)" />

  <!-- Authentic Left Spine Crease Shadow -->
  <rect x="0" y="0" width="16" height="900" fill="#000000" fill-opacity="0.12" />
  <line x1="16" y1="0" x2="16" y2="900" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="1.5" />

  <!-- Outer Decorative Storybook Pastel Frame -->
  <rect x="32" y="32" width="536" height="836" fill="none" stroke="${pal.border}" stroke-width="2.5" rx="6" />
  <rect x="40" y="40" width="520" height="820" fill="none" stroke="${pal.border}" stroke-width="1" stroke-dasharray="6,4" stroke-opacity="0.6" rx="4" />

  <!-- Corner Flourish Accents & Stars -->
  <g fill="${pal.accent}" stroke="${pal.accent}">
    <path d="M 46 68 Q 68 68, 68 46" fill="none" stroke-width="2" />
    <circle cx="56" cy="56" r="3" />
    <path d="M 554 68 Q 532 68, 532 46" fill="none" stroke-width="2" />
    <circle cx="544" cy="56" r="3" />
    <path d="M 46 832 Q 68 832, 68 854" fill="none" stroke-width="2" />
    <circle cx="56" cy="844" r="3" />
    <path d="M 554 832 Q 532 832, 532 854" fill="none" stroke-width="2" />
    <circle cx="544" cy="844" r="3" />
  </g>

  <!-- Top Nook Edition Header Banner -->
  <g transform="translate(300, 78)">
    <text text-anchor="middle" fill="${pal.primary}" font-family="Inter, -apple-system, sans-serif" font-size="11" font-weight="700" letter-spacing="0.22em" opacity="0.85">✦  A NOOK EDITION  ·  ${escapeXml(yearText)}  ✦</text>
  </g>

  <!-- Book Title in Elegant Serif Display -->
  <g id="coverTitle">
    ${lines.map((line, idx) => `
      <text x="300" y="${titleStartY + (idx * titleLineHeight)}" text-anchor="middle" fill="${pal.primary}" font-family="Fraunces, 'Playfair Display', Georgia, serif" font-size="${titleFontSize}" font-weight="600" letter-spacing="-0.02em" filter="url(#gentleShadow)">${escapeXml(line)}</text>
    `).join('')}
  </g>

  <!-- Author Name -->
  <text x="300" y="${authorY}" text-anchor="middle" fill="${pal.primary}" font-family="Inter, -apple-system, sans-serif" font-size="13" font-weight="600" letter-spacing="0.18em" opacity="0.85">${escapeXml(authorText)}</text>

  <!-- Middle Storybook Illustrated Scene & Objects -->
  <g id="coverIllustration">
    ${scenerySvg}
    ${propsSvg}
  </g>

  <!-- Bottom Genre Category Banner -->
  <g transform="translate(300, 818)">
    <line x1="-120" y1="-14" x2="120" y2="-14" stroke="${pal.border}" stroke-width="1.5" opacity="0.6" />
    <circle cx="0" cy="-14" r="3" fill="${pal.accent}" />
    <text y="8" text-anchor="middle" fill="${pal.primary}" font-family="Inter, -apple-system, sans-serif" font-size="11" font-weight="700" letter-spacing="0.22em" opacity="0.85">${escapeXml(categoryTag)}</text>
  </g>
</svg>`;
}

// Generate all 105 covers
let generatedCount = 0;
for (const book of books) {
  const svgContent = buildFullSvg(book);
  const outFilePath = path.join(outDir, `${book.id}.svg`);
  fs.writeFileSync(outFilePath, svgContent, 'utf8');
  generatedCount++;
}

console.log(`Successfully generated all ${generatedCount}/105 bespoke pastel illustrated SVG covers in ${outDir}`);
