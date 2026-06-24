export interface DashboardResumen {
  total_urls: number
  urls_activas: number
  urls_expiradas: number
  total_clicks: number
}

export interface ClickPorDia {
  dia: string
  clicks: number
}

export interface ClickPorHora {
  hora: number
  clicks: number
}

export interface UrlsPorSemana {
  semana: string
  urls_creadas: number
}

export interface DashboardTendencias {
  clicks_por_dia: ClickPorDia[]
  clicks_por_hora: ClickPorHora[]
  urls_por_semana: UrlsPorSemana[]
}

export interface DashboardResponse {
  resumen: DashboardResumen
  tendencias: DashboardTendencias
}
