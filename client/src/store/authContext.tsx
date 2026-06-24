import { createContext, useContext, useState, type ReactNode } from 'react'
import type { User } from '../api/auth'

interface AuthContextValue {
  token: string | null
  user: User | null
  saveAuth: (token: string, user: User) => void
  clearAuth: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const TOKEN_KEY = 'snap_token'
const USER_KEY  = 'snap_user'

function readStorage(): { token: string | null; user: User | null } {
  const token = localStorage.getItem(TOKEN_KEY)
  const raw   = localStorage.getItem(USER_KEY)
  const user  = raw ? (JSON.parse(raw) as User) : null
  return { token, user }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStorage().token)
  const [user,  setUser]  = useState<User | null>(() => readStorage().user)

  function saveAuth(newToken: string, newUser: User): void {
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  function clearAuth(): void {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, saveAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

// Helper para adjuntar el token en cualquier fetch autenticado:
// fetch('/dashboard', { headers: authHeader(token) })
export function authHeader(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {}
}
