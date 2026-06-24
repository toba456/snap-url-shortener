import { describe, it, expect } from 'vitest'
import { buildConfig } from '../src/config.js'

describe('buildConfig', () => {
  it('devuelve valores por defecto cuando no hay variables de entorno', () => {
    const cfg = buildConfig({})
    expect(cfg.port).toBe(3000)
    expect(cfg.env).toBe('development')
    expect(cfg.dbName).toBe('snap.db')
  })

  it('lee PORT del entorno', () => {
    const cfg = buildConfig({ PORT: '8080' })
    expect(cfg.port).toBe(8080)
  })

  it('lee DB_NAME del entorno', () => {
    const cfg = buildConfig({ DB_NAME: 'test.db' })
    expect(cfg.dbName).toBe('test.db')
  })

  it('reconoce NODE_ENV=production', () => {
    const cfg = buildConfig({ NODE_ENV: 'production', PORT: '4000', JWT_SECRET: 'secret' })
    expect(cfg.env).toBe('production')
  })

  it('lanza error si JWT_SECRET falta en producción', () => {
    expect(() => buildConfig({ NODE_ENV: 'production', PORT: '4000' })).toThrow(
      'JWT_SECRET es obligatoria en producción',
    )
  })

  it('trata cualquier valor distinto de production como development', () => {
    const cfg = buildConfig({ NODE_ENV: 'staging' })
    expect(cfg.env).toBe('development')
  })

  it('lanza error si PORT falta en producción', () => {
    expect(() => buildConfig({ NODE_ENV: 'production' })).toThrow(
      'PORT es obligatoria en producción',
    )
  })

  it('no lanza error si PORT falta en desarrollo', () => {
    expect(() => buildConfig({ NODE_ENV: 'development' })).not.toThrow()
  })
})
