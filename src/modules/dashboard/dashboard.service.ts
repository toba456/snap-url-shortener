import type { Client } from '@libsql/client'
import { getDb } from '../../db/index.js'
import type {
  ClickPorDia,
  ClickPorHora,
  DashboardResponse,
  UrlsPorSemana,
} from './dashboard.types.js'

export async function getDashboardSummary(
  userId: number,
  db: Client = getDb(),
): Promise<DashboardResponse> {
  const resumenResult = await db.execute({
    sql: `SELECT
           COUNT(*) AS total_urls,
           COUNT(CASE WHEN expires_at IS NULL OR expires_at > datetime('now') THEN 1 END) AS urls_activas,
           COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at <= datetime('now') THEN 1 END) AS urls_expiradas
         FROM urls
         WHERE user_id = ?`,
    args: [userId],
  })
  const resumenUrls = resumenResult.rows[0] as unknown as {
    total_urls: number
    urls_activas: number
    urls_expiradas: number
  }

  const clicksResult = await db.execute({
    sql: `SELECT COUNT(*) AS total_clicks
          FROM clicks c
          JOIN urls u ON c.url_id = u.id
          WHERE u.user_id = ?`,
    args: [userId],
  })
  const { total_clicks } = clicksResult.rows[0] as unknown as { total_clicks: number }

  const clicksPorDiaResult = await db.execute({
    sql: `SELECT
           DATE(c.clicked_at) AS dia,
           COUNT(*)           AS clicks
         FROM clicks c
         JOIN urls u ON c.url_id = u.id
         WHERE u.user_id = ?
           AND c.clicked_at >= datetime('now', '-30 days')
         GROUP BY dia
         ORDER BY dia`,
    args: [userId],
  })
  const clicks_por_dia = clicksPorDiaResult.rows as unknown as ClickPorDia[]

  const clicksPorHoraResult = await db.execute({
    sql: `SELECT
           CAST(strftime('%H', c.clicked_at) AS INTEGER) AS hora,
           COUNT(*) AS clicks
         FROM clicks c
         JOIN urls u ON c.url_id = u.id
         WHERE u.user_id = ?
           AND c.clicked_at >= datetime('now', '-90 days')
         GROUP BY hora
         ORDER BY hora`,
    args: [userId],
  })
  const clicks_por_hora = clicksPorHoraResult.rows as unknown as ClickPorHora[]

  const urlsPorSemanaResult = await db.execute({
    sql: `SELECT
           strftime('%Y-W%W', created_at) AS semana,
           COUNT(*)                        AS urls_creadas
         FROM urls
         WHERE user_id = ?
         GROUP BY semana
         ORDER BY semana`,
    args: [userId],
  })
  const urls_por_semana = urlsPorSemanaResult.rows as unknown as UrlsPorSemana[]

  return {
    resumen: { ...resumenUrls, total_clicks },
    tendencias: { clicks_por_dia, clicks_por_hora, urls_por_semana },
  }
}
