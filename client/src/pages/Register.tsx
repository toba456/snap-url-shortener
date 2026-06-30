import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import { useAuth } from '../store/authContext'

export default function Register() {
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  const { saveAuth } = useAuth()
  const navigate     = useNavigate()

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { token, user } = await register(email, password, name)
      saveAuth(token, user)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-forest-dark flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Brand mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-forest/10 border border-forest/20 mb-4">
            <span className="text-xl font-bold text-forest">S</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-cream">
            Crea tu cuenta en <span className="text-forest">Snap</span>
          </h1>
          <p className="text-sm text-sage mt-1">Empieza a acortar URLs en segundos</p>
        </div>

        {/* Form card */}
        <div className="bg-forest/12 rounded-2xl border border-sage/20 p-8 shadow-2xl shadow-black/40">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-cream/70 mb-1.5">
                Nombre
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                placeholder="Tu nombre"
                className="w-full bg-forest-dark border border-sage/30 rounded-xl px-4 py-2.5 text-sm text-cream placeholder:text-sage/50 focus:outline-none focus:ring-2 focus:ring-forest/40 focus:border-forest transition-all duration-200"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-cream/70 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="tu@email.com"
                className="w-full bg-forest-dark border border-sage/30 rounded-xl px-4 py-2.5 text-sm text-cream placeholder:text-sage/50 focus:outline-none focus:ring-2 focus:ring-forest/40 focus:border-forest transition-all duration-200"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-cream/70 mb-1.5">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full bg-forest-dark border border-sage/30 rounded-xl px-4 py-2.5 text-sm text-cream placeholder:text-sage/50 focus:outline-none focus:ring-2 focus:ring-forest/40 focus:border-forest transition-all duration-200"
              />
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <span className="shrink-0">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-forest hover:bg-forest/85 active:bg-forest-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl py-2.5 transition-all duration-200 shadow-lg shadow-forest/25 mt-1"
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-sage mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link
            to="/login"
            className="text-forest hover:text-mist font-medium transition-colors duration-200"
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  )
}
