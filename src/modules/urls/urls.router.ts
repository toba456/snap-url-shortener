import { Router, Request, Response, RequestHandler } from 'express'
import type { Client } from '@libsql/client'
import { getDb } from '../../db/index.js'
import { authenticate } from '../../middleware/authenticate.js'
import { createUrl, deleteUrl, findBySlug, listUrls, recordClick } from './urls.service.js'

export function makeUrlsRouter(
  db: Client = getDb(),
  auth: RequestHandler = authenticate,
): Router {
  const router = Router()

  router.post('/urls', auth, async (req: Request, res: Response) => {
    const { url, slug } = req.body as { url?: string; slug?: string }

    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'El campo url es obligatorio' })
      return
    }
    try {
      new URL(url)
    } catch {
      res.status(400).json({ error: 'URL no válida' })
      return
    }

    try {
      const created = await createUrl({ original_url: url, slug, user_id: req.user!.id }, db)
      res.status(201).json(created)
    } catch (err) {
      if (err instanceof Error && err.message.includes('UNIQUE constraint failed: urls.slug')) {
        res.status(409).json({ error: 'El slug ya está en uso, elige otro' })
        return
      }
      throw err
    }
  })

  router.delete('/urls/:slug', auth, async (req: Request, res: Response) => {
    try {
      await deleteUrl(req.params.slug, req.user!.id, db)
      res.status(204).send()
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'URL no encontrada') {
          res.status(404).json({ error: err.message })
          return
        }
        if (err.message === 'No tienes permiso para eliminar esta URL') {
          res.status(403).json({ error: err.message })
          return
        }
      }
      throw err
    }
  })

  router.get('/urls', async (_req: Request, res: Response) => {
    res.json(await listUrls(db))
  })

  router.get('/:slug', async (req: Request, res: Response) => {
    const record = await findBySlug(req.params.slug, db)
    if (!record) {
      res.status(404).json({ error: 'Código no encontrado' })
      return
    }
    await recordClick(record.id as number, db)
    res.redirect(302, record.original_url as string)
  })

  return router
}
