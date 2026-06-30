import app from '../src/app'
import { getDb } from '../src/db/index'
import { initDb } from '../src/db/schema'

initDb(getDb()).catch(console.error)

export default app
