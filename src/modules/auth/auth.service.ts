import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { Client } from '@libsql/client'
import { getDb } from '../../db/index.js'
import { config } from '../../config.js'
import type { AuthResult, LoginDto, RegisterDto, User, UserPublic } from './auth.types.js'

export async function register(
  { email, password, name }: RegisterDto,
  db: Client = getDb(),
  { secret = config.jwtSecret, saltRounds = 10 } = {},
): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase()
  const passwordHash = await bcrypt.hash(password, saltRounds)

  let user: UserPublic
  try {
    const result = await db.execute({
      sql: 'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?) RETURNING id, email, name, created_at',
      args: [normalizedEmail, passwordHash, name],
    })
    user = result.rows[0] as unknown as UserPublic
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
  db: Client = getDb(),
  { secret = config.jwtSecret } = {},
): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase()

  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE email = ?',
    args: [normalizedEmail],
  })
  const row = (result.rows[0] ?? null) as unknown as User | null

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
