import { randomBytes } from 'node:crypto'
import type { Client } from '@libsql/client'
import { getDb } from '../../db/index.js'
import type { CreateUrlDto, Url } from './urls.types.js'

function generateSlug(): string {
  return randomBytes(4).toString('base64url').slice(0, 6)
}

export async function createUrl(dto: CreateUrlDto, db: Client = getDb()): Promise<Url> {
  const slug = dto.slug ?? generateSlug()
  const result = await db.execute({
    sql: 'INSERT INTO urls (slug, original_url, expires_at, user_id) VALUES (?, ?, ?, ?) RETURNING *',
    args: [slug, dto.original_url, dto.expires_at ?? null, dto.user_id ?? null],
  })
  return result.rows[0] as unknown as Url
}

export async function findBySlug(slug: string, db: Client = getDb()): Promise<Url | null> {
  const result = await db.execute({ sql: 'SELECT * FROM urls WHERE slug = ?', args: [slug] })
  return (result.rows[0] ?? null) as unknown as Url | null
}

export async function listUrls(db: Client = getDb()): Promise<Url[]> {
  const result = await db.execute({ sql: 'SELECT * FROM urls ORDER BY id DESC', args: [] })
  return result.rows as unknown as Url[]
}

export async function recordClick(urlId: number, db: Client = getDb()): Promise<void> {
  await db.execute({ sql: 'INSERT INTO clicks (url_id) VALUES (?)', args: [urlId] })
}

export async function deleteUrl(
  slug: string,
  userId: number,
  db: Client = getDb(),
): Promise<void> {
  const result = await db.execute({ sql: 'SELECT * FROM urls WHERE slug = ?', args: [slug] })
  const record = (result.rows[0] ?? null) as unknown as Url | null
  if (!record) {
    throw new Error('URL no encontrada')
  }
  if (record.user_id !== userId) {
    throw new Error('No tienes permiso para eliminar esta URL')
  }
  await db.execute({ sql: 'DELETE FROM urls WHERE slug = ?', args: [slug] })
}
