import type { Client } from '@libsql/client'

export async function initDb(db: Client): Promise<void> {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        email         TEXT    NOT NULL UNIQUE,
        password_hash TEXT    NOT NULL,
        name          TEXT    NOT NULL,
        created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS urls (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        slug         TEXT    NOT NULL UNIQUE,
        original_url TEXT    NOT NULL,
        created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
        expires_at   TEXT,
        user_id      INTEGER REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS clicks (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        url_id     INTEGER NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
        clicked_at TEXT    NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_clicks_url_id_clicked_at ON clicks(url_id, clicked_at)`,
    ],
    'write',
  )

  const result = await db.execute('PRAGMA table_info(urls)')
  const cols = result.rows as Array<{ name: unknown }>
  if (!cols.some((c) => c.name === 'user_id')) {
    await db.execute('ALTER TABLE urls ADD COLUMN user_id INTEGER REFERENCES users(id)')
  }
}
