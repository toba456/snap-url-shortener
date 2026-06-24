import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'

interface TokenPayload {
  sub: number
  email: string
  name: string
}

export function makeAuthenticate(secret: string = config.jwtSecret) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token requerido' })
      return
    }

    const token = authHeader.slice(7)
    try {
      const payload = jwt.verify(token, secret) as TokenPayload
      req.user = { id: payload.sub, email: payload.email, name: payload.name }
      next()
    } catch {
      res.status(401).json({ error: 'Token inválido o expirado' })
    }
  }
}

export const authenticate = makeAuthenticate()
