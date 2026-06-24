export interface Url {
  id: number
  slug: string
  original_url: string
  created_at: string
  expires_at: string | null
  user_id: number | null
}

export interface CreateUrlDto {
  original_url: string
  slug?: string
  expires_at?: string
  user_id?: number
}
