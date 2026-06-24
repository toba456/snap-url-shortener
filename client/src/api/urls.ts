export interface Url {
  id: number
  slug: string
  original_url: string
  created_at: string
  expires_at: string | null
  user_id: number | null
}

export interface CreateUrlDto {
  url: string
  slug?: string
  expires_at?: string
}

export async function getUrls(): Promise<Url[]> {
  const res = await fetch('/urls')
  if (!res.ok) throw new Error('Error al cargar URLs')
  return res.json() as Promise<Url[]>
}

export async function createUrl(token: string, dto: CreateUrlDto): Promise<Url> {
  const res = await fetch('/urls', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(dto),
  })
  const data = await res.json()
  if (!res.ok) throw new Error((data as { error: string }).error ?? 'Error al crear URL')
  return data as Url
}

export async function deleteUrl(token: string, slug: string): Promise<void> {
  const res = await fetch(`/urls/${slug}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error((data as { error: string }).error ?? 'Error al eliminar URL')
  }
}
