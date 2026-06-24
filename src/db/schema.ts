import Database from 'better-sqlite3'

export function initDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      name          TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS urls (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      slug         TEXT    NOT NULL UNIQUE,
      original_url TEXT    NOT NULL,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      expires_at   TEXT,
      user_id      INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS clicks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      url_id     INTEGER NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
      clicked_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_urls_user_id
      ON urls(user_id);

    CREATE INDEX IF NOT EXISTS idx_clicks_url_id_clicked_at
      ON clicks(url_id, clicked_at);
  `)

  // Migration: añade user_id si la tabla urls ya existía sin él
  const cols = db.prepare('PRAGMA table_info(urls)').all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === 'user_id')) {
    db.exec('ALTER TABLE urls ADD COLUMN user_id INTEGER REFERENCES users(id)')
  }
}
