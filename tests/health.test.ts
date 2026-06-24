import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import app from '../src/app.js'
import { errorHandler, notFoundHandler } from '../src/middleware/error-handlers.js'

describe('GET /health', () => {
  it('responde con status 200', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
  })

  it('devuelve { status: "ok" }', async () => {
    const res = await request(app).get('/health')
    expect(res.body).toEqual({ status: 'ok' })
  })
})

describe('404 handler', () => {
  it('devuelve 404 para rutas inexistentes', async () => {
    const res = await request(app).get('/ruta-que-no-existe')
    expect(res.status).toBe(404)
  })

  it('devuelve JSON con campo error', async () => {
    const res = await request(app).get('/ruta-que-no-existe')
    expect(res.body).toHaveProperty('error')
  })
})

describe('500 error handler', () => {
  const crashApp = express()
  crashApp.get('/boom', (_req, _res, next) => {
    next(new Error('fallo interno'))
  })
  crashApp.use(notFoundHandler)
  crashApp.use(errorHandler)

  it('captura excepciones y devuelve 500', async () => {
    const res = await request(crashApp).get('/boom')
    expect(res.status).toBe(500)
  })

  it('devuelve JSON con campo error sin exponer stack', async () => {
    const res = await request(crashApp).get('/boom')
    expect(res.body).toHaveProperty('error')
    expect(res.body).not.toHaveProperty('stack')
  })

  it('en desarrollo incluye el mensaje del error', async () => {
    const res = await request(crashApp).get('/boom')
    expect(res.body.message).toBe('fallo interno')
  })
})
