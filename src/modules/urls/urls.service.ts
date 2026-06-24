import { randomBytes } from 'node:crypto'
import Database from 'better-sqlite3'
import { getDb } from '../../db/index.js'
import type { CreateUrlDto, Url } from './urls.types.js'

function generateSlug(): string {
  return randomBytes(4).toString('base64url').slice(0, 6)
}

export function createUrl(dto: CreateUrlDto, db: Database.Database = getDb()): Url {
  const slug = dto.slug ?? generateSlug()
  return db
    .prepare(
      'INSERT INTO urls (slug, original_url, expires_at, user_id) VALUES (?, ?, ?, ?) RETURNING *',
    )
    .get(slug, dto.original_url, dto.expires_at ?? null, dto.user_id ?? null) as Url
}

export function findBySlug(slug: string, db: Database.Database = getDb()): Url | null {
  return (db.prepare('SELECT * FROM urls WHERE slug = ?').get(slug) ?? null) as Url | null
}

export function listUrls(db: Database.Database = getDb()): Url[] {
  return db.prepare('SELECT * FROM urls ORDER BY id DESC').all() as Url[]
}

export function recordClick(urlId: number, db: Database.Database = getDb()): void {
  db.prepare('INSERT INTO clicks (url_id) VALUES (?)').run(urlId)
}

export function deleteUrl(slug: string, userId: number, db: Database.Database = getDb()): void {
  const record = db.prepare('SELECT * FROM urls WHERE slug = ?').get(slug) as Url | undefined
  if (!record) {
    throw new Error('URL no encontrada')
  }
  if (record.user_id !== userId) {
    throw new Error('No tienes permiso para eliminar esta URL')
  }
  db.prepare('DELETE FROM urls WHERE slug = ?').run(slug)
}
