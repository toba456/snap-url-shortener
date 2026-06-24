import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { makeAuthenticate } from '../src/middleware/authenticate.js'

const TEST_SECRET = 'test-secret'
const authenticate = makeAuthenticate(TEST_SECRET)

function createTestApp() {
  const app = express()
  app.get('/protected', authenticate, (req, res) => {
    res.json({ user: req.user })
  })
  return app
}

function makeToken(payload: object, secret = TEST_SECRET, opts: jwt.SignOptions = {}) {
  return jwt.sign(payload, secret, opts)
}

describe('authenticate middleware', () => {
  const app = createTestApp()
  const validToken = makeToken({ sub: 1, email: 'ana@example.com', name: 'Ana' })

  it('token válido pasa y adjunta req.user', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${validToken}`)

    expect(res.status).toBe(200)
    expect(res.body.user.id).toBe(1)
    expect(res.body.user.email).toBe('ana@example.com')
    expect(res.body.user.name).toBe('Ana')
  })

  it('sin header Authorization devuelve 401', async () => {
    const res = await request(app).get('/protected')
    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('error')
  })

  it('header sin prefijo Bearer devuelve 401', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', validToken)

    expect(res.status).toBe(401)
  })

  it('token con firma inválida devuelve 401', async () => {
    const badToken = makeToken({ sub: 1, email: 'ana@example.com', name: 'Ana' }, 'wrong-secret')

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${badToken}`)

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/inválido/i)
  })

  it('token malformado devuelve 401', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer esto.no.es.un.jwt')

    expect(res.status).toBe(401)
  })

  it('token expirado devuelve 401', async () => {
    const expiredToken = makeToken(
      { sub: 1, email: 'ana@example.com', name: 'Ana' },
      TEST_SECRET,
      { expiresIn: '-1s' },
    )

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${expiredToken}`)

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/inválido/i)
  })
})
