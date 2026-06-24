import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import Database from 'better-sqlite3'
import { initDb } from '../src/db/schema.js'
import { makeAuthRouter } from '../src/modules/auth/auth.router.js'
import { errorHandler, notFoundHandler } from '../src/middleware/error-handlers.js'

const TEST_SECRET = 'test-secret'
const OPTS = { secret: TEST_SECRET, saltRounds: 1 }

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  initDb(db)
  return db
}

function createTestApp(db: Database.Database) {
  const app = express()
  app.use(express.json())
  app.use(makeAuthRouter(db, OPTS))
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}

describe('POST /auth/register', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp(createTestDb())
  })

  it('registro exitoso devuelve 201 con token y usuario', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'ana@example.com', password: 'pass123', name: 'Ana' })

    expect(res.status).toBe(201)
    expect(res.body.token).toBeDefined()
    expect(res.body.user.email).toBe('ana@example.com')
    expect(res.body.user).not.toHaveProperty('password_hash')
  })

  it('email duplicado devuelve 409', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'ana@example.com', password: 'pass123', name: 'Ana' })

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'ana@example.com', password: 'otrapass', name: 'Ana 2' })

    expect(res.status).toBe(409)
    expect(res.body).toHaveProperty('error')
  })

  it('email inválido devuelve 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'no-es-email', password: 'pass123', name: 'Ana' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/email/i)
  })

  it('password corto devuelve 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'ana@example.com', password: '123', name: 'Ana' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/password/i)
  })

  it('nombre vacío devuelve 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'ana@example.com', password: 'pass123', name: '   ' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/nombre/i)
  })

  it('body vacío devuelve 400', async () => {
    const res = await request(app).post('/auth/register').send({})
    expect(res.status).toBe(400)
  })
})

describe('POST /auth/login', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(async () => {
    const db = createTestDb()
    app = createTestApp(db)
    await request(app)
      .post('/auth/register')
      .send({ email: 'ana@example.com', password: 'pass123', name: 'Ana' })
  })

  it('login exitoso devuelve 200 con token y usuario', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'ana@example.com', password: 'pass123' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
    expect(res.body.user.email).toBe('ana@example.com')
    expect(res.body.user).not.toHaveProperty('password_hash')
  })

  it('password incorrecto devuelve 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'ana@example.com', password: 'wrongpass' })

    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('error')
  })

  it('email inexistente devuelve 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'noexiste@example.com', password: 'pass123' })

    expect(res.status).toBe(401)
  })

  it('campos faltantes devuelven 400', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'ana@example.com' })
    expect(res.status).toBe(400)
  })
})
