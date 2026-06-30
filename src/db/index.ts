import { createClient, type Client } from '@libsql/client'

let _db: Client | null = null

export function getDb(): Client {
  if (!_db) {
    _db = createClient({
      url: process.env.TURSO_DATABASE_URL ?? 'file:./data/snap.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
  return _db
}
