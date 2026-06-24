// ── Tipos que espeja la respuesta del backend ─────────────────────────────────

export interface DashboardResumen {
  total_urls: number
  urls_activas: number
  urls_expiradas: number
  total_clicks: number
}

export interface ClickPorDia {
  dia: string    // "YYYY-MM-DD"
  clicks: number
}

export interface ClickPorHora {
  hora: number   // 0–23
  clicks: number
}

export interface UrlsPorSemana {
  semana: string      // "YYYY-Www"
  urls_creadas: number
}

// ── Tipo enriquecido que devuelve el cliente (con gaps rellenos) ───────────────

export interface DashboardData {
  resumen: DashboardResumen
  tendencias: {
    clicks_por_dia: ClickPorDia[]         // sparse: solo días con actividad
    clicks_por_dia_filled: ClickPorDia[]  // denso: 30 días continuos, huecos = 0
    clicks_por_hora: ClickPorHora[]
    urls_por_semana: UrlsPorSemana[]
  }
}

// ── Lógica de transformación ──────────────────────────────────────────────────

function fillDailyGaps(sparse: ClickPorDia[], days = 30): ClickPorDia[] {
  const byDay = new Map(sparse.map((d) => [d.dia, d.clicks]))
  const result: ClickPorDia[] = []

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    // toISOString devuelve UTC; para fechas locales usamos componentes directos
    const dia = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')

    result.push({ dia, clicks: byDay.get(dia) ?? 0 })
  }

  return result
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

interface RawDashboard {
  resumen: DashboardResumen
  tendencias: {
    clicks_por_dia: ClickPorDia[]
    clicks_por_hora: ClickPorHora[]
    urls_por_semana: UrlsPorSemana[]
  }
}

export async function getDashboard(token: string): Promise<DashboardData> {
  const res = await fetch('/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 401) throw new Error('Sesión expirada')
  const raw = await res.json() as RawDashboard
  if (!res.ok) throw new Error('Error al cargar el dashboard')

  return {
    resumen: raw.resumen,
    tendencias: {
      clicks_por_dia:        raw.tendencias.clicks_por_dia,
      clicks_por_dia_filled: fillDailyGaps(raw.tendencias.clicks_por_dia),
      clicks_por_hora:       raw.tendencias.clicks_por_hora,
      urls_por_semana:       raw.tendencias.urls_por_semana,
    },
  }
}
