import { Router, Request, Response, RequestHandler } from 'express'
import type { Client } from '@libsql/client'
import { getDb } from '../../db/index.js'
import { authenticate } from '../../middleware/authenticate.js'
import { getDashboardSummary } from './dashboard.service.js'

export function makeDashboardRouter(
  db: Client = getDb(),
  auth: RequestHandler = authenticate,
): Router {
  const router = Router()

  router.get('/dashboard', auth, async (req: Request, res: Response) => {
    const summary = await getDashboardSummary(req.user!.id, db)
    res.json(summary)
  })

  return router
}
