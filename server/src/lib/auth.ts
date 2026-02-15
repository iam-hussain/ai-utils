import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { User } from '../models/User'
import { config } from '../config'

export interface AuthPayload {
  userId: string
  email: string
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' })
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as AuthPayload
  } catch {
    return null
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token =
    req.cookies?.token ??
    req.headers.authorization?.replace(/^Bearer\s+/i, '')

  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const payload = verifyToken(token)
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  const user = await User.findById(payload.userId).select('email')
  if (!user) {
    res.status(401).json({ error: 'User not found' })
    return
  }

  ;(req as Request & { user: AuthPayload }).user = payload
  next()
}
