/**
 * IndexedDB (Dexie). Only the reader's own data lives here — statuses, lookups, reading
 * positions, notes. The texts and lexica are static files.
 */
import Dexie, { type EntityTable } from 'dexie';
import type { Lexeme, Lookup, Position, Progress, UserNote } from '../model/types.ts';

export const db = new Dexie('biblia') as Dexie & {
  lexemes: EntityTable<Lexeme, 'key'>;
  lookups: EntityTable<Lookup, 'id'>;
  positions: EntityTable<Position, 'book'>;
  progress: EntityTable<Progress, 'id'>;
  notes: EntityTable<UserNote, 'key'>;
};

db.version(1).stores({
  lexemes: 'key, lang, status, lastLookupAt, updatedAt',
  lookups: '++id, key, [book+ch], at',
  positions: 'book, at',
  progress: 'id, book, lastAt',
  notes: 'key',
});
