import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { User } from '../models/User'
import { signToken } from '../lib/auth'
import { logger } from '../lib/logger'
import { config } from '../config'

const router = Router()

const registerSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
})

router.post('/register', async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }
    const { email, password } = parsed.data

    const existing = await User.findOne({ email })
    if (existing) {
      res.status(400).json({ error: 'Email already registered' })
      return
    }

    const user = await User.create({ email, password })
    const token = signToken({ userId: user._id.toString(), email: user.email })

    res.cookie('token', token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    res.status(201).json({ user: { id: user._id, email: user.email, name: user.name ?? '' } })
  } catch (err) {
    logger.error('Auth register error', { error: err })
    res.status(500).json({ error: 'Registration failed' })
  }
})

router.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }
    const { email, password } = parsed.data

    const user = await User.findOne({ email }).select('+password')
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const token = signToken({ userId: user._id.toString(), email: user.email })

    res.cookie('token', token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    res.json({ user: { id: user._id, email: user.email, name: user.name ?? '' } })
  } catch (err) {
    logger.error('Auth login error', { error: err })
    res.status(500).json({ error: 'Login failed' })
  }
})

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token')
  res.json({ ok: true })
})

router.get('/me', async (req: Request, res: Response) => {
  const token = req.cookies?.token ?? req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  const { verifyToken } = await import('../lib/auth')
  const payload = verifyToken(token)
  if (!payload) {
    res.status(401).json({ error: 'Invalid token' })
    return
  }
  const user = await User.findById(payload.userId).select('email name')
  if (!user) {
    res.status(401).json({ error: 'User not found' })
    return
  }
  res.json({ user: { id: user._id, email: user.email, name: user.name ?? '' } })
})

const updateProfileSchema = z.object({
  name: z.string().max(100).trim().optional(),
})

router.patch('/profile', async (req: Request, res: Response) => {
  const token = req.cookies?.token ?? req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  const { verifyToken } = await import('../lib/auth')
  const payload = verifyToken(token)
  if (!payload) {
    res.status(401).json({ error: 'Invalid token' })
    return
  }
  const parsed = updateProfileSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  try {
    const user = await User.findByIdAndUpdate(
      payload.userId,
      { $set: parsed.data },
      { new: true }
    ).select('email name')
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json({ user: { id: user._id, email: user.email, name: user.name ?? '' } })
  } catch (err) {
    logger.error('Auth update profile error', { error: err })
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
})

router.post('/change-password', async (req: Request, res: Response) => {
  const token = req.cookies?.token ?? req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  const { verifyToken } = await import('../lib/auth')
  const payload = verifyToken(token)
  if (!payload) {
    res.status(401).json({ error: 'Invalid token' })
    return
  }
  const parsed = changePasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }
  try {
    const user = await User.findById(payload.userId).select('+password')
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    const valid = await user.comparePassword(parsed.data.currentPassword)
    if (!valid) {
      res.status(400).json({ error: 'Current password is incorrect' })
      return
    }
    user.password = parsed.data.newPassword
    await user.save()
    res.json({ ok: true })
  } catch (err) {
    logger.error('Auth change password error', { error: err })
    res.status(500).json({ error: 'Failed to change password' })
  }
})

export default router
