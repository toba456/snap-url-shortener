export interface Config {
  port: number
  env: 'development' | 'production'
  dbName: string
  jwtSecret: string
}

export function buildConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const nodeEnv = env.NODE_ENV === 'production' ? 'production' : 'development'
  const isProduction = nodeEnv === 'production'

  if (isProduction && !env.PORT) {
    throw new Error('La variable de entorno PORT es obligatoria en producción')
  }
  if (isProduction && !env.JWT_SECRET) {
    throw new Error('La variable de entorno JWT_SECRET es obligatoria en producción')
  }

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    env: nodeEnv,
    dbName: env.DB_NAME ?? 'snap.db',
    jwtSecret: env.JWT_SECRET ?? 'dev-secret-change-me',
  }
}

export const config = buildConfig()
