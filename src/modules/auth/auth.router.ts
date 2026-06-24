import { Router, Request, Response } from 'express'
import Database from 'better-sqlite3'
import { getDb } from '../../db/index.js'
import { register, login } from './auth.service.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface ServiceOpts {
  secret?: string
  saltRounds?: number
}

function validateRegister(body: unknown) {
  if (!body || typeof body !== 'object') return 'Body inválido'
  const { email, password, name } = body as Record<string, unknown>
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email))
    return 'Email inválido'
  if (!password || typeof password !== 'string' || password.length < 6)
    return 'El password debe tener al menos 6 caracteres'
  if (!name || typeof name !== 'string' || name.trim().length === 0)
    return 'El nombre es obligatorio'
  return { email, password, name: name.trim() }
}

function validateLogin(body: unknown) {
  if (!body || typeof body !== 'object') return 'Body inválido'
  const { email, password } = body as Record<string, unknown>
  if (!email || typeof email !== 'string') return 'El email es obligatorio'
  if (!password || typeof password !== 'string') return 'El password es obligatorio'
  return { email, password }
}

export function makeAuthRouter(
  db: Database.Database = getDb(),
  opts: ServiceOpts = {},
): Router {
  const router = Router()

  router.post('/auth/register', async (req: Request, res: Response) => {
    const parsed = validateRegister(req.body)
    if (typeof parsed === 'string') {
      res.status(400).json({ error: parsed })
      return
    }
    try {
      const result = await register(parsed, db, opts)
      res.status(201).json(result)
    } catch (err) {
      if (err instanceof Error && err.message === 'El email ya está registrado') {
        res.status(409).json({ error: err.message })
        return
      }
      throw err
    }
  })

  router.post('/auth/login', async (req: Request, res: Response) => {
    const parsed = validateLogin(req.body)
    if (typeof parsed === 'string') {
      res.status(400).json({ error: parsed })
      return
    }
    try {
      const result = await login(parsed, db, opts)
      res.json(result)
    } catch (err) {
      if (err instanceof Error && err.message === 'Credenciales inválidas') {
        res.status(401).json({ error: err.message })
        return
      }
      throw err
    }
  })

  return router
}
