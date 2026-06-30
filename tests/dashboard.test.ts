import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import express, { RequestHandler } from 'express'
import { createClient, type Client } from '@libsql/client'
import jwt from 'jsonwebtoken'
import { initDb } from '../src/db/schema.js'
import { makeDashboardRouter } from '../src/modules/dashboard/dashboard.router.js'
import { makeAuthenticate } from '../src/middleware/authenticate.js'
import { errorHandler, notFoundHandler } from '../src/middleware/error-handlers.js'

const TEST_SECRET = 'test-secret'

async function createTestDb(): Promise<Client> {
  const db = createClient({ url: ':memory:' })
  await db.execute('PRAGMA foreign_keys = ON')
  await initDb(db)
  await db.execute({
    sql: 'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
    args: [1, 'user1@test.com', 'hash', 'User 1'],
  })
  await db.execute({
    sql: 'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
    args: [2, 'user2@test.com', 'hash', 'User 2'],
  })
  return db
}

function mockAuth(userId: number): RequestHandler {
  return (req, _res, next) => {
    req.user = { id: userId, email: `user${userId}@test.com`, name: `User ${userId}` }
    next()
  }
}

function createTestApp(db: Client, auth: RequestHandler) {
  const app = express()
  app.use(express.json())
  app.use(makeDashboardRouter(db, auth))
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}

async function insertUrl(
  db: Client,
  opts: { slug: string; userId: number; expiresAt?: string },
): Promise<number> {
  const result = await db.execute({
    sql: 'INSERT INTO urls (slug, original_url, user_id, expires_at) VALUES (?, ?, ?, ?) RETURNING id',
    args: [opts.slug, 'https://example.com', opts.userId, opts.expiresAt ?? null],
  })
  return result.rows[0].id as number
}

async function insertClick(db: Client, urlId: number, clickedAt: string): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO clicks (url_id, clicked_at) VALUES (?, ?)',
    args: [urlId, clickedAt],
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /dashboard — requiere autenticación', () => {
  it('sin token devuelve 401', async () => {
    const db = await createTestDb()
    const app = createTestApp(db, makeAuthenticate(TEST_SECRET))
    const res = await request(app).get('/dashboard')
    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('error')
  })

  it('token inválido devuelve 401', async () => {
    const db = await createTestDb()
    const app = createTestApp(db, makeAuthenticate(TEST_SECRET))
    const res = await request(app)
      .get('/dashboard')
      .set('Authorization', 'Bearer token.invalido.xxx')
    expect(res.status).toBe(401)
  })

  it('token firmado con secret incorrecto devuelve 401', async () => {
    const db = await createTestDb()
    const app = createTestApp(db, makeAuthenticate(TEST_SECRET))
    const badToken = jwt.sign({ sub: 1, email: 'x@x.com', name: 'X' }, 'wrong-secret')
    const res = await request(app)
      .get('/dashboard')
      .set('Authorization', `Bearer ${badToken}`)
    expect(res.status).toBe(401)
  })
})

describe('GET /dashboard — usuario sin URLs', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(async () => {
    const db = await createTestDb()
    app = createTestApp(db, mockAuth(1))
  })

  it('devuelve 200', async () => {
    const res = await request(app).get('/dashboard')
    expect(res.status).toBe(200)
  })

  it('resumen con todos los contadores en cero', async () => {
    const res = await request(app).get('/dashboard')
    expect(res.body.resumen).toEqual({
      total_urls: 0,
      urls_activas: 0,
      urls_expiradas: 0,
      total_clicks: 0,
    })
  })

  it('tendencias con arrays vacíos', async () => {
    const res = await request(app).get('/dashboard')
    expect(res.body.tendencias).toEqual({
      clicks_por_dia: [],
      clicks_por_hora: [],
      urls_por_semana: [],
    })
  })
})

