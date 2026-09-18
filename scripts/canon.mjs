// The canon, in the order the app presents it: Tanakh in Masoretic order, then the
// Greek New Testament. `id` is the OSIS book id (also the data file name and the
// id used by BDB / Abbott-Smith cross references).
export const TANAKH = [
  // [sefaria name, OSIS id, English, Hebrew, section]
  ['Genesis', 'Gen', 'Genesis', 'בְּרֵאשִׁית', 'Torah'],
  ['Exodus', 'Exod', 'Exodus', 'שְׁמוֹת', 'Torah'],
  ['Leviticus', 'Lev', 'Leviticus', 'וַיִּקְרָא', 'Torah'],
  ['Numbers', 'Num', 'Numbers', 'בְּמִדְבַּר', 'Torah'],
  ['Deuteronomy', 'Deut', 'Deuteronomy', 'דְּבָרִים', 'Torah'],
  ['Joshua', 'Josh', 'Joshua', 'יְהוֹשֻׁעַ', 'Neviim'],
  ['Judges', 'Judg', 'Judges', 'שׁוֹפְטִים', 'Neviim'],
  ['I Samuel', '1Sam', '1 Samuel', 'שְׁמוּאֵל א', 'Neviim'],
  ['II Samuel', '2Sam', '2 Samuel', 'שְׁמוּאֵל ב', 'Neviim'],
  ['I Kings', '1Kgs', '1 Kings', 'מְלָכִים א', 'Neviim'],
  ['II Kings', '2Kgs', '2 Kings', 'מְלָכִים ב', 'Neviim'],
  ['Isaiah', 'Isa', 'Isaiah', 'יְשַׁעְיָהוּ', 'Neviim'],
  ['Jeremiah', 'Jer', 'Jeremiah', 'יִרְמְיָהוּ', 'Neviim'],
  ['Ezekiel', 'Ezek', 'Ezekiel', 'יְחֶזְקֵאל', 'Neviim'],
  ['Hosea', 'Hos', 'Hosea', 'הוֹשֵׁעַ', 'Neviim'],
  ['Joel', 'Joel', 'Joel', 'יוֹאֵל', 'Neviim'],
  ['Amos', 'Amos', 'Amos', 'עָמוֹס', 'Neviim'],
  ['Obadiah', 'Obad', 'Obadiah', 'עֹבַדְיָה', 'Neviim'],
  ['Jonah', 'Jonah', 'Jonah', 'יוֹנָה', 'Neviim'],
  ['Micah', 'Mic', 'Micah', 'מִיכָה', 'Neviim'],
  ['Nahum', 'Nah', 'Nahum', 'נַחוּם', 'Neviim'],
  ['Habakkuk', 'Hab', 'Habakkuk', 'חֲבַקּוּק', 'Neviim'],
  ['Zephaniah', 'Zeph', 'Zephaniah', 'צְפַנְיָה', 'Neviim'],
  ['Haggai', 'Hag', 'Haggai', 'חַגַּי', 'Neviim'],
  ['Zechariah', 'Zech', 'Zechariah', 'זְכַרְיָה', 'Neviim'],
  ['Malachi', 'Mal', 'Malachi', 'מַלְאָכִי', 'Neviim'],
  ['Psalms', 'Ps', 'Psalms', 'תְּהִלִּים', 'Ketuvim'],
  ['Proverbs', 'Prov', 'Proverbs', 'מִשְׁלֵי', 'Ketuvim'],
  ['Job', 'Job', 'Job', 'אִיּוֹב', 'Ketuvim'],
  ['Song of Songs', 'Song', 'Song of Songs', 'שִׁיר הַשִּׁירִים', 'Ketuvim'],
  ['Ruth', 'Ruth', 'Ruth', 'רוּת', 'Ketuvim'],
  ['Lamentations', 'Lam', 'Lamentations', 'אֵיכָה', 'Ketuvim'],
  ['Ecclesiastes', 'Eccl', 'Ecclesiastes', 'קֹהֶלֶת', 'Ketuvim'],
  ['Esther', 'Esth', 'Esther', 'אֶסְתֵּר', 'Ketuvim'],
  ['Daniel', 'Dan', 'Daniel', 'דָּנִיֵּאל', 'Ketuvim'],
  ['Ezra', 'Ezra', 'Ezra', 'עֶזְרָא', 'Ketuvim'],
  ['Nehemiah', 'Neh', 'Nehemiah', 'נְחֶמְיָה', 'Ketuvim'],
  ['I Chronicles', '1Chr', '1 Chronicles', 'דִּבְרֵי הַיָּמִים א', 'Ketuvim'],
  ['II Chronicles', '2Chr', '2 Chronicles', 'דִּבְרֵי הַיָּמִים ב', 'Ketuvim'],
];

