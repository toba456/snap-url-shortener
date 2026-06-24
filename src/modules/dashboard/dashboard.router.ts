import { Router, Request, Response, RequestHandler } from 'express'
import Database from 'better-sqlite3'
import { getDb } from '../../db/index.js'
import { authenticate } from '../../middleware/authenticate.js'
import { getDashboardSummary } from './dashboard.service.js'

export function makeDashboardRouter(
  db: Database.Database = getDb(),
  auth: RequestHandler = authenticate,
): Router {
  const router = Router()

  router.get('/dashboard', auth, (req: Request, res: Response) => {
    const summary = getDashboardSummary(req.user!.id, db)
    res.json(summary)
  })

  return router
}
