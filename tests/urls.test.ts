import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import express, { RequestHandler } from 'express'
import { createClient, type Client } from '@libsql/client'
import { initDb } from '../src/db/schema.js'
import { makeUrlsRouter } from '../src/modules/urls/urls.router.js'
import { createUrl, findBySlug, listUrls } from '../src/modules/urls/urls.service.js'
import { errorHandler, notFoundHandler } from '../src/middleware/error-handlers.js'

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

function createTestApp(db: Client, userId = 1) {
  const app = express()
  app.use(express.json())
  app.use(makeUrlsRouter(db, mockAuth(userId)))
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}

// ── Service unit tests ────────────────────────────────────────────────────────

describe('urls service', () => {
  let db: Client

  beforeEach(async () => {
    db = await createTestDb()
  })

  it('crea una URL y devuelve el registro completo', async () => {
    const record = await createUrl({ original_url: 'https://example.com', user_id: 1 }, db)
    expect(record.id).toBeDefined()
    expect(record.original_url).toBe('https://example.com')
    expect(record.slug).toHaveLength(6)
    expect(record.created_at).toBeDefined()
    expect(record.user_id).toBe(1)
  })

  it('acepta slug personalizado', async () => {
    const record = await createUrl({ original_url: 'https://example.com', slug: 'custom' }, db)
    expect(record.slug).toBe('custom')
  })

  it('lanza error si el slug ya existe', async () => {
    await createUrl({ original_url: 'https://a.com', slug: 'dup' }, db)
    await expect(createUrl({ original_url: 'https://b.com', slug: 'dup' }, db)).rejects.toThrow()
  })

  it('findBySlug devuelve el registro correcto', async () => {
    const created = await createUrl({ original_url: 'https://example.com', slug: 'abc123' }, db)
    const found = await findBySlug('abc123', db)
    expect(found?.id).toBe(created.id)
  })

  it('findBySlug devuelve null si no existe', async () => {
    expect(await findBySlug('noexiste', db)).toBeNull()
  })

  it('listUrls devuelve todas las URLs en orden descendente', async () => {
    await createUrl({ original_url: 'https://first.com', slug: 'aaa' }, db)
    await createUrl({ original_url: 'https://second.com', slug: 'bbb' }, db)
    const list = await listUrls(db)
    expect(list).toHaveLength(2)
    expect(list[0].slug).toBe('bbb')
  })
})

// ── HTTP integration tests ────────────────────────────────────────────────────

describe('POST /urls', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(async () => {
    app = createTestApp(await createTestDb())
  })

  it('crea una URL corta y responde 201', async () => {
    const res = await request(app).post('/urls').send({ url: 'https://example.com' })

    expect(res.status).toBe(201)
    expect(res.body.slug).toBeDefined()
    expect(res.body.original_url).toBe('https://example.com')
    expect(res.body.user_id).toBe(1)
  })

  it('responde 400 si falta el campo url', async () => {
    const res = await request(app).post('/urls').send({})
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('responde 400 si la URL no es válida', async () => {
    const res = await request(app).post('/urls').send({ url: 'no-es-una-url' })
    expect(res.status).toBe(400)
  })

  it('acepta slug personalizado', async () => {
    const res = await request(app).post('/urls').send({ url: 'https://example.com', slug: 'milink' })
    expect(res.status).toBe(201)
    expect(res.body.slug).toBe('milink')
  })
})

describe('DELETE /urls/:slug', () => {
  let db: Client

  beforeEach(async () => {
    db = await createTestDb()
  })

  it('el propietario puede borrar su URL (204)', async () => {
    await createUrl({ original_url: 'https://example.com', slug: 'myurl', user_id: 1 }, db)
    const app = createTestApp(db, 1)
    const res = await request(app).delete('/urls/myurl')
    expect(res.status).toBe(204)
  })

  it('otro usuario recibe 403', async () => {
    await createUrl({ original_url: 'https://example.com', slug: 'myurl', user_id: 1 }, db)
    const app = createTestApp(db, 2)
    const res = await request(app).delete('/urls/myurl')
    expect(res.status).toBe(403)
    expect(res.body).toHaveProperty('error')
  })

  it('slug inexistente devuelve 404', async () => {
    const app = createTestApp(db, 1)
    const res = await request(app).delete('/urls/noexiste')
    expect(res.status).toBe(404)
  })

  it('la URL ya no existe tras borrarse', async () => {
    await createUrl({ original_url: 'https://example.com', slug: 'gone', user_id: 1 }, db)
    const app = createTestApp(db, 1)
    await request(app).delete('/urls/gone')
    expect(await findBySlug('gone', db)).toBeNull()
  })
})

describe('GET /urls', () => {
  let app: ReturnType<typeof createTestApp>
  let db: Client

  beforeEach(async () => {
    db = await createTestDb()
    app = createTestApp(db)
  })

  it('devuelve lista vacía cuando no hay URLs', async () => {
    const res = await request(app).get('/urls')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('devuelve las URLs creadas', async () => {
    await createUrl({ original_url: 'https://example.com', slug: 'test1' }, db)
    const res = await request(app).get('/urls')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].slug).toBe('test1')
  })
})

describe('GET /:slug', () => {
  let app: ReturnType<typeof createTestApp>
  let db: Client

  beforeEach(async () => {
    db = await createTestDb()
    app = createTestApp(db)
  })

  it('redirige 302 a la URL original', async () => {
    await createUrl({ original_url: 'https://example.com', slug: 'redir' }, db)
    const res = await request(app).get('/redir')
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('https://example.com')
  })

  it('responde 404 si el slug no existe', async () => {
    const res = await request(app).get('/no-existe')
    expect(res.status).toBe(404)
  })
})