export const GNT = [
  // [morphgnt file stem, OSIS id, English, Greek, section]
  ['61-Mt', 'Matt', 'Matthew', 'Κατὰ Μαθθαῖον', 'Gospels'],
  ['62-Mk', 'Mark', 'Mark', 'Κατὰ Μᾶρκον', 'Gospels'],
  ['63-Lk', 'Luke', 'Luke', 'Κατὰ Λουκᾶν', 'Gospels'],
  ['64-Jn', 'John', 'John', 'Κατὰ Ἰωάννην', 'Gospels'],
  ['65-Ac', 'Acts', 'Acts', 'Πράξεις Ἀποστόλων', 'Acts'],
  ['66-Ro', 'Rom', 'Romans', 'Πρὸς Ῥωμαίους', 'Paul'],
  ['67-1Co', '1Cor', '1 Corinthians', 'Πρὸς Κορινθίους Αʹ', 'Paul'],
  ['68-2Co', '2Cor', '2 Corinthians', 'Πρὸς Κορινθίους Βʹ', 'Paul'],
  ['69-Ga', 'Gal', 'Galatians', 'Πρὸς Γαλάτας', 'Paul'],
  ['70-Eph', 'Eph', 'Ephesians', 'Πρὸς Ἐφεσίους', 'Paul'],
  ['71-Php', 'Phil', 'Philippians', 'Πρὸς Φιλιππησίους', 'Paul'],
  ['72-Col', 'Col', 'Colossians', 'Πρὸς Κολοσσαεῖς', 'Paul'],
  ['73-1Th', '1Thess', '1 Thessalonians', 'Πρὸς Θεσσαλονικεῖς Αʹ', 'Paul'],
  ['74-2Th', '2Thess', '2 Thessalonians', 'Πρὸς Θεσσαλονικεῖς Βʹ', 'Paul'],
  ['75-1Ti', '1Tim', '1 Timothy', 'Πρὸς Τιμόθεον Αʹ', 'Paul'],
  ['76-2Ti', '2Tim', '2 Timothy', 'Πρὸς Τιμόθεον Βʹ', 'Paul'],
  ['77-Tit', 'Titus', 'Titus', 'Πρὸς Τίτον', 'Paul'],
  ['78-Phm', 'Phlm', 'Philemon', 'Πρὸς Φιλήμονα', 'Paul'],
  ['79-Heb', 'Heb', 'Hebrews', 'Πρὸς Ἑβραίους', 'General'],
  ['80-Jas', 'Jas', 'James', 'Ἰακώβου', 'General'],
  ['81-1Pe', '1Pet', '1 Peter', 'Πέτρου Αʹ', 'General'],
  ['82-2Pe', '2Pet', '2 Peter', 'Πέτρου Βʹ', 'General'],
  ['83-1Jn', '1John', '1 John', 'Ἰωάννου Αʹ', 'General'],
  ['84-2Jn', '2John', '2 John', 'Ἰωάννου Βʹ', 'General'],
  ['85-3Jn', '3John', '3 John', 'Ἰωάννου Γʹ', 'General'],
  ['86-Jud', 'Jude', 'Jude', 'Ἰούδα', 'General'],
  ['87-Re', 'Rev', 'Revelation', 'Ἀποκάλυψις Ἰωάννου', 'Revelation'],
];

/** Hebrew points and accents (everything combining), used for consonantal comparison. */
export const HE_MARKS = /[֑-ֽֿ-ׂׄ-ׇ͏]/g;
export const heCons = (s) => s.replace(HE_MARKS, '').replace(/[׃׀]/g, '').replace(/[/־ ]/g, '');

/** Maqaf-split content words of a MAM verse (the unit the morphology is aligned to). */
export function mamWords(text) {
  return text
    .replace(/׀/g, '')
    .split(/[  ]+/)
    .filter(Boolean)
    .flatMap((w) => w.split('־'))
    .map((w) => w.replace(/׃/g, ''))
    .filter(Boolean);
}
