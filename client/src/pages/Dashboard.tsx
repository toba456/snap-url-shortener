import { useState, useEffect, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../store/authContext'
import { getDashboard, type DashboardData, type ClickPorDia } from '../api/dashboard'
import { getUrls, createUrl, deleteUrl, type Url } from '../api/urls'

// ── Sub-componentes de visualización ─────────────────────────────────────────

type AccentColor = 'indigo' | 'emerald' | 'amber' | 'rose'

const accentMap: Record<AccentColor, { value: string; label: string }> = {
  indigo:  { value: 'text-forest',  label: 'text-sage' },
  emerald: { value: 'text-mist',    label: 'text-sage' },
  amber:   { value: 'text-sage',    label: 'text-sage' },
  rose:    { value: 'text-rose-400', label: 'text-sage' },
}

function StatCard({ label, value, accent = 'indigo' }: { label: string; value: number; accent?: AccentColor }) {
  const c = accentMap[accent]
  return (
    <div className="bg-forest/12 rounded-2xl border border-sage/20 p-6 hover:border-sage/40 transition-colors duration-200">
      <div className={`text-3xl font-bold tabular-nums tracking-tight ${c.value}`}>{value}</div>
      <div className={`text-xs font-semibold uppercase tracking-widest mt-2 ${c.label}`}>{label}</div>
    </div>
  )
}

function MiniBarChart({ data }: { data: ClickPorDia[] }) {
  const max = Math.max(...data.map((d) => d.clicks), 1)
  return (
    <div className="flex items-end gap-px h-16">
      {data.map((d) => (
        <div
          key={d.dia}
          title={`${d.dia}: ${d.clicks} click${d.clicks !== 1 ? 's' : ''}`}
          className={`flex-1 rounded-t-sm transition-all duration-200 cursor-default ${
            d.clicks > 0 ? 'bg-forest hover:bg-mist' : 'bg-sage/20'
          }`}
          style={{ height: `${Math.max((d.clicks / max) * 100, d.clicks > 0 ? 8 : 3)}%` }}
        />
      ))}
    </div>
  )
}

// ── Formulario de creación ────────────────────────────────────────────────────

interface CreateFormProps {
  token: string
  onCreated: (url: Url) => void
}

function CreateUrlForm({ token, onCreated }: CreateFormProps) {
  const [urlInput,  setUrlInput]  = useState('')
  const [shortUrl,  setShortUrl]  = useState<string | null>(null)
  const [copied,    setCopied]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)

  const BACKEND = 'http://localhost:3000'

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setShortUrl(null)
    setLoading(true)
    try {
      const created = await createUrl(token, { url: urlInput })
      onCreated(created)
      setShortUrl(`${BACKEND}/${created.slug}`)
      setUrlInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    if (!shortUrl) return
    void navigator.clipboard.writeText(shortUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleReset() {
    setShortUrl(null)
    setCopied(false)
  }

  return (
    <div className="space-y-4">
      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          id="url-input"
          type="url"
          placeholder="https://ejemplo.com/tu-url-larga"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          required
          disabled={loading}
          className="flex-1 bg-forest-dark border border-sage/30 rounded-xl px-4 py-2.5 text-sm text-cream placeholder:text-sage/50 focus:outline-none focus:ring-2 focus:ring-forest/40 focus:border-forest disabled:opacity-50 transition-all duration-200"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-forest hover:bg-forest/85 active:bg-forest-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-all duration-200 shadow-lg shadow-forest/20 shrink-0"
        >
          {loading ? 'Acortando...' : 'Acortar'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div role="alert" className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <span className="shrink-0">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Resultado */}
      {shortUrl && (
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-forest/10 border border-forest/20">
          <span className="text-xs text-forest font-semibold shrink-0 uppercase tracking-wider">Lista</span>
          <span className="flex-1 font-mono text-sm text-mist truncate">{shortUrl}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-200 bg-forest/15 border-forest/20 text-forest hover:bg-forest/25"
          >
            {copied ? '¡Copiado!' : 'Copiar'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="shrink-0 text-xs text-sage/50 hover:text-sage transition-colors duration-200"
            title="Acortar otra URL"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

// ── Lista de URLs ─────────────────────────────────────────────────────────────

interface UrlListProps {
  urls: Url[]
  token: string
  onDeleted: (slug: string) => void
}

function UrlList({ urls, token, onDeleted }: UrlListProps) {
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null)
  const [error,        setError]        = useState<string | null>(null)
  const BACKEND = 'http://localhost:3000'

  async function handleDelete(slug: string) {
    setError(null)
    setDeletingSlug(slug)
    try {
      await deleteUrl(token, slug)
      onDeleted(slug)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setDeletingSlug(null)
    }
  }

  function copyToClipboard(slug: string) {
    void navigator.clipboard.writeText(`${BACKEND}/${slug}`)
  }

  if (urls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-forest/12 rounded-2xl border border-sage/20 border-dashed">
        <div className="w-12 h-12 rounded-2xl bg-sage/20 flex items-center justify-center mb-3 text-xl">🔗</div>
        <p className="text-sm text-sage">No tienes URLs aún.</p>
        <p className="text-xs text-sage/70 mt-1">Crea la primera con el formulario de arriba.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-sage/20">
      {error && (
        <div role="alert" className="flex items-center gap-2.5 px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm">
          <span className="shrink-0">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Header */}
      <div className="grid grid-cols-[minmax(80px,120px)_1fr_100px_110px_80px] gap-4 px-5 py-3 bg-forest/20 border-b border-sage/20">
        <span className="text-xs font-semibold text-sage uppercase tracking-wider">Slug</span>
        <span className="text-xs font-semibold text-sage uppercase tracking-wider">URL original</span>
        <span className="text-xs font-semibold text-sage uppercase tracking-wider">Creada</span>
        <span className="text-xs font-semibold text-sage uppercase tracking-wider">Expira</span>
        <span />
      </div>

      {/* Rows */}
      {urls.map((url) => {
        const expired = url.expires_at != null && new Date(url.expires_at) < new Date()
        return (
          <div
            key={url.id}
            className="grid grid-cols-[minmax(80px,120px)_1fr_100px_110px_80px] gap-4 items-center px-5 py-3.5 bg-forest-dark border-b border-sage/10 last:border-0 hover:bg-forest/15 transition-colors duration-150 group"
          >
            <button
              type="button"
              className="font-mono text-sm text-forest hover:text-mist cursor-pointer transition-colors duration-200 truncate text-left"
              title="Copiar URL corta"
              onClick={() => copyToClipboard(url.slug)}
            >
              {url.slug}
            </button>

            <span className="text-sm text-mist truncate" title={url.original_url}>
              {url.original_url}
            </span>

            <span className="text-xs text-sage whitespace-nowrap">
              {url.created_at.slice(0, 10)}
            </span>

            <span className="text-xs whitespace-nowrap">
              {url.expires_at
                ? (
                  <span className={expired ? 'text-rose-400' : 'text-sage'}>
                    {url.expires_at.slice(0, 10)}{expired ? ' · exp.' : ''}
                  </span>
                )
                : <span className="text-sage/50">—</span>
              }
            </span>

            <button
              onClick={() => { void handleDelete(url.slug) }}
              disabled={deletingSlug === url.slug}
              className="text-xs text-sage/50 hover:text-rose-400 disabled:opacity-30 border border-transparent hover:border-rose-500/40 group-hover:border-sage/30 rounded-lg px-2.5 py-1.5 transition-all duration-200"
            >
              {deletingSlug === url.slug ? '···' : 'Eliminar'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const { token, user, clearAuth } = useAuth()
  const [urls,    setUrls]    = useState<Url[]>([])
  const [stats,   setStats]   = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    const currentToken: string = token
    let cancelled = false

    async function load() {
      try {
        const [allUrls, dashData] = await Promise.all([
          getUrls(),
          getDashboard(currentToken),
        ])
        if (cancelled) return
        setUrls(allUrls.filter((u) => u.user_id === user?.id))
        setStats(dashData)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Error al cargar'
        setError(msg)
        if (msg === 'Sesión expirada') clearAuth()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) return <Navigate to="/login" replace />

  function handleCreated(url: Url) {
    setUrls((prev) => [url, ...prev])
    setStats((prev) =>
      prev
        ? {
            ...prev,
            resumen: {
              ...prev.resumen,
              total_urls:   prev.resumen.total_urls + 1,
              urls_activas: prev.resumen.urls_activas + 1,
            },
          }
        : prev,
    )
  }

  function handleDeleted(slug: string) {
    setUrls((prev) => prev.filter((u) => u.slug !== slug))
    setStats((prev) =>
      prev
        ? {
            ...prev,
            resumen: {
              ...prev.resumen,
              total_urls:   Math.max(0, prev.resumen.total_urls - 1),
              urls_activas: Math.max(0, prev.resumen.urls_activas - 1),
            },
          }
        : prev,
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-forest-dark text-cream">

      {/* Navbar superior */}
      <header className="bg-forest-dark border-b border-sage/20 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-forest/15 border border-forest/20 flex items-center justify-center">
              <span className="text-xs font-bold text-forest">S</span>
            </div>
            <span className="text-base font-semibold tracking-tight text-cream">Snap</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-sage">
              Hola, <span className="text-cream font-medium">{user?.name}</span>
            </span>
            <button
              onClick={clearAuth}
              className="text-xs text-mist hover:text-cream border border-sage/30 hover:border-sage rounded-lg px-3 py-1.5 transition-all duration-200"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {loading && (
          <div className="flex items-center gap-2.5 text-sage text-sm">
            <div className="w-4 h-4 rounded-full border-2 border-forest border-t-transparent animate-spin" />
            Cargando datos...
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <span className="shrink-0">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {stats && (
          <>
            {/* KPI Grid */}
            <section>
              <h2 className="text-xs font-semibold text-sage uppercase tracking-widest mb-4">Resumen</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="URLs totales"   value={stats.resumen.total_urls}      accent="indigo"  />
                <StatCard label="Activas"        value={stats.resumen.urls_activas}    accent="emerald" />
                <StatCard label="Expiradas"      value={stats.resumen.urls_expiradas}  accent="amber"   />
                <StatCard label="Clicks totales" value={stats.resumen.total_clicks}    accent="rose"    />
              </div>
            </section>

            {/* Gráfico de clicks — últimos 30 días */}
            <section className="bg-forest/12 rounded-2xl border border-sage/20 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold text-cream">Clicks últimos 30 días</h2>
                <span className="text-xs text-sage/70">pasa el cursor sobre las barras</span>
              </div>
              <MiniBarChart data={stats.tendencias.clicks_por_dia_filled} />
              <div className="flex justify-between text-xs text-sage/50 mt-2.5">
                <span>{stats.tendencias.clicks_por_dia_filled.at(0)?.dia}</span>
                <span>{stats.tendencias.clicks_por_dia_filled.at(-1)?.dia}</span>
              </div>
            </section>

            {/* Clicks por hora */}
            {stats.tendencias.clicks_por_hora.length > 0 && (
              <section className="bg-forest/12 rounded-2xl border border-sage/20 p-6">
                <h2 className="text-sm font-semibold text-cream mb-4">Hora pico de actividad</h2>
                <div className="flex flex-wrap gap-2">
                  {stats.tendencias.clicks_por_hora.map(({ hora, clicks }) => (
                    <div key={hora} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-forest/10 border border-forest/20 text-xs">
                      <span className="font-semibold text-mist tabular-nums">{String(hora).padStart(2, '0')}h</span>
                      <span className="text-sage">{clicks}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* URLs por semana */}
            {stats.tendencias.urls_por_semana.length > 0 && (
              <section className="bg-forest/12 rounded-2xl border border-sage/20 p-6">
                <h2 className="text-sm font-semibold text-cream mb-4">URLs creadas por semana</h2>
                <div className="flex flex-wrap gap-2">
                  {stats.tendencias.urls_por_semana.map(({ semana, urls_creadas }) => (
                    <div key={semana} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-mist/10 border border-mist/20 text-xs">
                      <span className="font-semibold text-cream">{semana}</span>
                      <span className="text-sage">{urls_creadas} URL{urls_creadas !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Formulario de creación */}
        <section className="bg-forest/12 rounded-2xl border border-sage/20 p-6">
          <h2 className="text-sm font-semibold text-cream mb-5">Nueva URL corta</h2>
          <CreateUrlForm token={token} onCreated={handleCreated} />
        </section>

        {/* Lista de URLs */}
        <section>
          <h2 className="text-xs font-semibold text-sage uppercase tracking-widest mb-4">
            Mis URLs <span className="text-sage/50 normal-case font-normal">({urls.length})</span>
          </h2>
          {!loading && <UrlList urls={urls} token={token} onDeleted={handleDeleted} />}
        </section>

      </main>
    </div>
  )
}
