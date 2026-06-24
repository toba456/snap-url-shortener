import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import Database from 'better-sqlite3'
import { getDb } from '../../db/index.js'
import { config } from '../../config.js'
import type { AuthResult, LoginDto, RegisterDto, User, UserPublic } from './auth.types.js'

export async function register(
  { email, password, name }: RegisterDto,
  db: Database.Database = getDb(),
  { secret = config.jwtSecret, saltRounds = 10 } = {},
): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase()
  const passwordHash = await bcrypt.hash(password, saltRounds)

  let user: UserPublic
  try {
    user = db
      .prepare(
        'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?) RETURNING id, email, name, created_at',
      )
      .get(normalizedEmail, passwordHash, name) as UserPublic
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      throw new Error('El email ya está registrado')
    }
    throw err
  }

  const token = jwt.sign({ sub: user.id, email: user.email, name: user.name }, secret, {
    expiresIn: '24h',
  })

  return { token, user }
}

export async function login(
  { email, password }: LoginDto,
  db: Database.Database = getDb(),
  { secret = config.jwtSecret } = {},
): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase()

  const row = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(normalizedEmail) as User | undefined

  if (!row) {
    throw new Error('Credenciales inválidas')
  }

  const isValid = await bcrypt.compare(password, row.password_hash)
  if (!isValid) {
    throw new Error('Credenciales inválidas')
  }

  const { password_hash: _, ...user } = row
  const token = jwt.sign({ sub: user.id, email: user.email, name: user.name }, secret, {
    expiresIn: '24h',
  })

  return { token, user }
}
