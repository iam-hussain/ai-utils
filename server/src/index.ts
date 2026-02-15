import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import mongoose from 'mongoose'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import path from 'path'

import { config } from './config'
import { logger } from './lib/logger'
import setupChatSockets from './sockets/chat'
import authRouter from './routes/auth'
import mcpRouter from './routes/mcp'
import chatsRouter from './routes/chats'
import userDataRouter from './routes/user-data'
import teamsRouter from './routes/teams'
import invitesRouter from './routes/invites'
import agentRunsRouter from './routes/agent-runs'

const corsOrigin =
  config.corsOrigins.length === 1 && config.corsOrigins[0] === '*'
    ? '*'
    : config.corsOrigins

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
})

app.use(
  cors({
    origin: corsOrigin === '*' ? true : config.corsOrigins,
    credentials: true,
  })
)
app.use(cookieParser())
app.use(express.json())

app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Too many requests' },
  })
)

mongoose
  .connect(config.mongodbUri)
  .then(() => logger.info('Connected to MongoDB'))
  .catch((err) => logger.error('MongoDB connection error', { error: err }))

setupChatSockets(io)

app.get('/api/health', async (_req, res) => {
  try {
    const mongoOk = mongoose.connection.readyState === 1
    res.json({
      status: mongoOk ? 'ok' : 'degraded',
      message: 'Server is running',
      mongo: mongoOk ? 'connected' : 'disconnected',
    })
  } catch {
    res.json({ status: 'degraded', message: 'Server is running', mongo: 'error' })
  }
})

app.use('/api/auth', authRouter)
app.use('/api/mcp', mcpRouter)
app.use('/api/chats', chatsRouter)
app.use('/api/user-data', userDataRouter)
app.use('/api/teams', teamsRouter)
app.use('/api/invites', invitesRouter)
app.use('/api/agent-runs', agentRunsRouter)

if (config.isProduction) {
  app.use(express.static(path.join(__dirname, '../../client/dist')))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'))
  })
}

httpServer.listen(config.port, () => {
  logger.info('Server running', {
    port: config.port,
    url: `http://localhost:${config.port}`,
  })
})
