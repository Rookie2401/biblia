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

// Septuagint (Rahlfs 1935), from OpenScriptorium/lxx-morph (CC BY 4.0). Biblia does not SHIP
// the Septuagint any more — it is read in Vetus (../vetus-v0), the sibling app — but its word
// list is still read at build time (build-lxx.mjs) so each New Testament lemma's card can say
// how often the same word occurs in the Septuagint. The ids (same "Lxx"-suffix convention as
// Vetus) are kept for that script's progress output and to stay diffable against Vetus's copy.
export const SEPTUAGINT = [
  // [lxx-morph filename, OSIS-style id, English, Greek, section]
  ['genesis', 'GenLxx', 'Genesis', 'Γένεσις', 'LxxLaw'],
  ['exodus', 'ExodLxx', 'Exodus', 'Ἔξοδος', 'LxxLaw'],
  ['leviticus', 'LevLxx', 'Leviticus', 'Λευιτικόν', 'LxxLaw'],
  ['numbers', 'NumLxx', 'Numbers', 'Ἀριθμοί', 'LxxLaw'],
  ['deuteronomy', 'DeutLxx', 'Deuteronomy', 'Δευτερονόμιον', 'LxxLaw'],

  // lxx-morph's plain "joshua" file only covers chapters 15/18/19 (a partial batch, not the
  // whole book) — "joshua-vaticanus-b" is the complete text, so it is the one used as "Joshua".
  ['joshua-vaticanus-b', 'JoshLxx', 'Joshua', 'Ἰησοῦς Ναυῆ', 'LxxHistory'],
  ['judges', 'JudgLxx', 'Judges', 'Κριταί', 'LxxHistory'],
  ['judges-vaticanus-b', 'JudgBLxx', 'Judges (Codex Vaticanus B)', 'Κριταί (Β)', 'LxxHistory'],
  ['ruth', 'RuthLxx', 'Ruth', 'Ῥούθ', 'LxxHistory'],
  ['1-samuel', '1SamLxx', '1 Samuel (1 Kingdoms)', 'Βασιλειῶν Αʹ', 'LxxHistory'],
  ['2-samuel', '2SamLxx', '2 Samuel (2 Kingdoms)', 'Βασιλειῶν Βʹ', 'LxxHistory'],
  ['1-kings', '1KgsLxx', '1 Kings (3 Kingdoms)', 'Βασιλειῶν Γʹ', 'LxxHistory'],
  ['2-kings', '2KgsLxx', '2 Kings (4 Kingdoms)', 'Βασιλειῶν Δʹ', 'LxxHistory'],
  ['1-chronicles', '1ChrLxx', '1 Chronicles', 'Παραλειπομένων Αʹ', 'LxxHistory'],
  ['2-chronicles', '2ChrLxx', '2 Chronicles', 'Παραλειπομένων Βʹ', 'LxxHistory'],
  ['1-esdras', '1Esd', '1 Esdras', 'Ἔσδρας Αʹ', 'LxxHistory'],
  ['2-esdras', '2Esd', '2 Esdras (Ezra–Nehemiah)', 'Ἔσδρας Βʹ', 'LxxHistory'],
  ['esther-greek', 'EsthLxx', 'Esther', 'Ἐσθήρ', 'LxxHistory'],
  ['judith', 'Jdt', 'Judith', 'Ἰουδίθ', 'LxxHistory'],
  ['tobit', 'Tob', 'Tobit', 'Τωβίτ', 'LxxHistory'],
  ['tobit-sinaiticus', 'TobS', 'Tobit (Codex Sinaiticus)', 'Τωβίτ (Σιναϊτικός)', 'LxxHistory'],
  ['1-maccabees', '1Macc', '1 Maccabees', 'Μακκαβαίων Αʹ', 'LxxHistory'],
  ['2-maccabees', '2Macc', '2 Maccabees', 'Μακκαβαίων Βʹ', 'LxxHistory'],
  ['3-maccabees', '3Macc', '3 Maccabees', 'Μακκαβαίων Γʹ', 'LxxHistory'],
  ['4-maccabees', '4Macc', '4 Maccabees', 'Μακκαβαίων Δʹ', 'LxxHistory'],

  ['psalms-lxx', 'PsLxx', 'Psalms', 'Ψαλμοί', 'LxxPoetry'],
  ['odes', 'Odes', 'Odes', 'ᾨδαί', 'LxxPoetry'],
  ['psalms-of-solomon', 'PsSol', 'Psalms of Solomon', 'Ψαλμοὶ Σολομῶντος', 'LxxPoetry'],
  ['proverbs', 'ProvLxx', 'Proverbs', 'Παροιμίαι', 'LxxPoetry'],
  ['ecclesiastes', 'EcclLxx', 'Ecclesiastes', 'Ἐκκλησιαστής', 'LxxPoetry'],
  ['song-of-solomon', 'SongLxx', 'Song of Songs', 'Ἆσμα Ἀσμάτων', 'LxxPoetry'],
  ['job-lxx', 'JobLxx', 'Job', 'Ἰώβ', 'LxxPoetry'],
  ['wisdom', 'Wis', 'Wisdom of Solomon', 'Σοφία Σαλωμῶντος', 'LxxPoetry'],
  ['sirach', 'Sir', 'Sirach', 'Σοφία Σειράχ', 'LxxPoetry'],

  ['hosea', 'HosLxx', 'Hosea', 'Ὡσηέ', 'LxxProphets'],
  ['amos', 'AmosLxx', 'Amos', 'Ἀμώς', 'LxxProphets'],
  ['micah', 'MicLxx', 'Micah', 'Μιχαίας', 'LxxProphets'],
  ['joel', 'JoelLxx', 'Joel', 'Ἰωήλ', 'LxxProphets'],
  ['obadiah', 'ObadLxx', 'Obadiah', 'Ὀβδιού', 'LxxProphets'],
  ['jonah', 'JonahLxx', 'Jonah', 'Ἰωνᾶς', 'LxxProphets'],
  ['nahum', 'NahLxx', 'Nahum', 'Ναούμ', 'LxxProphets'],
  ['habakkuk', 'HabLxx', 'Habakkuk', 'Ἀμβακούμ', 'LxxProphets'],
  ['zephaniah', 'ZephLxx', 'Zephaniah', 'Σοφονίας', 'LxxProphets'],
  ['haggai', 'HagLxx', 'Haggai', 'Ἁγγαῖος', 'LxxProphets'],
  ['zechariah', 'ZechLxx', 'Zechariah', 'Ζαχαρίας', 'LxxProphets'],
  ['malachi', 'MalLxx', 'Malachi', 'Μαλαχίας', 'LxxProphets'],
  ['isaiah', 'IsaLxx', 'Isaiah', 'Ἠσαΐας', 'LxxProphets'],
  ['jeremiah-lxx', 'JerLxx', 'Jeremiah', 'Ἱερεμίας', 'LxxProphets'],
  ['baruch', 'Bar', 'Baruch', 'Βαρούχ', 'LxxProphets'],
  ['lamentations', 'LamLxx', 'Lamentations', 'Θρῆνοι', 'LxxProphets'],
  ['letter-of-jeremiah', 'EpJer', 'Letter of Jeremiah', 'Ἐπιστολὴ Ἱερεμίου', 'LxxProphets'],
  ['ezekiel', 'EzekLxx', 'Ezekiel', 'Ἰεζεκιήλ', 'LxxProphets'],
  ['daniel', 'DanLxx', 'Daniel (Old Greek)', 'Δανιήλ (Παλαιά)', 'LxxProphets'],
  ['daniel-theodotion', 'DanThLxx', 'Daniel (Theodotion)', 'Δανιήλ (Θεοδοτίων)', 'LxxProphets'],
  ['susanna', 'SusLxx', 'Susanna (Old Greek)', 'Σουσάννα (Παλαιά)', 'LxxProphets'],
  ['susanna-theodotion', 'SusThLxx', 'Susanna (Theodotion)', 'Σουσάννα (Θεοδοτίων)', 'LxxProphets'],
  ['bel-and-the-dragon', 'BelLxx', 'Bel and the Dragon (Old Greek)', 'Βὴλ καὶ Δράκων (Παλαιά)', 'LxxProphets'],
  ['bel-and-the-dragon-theodotion', 'BelThLxx', 'Bel and the Dragon (Theodotion)', 'Βὴλ καὶ Δράκων (Θεοδοτίων)', 'LxxProphets'],
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
