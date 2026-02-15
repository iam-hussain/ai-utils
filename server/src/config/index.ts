import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '../../../.env') })

export const config = {
  port: Number(process.env.PORT) || 3000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-utils',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  isProduction: process.env.NODE_ENV === 'production',
} as const
