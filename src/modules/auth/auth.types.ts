export interface User {
  id: number
  email: string
  password_hash: string
  name: string
  created_at: string
}

export interface UserPublic {
  id: number
  email: string
  name: string
  created_at: string
}

export interface RegisterDto {
  email: string
  password: string
  name: string
}

export interface LoginDto {
  email: string
  password: string
}

export interface AuthResult {
  token: string
  user: UserPublic
}
