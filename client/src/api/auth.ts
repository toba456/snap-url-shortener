export interface User {
  id: number
  email: string
  name: string
  created_at: string
}

export interface AuthResponse {
  token: string
  user: User
}

const API = ''  // rutas relativas: el proxy de Vite las redirige a localhost:3000

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Error inesperado')
  return data as T
}

export function register(email: string, password: string, name: string): Promise<AuthResponse> {
  return post<AuthResponse>('/auth/register', { email, password, name })
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return post<AuthResponse>('/auth/login', { email, password })
}
