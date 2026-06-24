import { NextFunction, Request, Response } from 'express'

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Ruta no encontrada' })
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isDev = process.env.NODE_ENV !== 'production'
  res.status(500).json({
    error: 'Error interno del servidor',
    ...(isDev && { message: err.message }),
  })
}
