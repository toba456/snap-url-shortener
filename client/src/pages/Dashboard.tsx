import { useState, useEffect, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../store/authContext'
import { getDashboard, type DashboardData, type ClickPorDia } from '../api/dashboard'
import { getUrls, createUrl, deleteUrl, type Url } from '../api/urls'

// ── Sub-componentes de visualización ─────────────────────────────────────────

type AccentColor = 'indigo' | 'emerald' | 'amber' | 'rose'

const accentMap: Record<AccentColor, { value: string; label: string }> = {
  indigo:  { value: 'text-indigo-400',  label: 'text-zinc-500' },
  emerald: { value: 'text-emerald-400', label: 'text-zinc-500' },
  amber:   { value: 'text-amber-400',   label: 'text-zinc-500' },
  rose:    { value: 'text-rose-400',    label: 'text-zinc-500' },
}

function StatCard({ label, value, accent = 'indigo' }: { label: string; value: number; accent?: AccentColor }) {
  const c = accentMap[accent]
  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 hover:border-zinc-700 transition-colors duration-200">
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
            d.clicks > 0 ? 'bg-indigo-500 hover:bg-indigo-400' : 'bg-zinc-800'
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
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 disabled:opacity-50 transition-all duration-200"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-all duration-200 shadow-lg shadow-indigo-500/20 shrink-0"
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
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
          <span className="text-xs text-emerald-500 font-semibold shrink-0 uppercase tracking-wider">Lista</span>
          <span className="flex-1 font-mono text-sm text-emerald-300 truncate">{shortUrl}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-200 bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
          >
            {copied ? '¡Copiado!' : 'Copiar'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="shrink-0 text-xs text-zinc-600 hover:text-zinc-400 transition-colors duration-200"
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
      <div className="flex flex-col items-center justify-center py-16 text-center bg-zinc-900 rounded-2xl border border-zinc-800 border-dashed">
        <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mb-3 text-xl">🔗</div>
        <p className="text-sm text-zinc-500">No tienes URLs aún.</p>
        <p className="text-xs text-zinc-600 mt-1">Crea la primera con el formulario de arriba.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800">
      {error && (
        <div role="alert" className="flex items-center gap-2.5 px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm">
          <span className="shrink-0">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Header */}
      <div className="grid grid-cols-[minmax(80px,120px)_1fr_100px_110px_80px] gap-4 px-5 py-3 bg-zinc-800/60 border-b border-zinc-800">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Slug</span>
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">URL original</span>
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Creada</span>
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Expira</span>
        <span />
      </div>

      {/* Rows */}
      {urls.map((url) => {
        const expired = url.expires_at != null && new Date(url.expires_at) < new Date()
        return (
          <div
            key={url.id}
            className="grid grid-cols-[minmax(80px,120px)_1fr_100px_110px_80px] gap-4 items-center px-5 py-3.5 bg-zinc-900 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/40 transition-colors duration-150 group"
          >
            <button
              type="button"
              className="font-mono text-sm text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors duration-200 truncate text-left"
              title="Copiar URL corta"
              onClick={() => copyToClipboard(url.slug)}
            >
              {url.slug}
            </button>

            <span className="text-sm text-zinc-400 truncate" title={url.original_url}>
              {url.original_url}
            </span>

            <span className="text-xs text-zinc-600 whitespace-nowrap">
              {url.created_at.slice(0, 10)}
            </span>

            <span className="text-xs whitespace-nowrap">
              {url.expires_at
                ? (
                  <span className={expired ? 'text-rose-400' : 'text-zinc-600'}>
                    {url.expires_at.slice(0, 10)}{expired ? ' · exp.' : ''}
                  </span>
                )
                : <span className="text-zinc-700">—</span>
              }
            </span>

            <button
              onClick={() => { void handleDelete(url.slug) }}
              disabled={deletingSlug === url.slug}
              className="text-xs text-zinc-600 hover:text-rose-400 disabled:opacity-30 border border-transparent hover:border-rose-500/40 group-hover:border-zinc-700 rounded-lg px-2.5 py-1.5 transition-all duration-200"
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
  // Todos los hooks ANTES de cualquier return condicional (reglas de hooks)
  const { token, user, clearAuth } = useAuth()
  const [urls,    setUrls]    = useState<Url[]>([])
  const [stats,   setStats]   = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    const currentToken: string = token  // captura el valor ya estrechado para el closure
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

  // Guard: después de todos los hooks
  if (!token) return <Navigate to="/login" replace />

  // A partir de aquí TypeScript sabe que token es string
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* Navbar superior */}
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
              <span className="text-xs font-bold text-indigo-400">S</span>
            </div>
            <span className="text-base font-semibold tracking-tight text-zinc-100">Snap</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">
              Hola, <span className="text-zinc-300 font-medium">{user?.name}</span>
            </span>
            <button
              onClick={clearAuth}
              className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded-lg px-3 py-1.5 transition-all duration-200"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Estado de carga */}
        {loading && (
          <div className="flex items-center gap-2.5 text-zinc-500 text-sm">
            <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
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
              <h2 className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-4">Resumen</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="URLs totales"   value={stats.resumen.total_urls}      accent="indigo"  />
                <StatCard label="Activas"        value={stats.resumen.urls_activas}    accent="emerald" />
                <StatCard label="Expiradas"      value={stats.resumen.urls_expiradas}  accent="amber"   />
                <StatCard label="Clicks totales" value={stats.resumen.total_clicks}    accent="rose"    />
              </div>
            </section>

            {/* Gráfico de clicks — últimos 30 días */}
            <section className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold text-zinc-200">Clicks últimos 30 días</h2>
                <span className="text-xs text-zinc-600">pasa el cursor sobre las barras</span>
              </div>
              <MiniBarChart data={stats.tendencias.clicks_por_dia_filled} />
              <div className="flex justify-between text-xs text-zinc-700 mt-2.5">
                <span>{stats.tendencias.clicks_por_dia_filled.at(0)?.dia}</span>
                <span>{stats.tendencias.clicks_por_dia_filled.at(-1)?.dia}</span>
              </div>
            </section>

            {/* Clicks por hora */}
            {stats.tendencias.clicks_por_hora.length > 0 && (
              <section className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
                <h2 className="text-sm font-semibold text-zinc-200 mb-4">Hora pico de actividad</h2>
                <div className="flex flex-wrap gap-2">
                  {stats.tendencias.clicks_por_hora.map(({ hora, clicks }) => (
                    <div key={hora} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs">
                      <span className="font-semibold text-indigo-300 tabular-nums">{String(hora).padStart(2, '0')}h</span>
                      <span className="text-zinc-600">{clicks}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* URLs por semana */}
            {stats.tendencias.urls_por_semana.length > 0 && (
              <section className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
                <h2 className="text-sm font-semibold text-zinc-200 mb-4">URLs creadas por semana</h2>
                <div className="flex flex-wrap gap-2">
                  {stats.tendencias.urls_por_semana.map(({ semana, urls_creadas }) => (
                    <div key={semana} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs">
                      <span className="font-semibold text-emerald-300">{semana}</span>
                      <span className="text-zinc-600">{urls_creadas} URL{urls_creadas !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Formulario de creación */}
        <section className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-200 mb-5">Nueva URL corta</h2>
          <CreateUrlForm token={token} onCreated={handleCreated} />
        </section>

        {/* Lista de URLs */}
        <section>
          <h2 className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-4">
            Mis URLs <span className="text-zinc-700 normal-case font-normal">({urls.length})</span>
          </h2>
          {!loading && <UrlList urls={urls} token={token} onDeleted={handleDeleted} />}
        </section>

      </main>
    </div>
  )
}