describe('GET /dashboard — usuario con URLs y clicks', () => {
  let db: Client
  let app: ReturnType<typeof createTestApp>

  beforeEach(async () => {
    db = await createTestDb()
    app = createTestApp(db, mockAuth(1))
  })

  it('contabiliza correctamente URLs activas y expiradas', async () => {
    await insertUrl(db, { slug: 'activa1', userId: 1 })
    await insertUrl(db, { slug: 'activa2', userId: 1, expiresAt: '2099-01-01 00:00:00' })
    await insertUrl(db, { slug: 'expirada', userId: 1, expiresAt: '2020-01-01 00:00:00' })

    const res = await request(app).get('/dashboard')
    expect(res.body.resumen.total_urls).toBe(3)
    expect(res.body.resumen.urls_activas).toBe(2)
    expect(res.body.resumen.urls_expiradas).toBe(1)
  })

  it('cuenta el total de clicks del usuario', async () => {
    const urlId = await insertUrl(db, { slug: 'miurl', userId: 1 })
    await insertClick(db, urlId, '2026-06-20 10:00:00')
    await insertClick(db, urlId, '2026-06-20 14:00:00')
    await insertClick(db, urlId, '2026-06-21 09:00:00')

    const res = await request(app).get('/dashboard')
    expect(res.body.resumen.total_clicks).toBe(3)
  })

  it('agrupa clicks_por_dia correctamente', async () => {
    const urlId = await insertUrl(db, { slug: 'miurl', userId: 1 })
    await insertClick(db, urlId, '2026-06-20 10:00:00')
    await insertClick(db, urlId, '2026-06-20 14:00:00')
    await insertClick(db, urlId, '2026-06-21 09:00:00')

    const res = await request(app).get('/dashboard')
    const { clicks_por_dia } = res.body.tendencias as Array<{ dia: string; clicks: number }>[]

    expect(clicks_por_dia).toHaveLength(2)
    expect(clicks_por_dia.find((d: { dia: string }) => d.dia === '2026-06-20')?.clicks).toBe(2)
    expect(clicks_por_dia.find((d: { dia: string }) => d.dia === '2026-06-21')?.clicks).toBe(1)
  })

  it('agrupa clicks_por_hora correctamente', async () => {
    const urlId = await insertUrl(db, { slug: 'miurl', userId: 1 })
    await insertClick(db, urlId, '2026-06-20 09:00:00')
    await insertClick(db, urlId, '2026-06-20 09:30:00')
    await insertClick(db, urlId, '2026-06-20 14:00:00')

    const res = await request(app).get('/dashboard')
    const { clicks_por_hora } = res.body.tendencias

    expect(clicks_por_hora.find((h: { hora: number }) => h.hora === 9)?.clicks).toBe(2)
    expect(clicks_por_hora.find((h: { hora: number }) => h.hora === 14)?.clicks).toBe(1)
  })

  it('agrupa urls_por_semana correctamente', async () => {
    await db.execute({
      sql: 'INSERT INTO urls (slug, original_url, user_id, created_at) VALUES (?, ?, ?, ?)',
      args: ['url-w24', 'https://example.com', 1, '2026-06-08 10:00:00'],
    })
    await db.execute({
      sql: 'INSERT INTO urls (slug, original_url, user_id, created_at) VALUES (?, ?, ?, ?)',
      args: ['url-w25a', 'https://example.com', 1, '2026-06-15 10:00:00'],
    })
    await db.execute({
      sql: 'INSERT INTO urls (slug, original_url, user_id, created_at) VALUES (?, ?, ?, ?)',
      args: ['url-w25b', 'https://example.com', 1, '2026-06-16 10:00:00'],
    })

    const res = await request(app).get('/dashboard')
    const { urls_por_semana } = res.body.tendencias

    expect(urls_por_semana).toHaveLength(2)
    const semana25 = urls_por_semana.find((s: { semana: string }) => s.semana === '2026-W24')
    expect(semana25?.urls_creadas).toBe(2)
  })

  it('no muestra datos de otro usuario', async () => {
    const urlUser2 = await insertUrl(db, { slug: 'ajena', userId: 2 })
    await insertClick(db, urlUser2, '2026-06-20 10:00:00')
    await insertClick(db, urlUser2, '2026-06-20 11:00:00')

    const res = await request(app).get('/dashboard')
    expect(res.body.resumen.total_urls).toBe(0)
    expect(res.body.resumen.total_clicks).toBe(0)
    expect(res.body.tendencias.clicks_por_dia).toHaveLength(0)
  })

  it('estructura de respuesta contiene resumen y tendencias', async () => {
    const res = await request(app).get('/dashboard')
    expect(res.body).toHaveProperty('resumen')
    expect(res.body).toHaveProperty('tendencias')
    expect(res.body.tendencias).toHaveProperty('clicks_por_dia')
    expect(res.body.tendencias).toHaveProperty('clicks_por_hora')
    expect(res.body.tendencias).toHaveProperty('urls_por_semana')
  })
})
