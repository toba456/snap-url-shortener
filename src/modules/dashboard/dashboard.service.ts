import Database from 'better-sqlite3'
import { getDb } from '../../db/index.js'
import type {
  ClickPorDia,
  ClickPorHora,
  DashboardResponse,
  UrlsPorSemana,
} from './dashboard.types.js'

export function getDashboardSummary(
  userId: number,
  db: Database.Database = getDb(),
): DashboardResponse {
  const resumenUrls = db
    .prepare(
      `SELECT
         COUNT(*) AS total_urls,
         COUNT(CASE WHEN expires_at IS NULL OR expires_at > datetime('now') THEN 1 END) AS urls_activas,
         COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at <= datetime('now') THEN 1 END) AS urls_expiradas
       FROM urls
       WHERE user_id = ?`,
    )
    .get(userId) as { total_urls: number; urls_activas: number; urls_expiradas: number }

  const { total_clicks } = db
    .prepare(
      `SELECT COUNT(*) AS total_clicks
       FROM clicks c
       JOIN urls u ON c.url_id = u.id
       WHERE u.user_id = ?`,
    )
    .get(userId) as { total_clicks: number }

  const clicks_por_dia = db
    .prepare(
      `SELECT
         DATE(c.clicked_at) AS dia,
         COUNT(*)           AS clicks
       FROM clicks c
       JOIN urls u ON c.url_id = u.id
       WHERE u.user_id = ?
         AND c.clicked_at >= datetime('now', '-30 days')
       GROUP BY dia
       ORDER BY dia`,
    )
    .all(userId) as ClickPorDia[]

  const clicks_por_hora = db
    .prepare(
      `SELECT
         CAST(strftime('%H', c.clicked_at) AS INTEGER) AS hora,
         COUNT(*) AS clicks
       FROM clicks c
       JOIN urls u ON c.url_id = u.id
       WHERE u.user_id = ?
         AND c.clicked_at >= datetime('now', '-90 days')
       GROUP BY hora
       ORDER BY hora`,
    )
    .all(userId) as ClickPorHora[]

  const urls_por_semana = db
    .prepare(
      `SELECT
         strftime('%Y-W%W', created_at) AS semana,
         COUNT(*)                        AS urls_creadas
       FROM urls
       WHERE user_id = ?
       GROUP BY semana
       ORDER BY semana`,
    )
    .all(userId) as UrlsPorSemana[]

  return {
    resumen: { ...resumenUrls, total_clicks },
    tendencias: { clicks_por_dia, clicks_por_hora, urls_por_semana },
  }
}
