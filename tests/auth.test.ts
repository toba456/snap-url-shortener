import { describe, it, expect, beforeEach } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import jwt from 'jsonwebtoken'
import { initDb } from '../src/db/schema.js'
import { register, login } from '../src/modules/auth/auth.service.js'

const TEST_SECRET = 'test-secret'
const OPTS = { secret: TEST_SECRET, saltRounds: 1 }

async function createTestDb(): Promise<Client> {
  const db = createClient({ url: ':memory:' })
  await db.execute('PRAGMA foreign_keys = ON')
  await initDb(db)
  return db
}

describe('auth service', () => {
  let db: Client

  beforeEach(async () => {
    db = await createTestDb()
  })

  describe('register', () => {
    it('registro exitoso devuelve token y usuario sin password_hash', async () => {
      const result = await register(
        { email: 'ana@example.com', password: 'pass123', name: 'Ana' },
        db,
        OPTS,
      )

      expect(result.token).toBeDefined()
      expect(result.user.email).toBe('ana@example.com')
      expect(result.user.name).toBe('Ana')
      expect(result.user).not.toHaveProperty('password_hash')
    })

    it('el token contiene el payload correcto', async () => {
      const { token, user } = await register(
        { email: 'ana@example.com', password: 'pass123', name: 'Ana' },
        db,
        OPTS,
      )

      const payload = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload
      expect(payload.sub).toBe(user.id)
      expect(payload.email).toBe('ana@example.com')
    })

    it('normaliza el email a minúsculas al registrar', async () => {
      const result = await register(
        { email: 'ANA@EXAMPLE.COM', password: 'pass123', name: 'Ana' },
        db,
        OPTS,
      )

      expect(result.user.email).toBe('ana@example.com')
    })

    it('registro con email duplicado lanza error claro', async () => {
      await register({ email: 'ana@example.com', password: 'pass123', name: 'Ana' }, db, OPTS)

      await expect(
        register({ email: 'ana@example.com', password: 'otrapass', name: 'Ana 2' }, db, OPTS),
      ).rejects.toThrow('El email ya está registrado')
    })
  })

  describe('login', () => {
    beforeEach(async () => {
      await register(
        { email: 'ana@example.com', password: 'pass123', name: 'Ana' },
        db,
        OPTS,
      )
    })

    it('login exitoso devuelve token y usuario', async () => {
      const result = await login({ email: 'ana@example.com', password: 'pass123' }, db, OPTS)

      expect(result.token).toBeDefined()
      expect(result.user.email).toBe('ana@example.com')
      expect(result.user).not.toHaveProperty('password_hash')
    })

    it('login con password incorrecto lanza error', async () => {
      await expect(
        login({ email: 'ana@example.com', password: 'wrongpass' }, db, OPTS),
      ).rejects.toThrow('Credenciales inválidas')
    })

    it('login con email inexistente lanza error', async () => {
      await expect(
        login({ email: 'noexiste@example.com', password: 'pass123' }, db, OPTS),
      ).rejects.toThrow('Credenciales inválidas')
    })

    it('login con email en mayúsculas funciona', async () => {
      const result = await login({ email: 'ANA@EXAMPLE.COM', password: 'pass123' }, db, OPTS)

      expect(result.token).toBeDefined()
      expect(result.user.email).toBe('ana@example.com')
    })
  })
})
