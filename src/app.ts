import express from 'express'
import { errorHandler, notFoundHandler } from './middleware/error-handlers.js'
import { requestLogger } from './middleware/request-logger.js'
import { makeAuthRouter } from './modules/auth/auth.router.js'
import { makeDashboardRouter } from './modules/dashboard/dashboard.router.js'
import { makeUrlsRouter } from './modules/urls/urls.router.js'

const app = express()

app.use(requestLogger)
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use(makeAuthRouter())
app.use(makeDashboardRouter())
app.use(makeUrlsRouter())

app.use(notFoundHandler)
app.use(errorHandler)

export default app
