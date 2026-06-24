import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import { config } from '../config.js'
import { initDb } from './schema.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(__dirname, '../../data', config.dbName)

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true })
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    initDb(_db)
  }
  return _db
}
