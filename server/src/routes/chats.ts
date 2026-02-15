import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Chat } from '../models/Chat'
import { requireAuth } from '../lib/auth'
import { logger } from '../lib/logger'

const router = Router()
router.use(requireAuth)

const createChatSchema = z.object({
  id: z.string().min(1),
  title: z.string().default('New Chat'),
  messages: z.array(z.object({
    id: z.string(),
    content: z.string(),
    type: z.enum(['human', 'system', 'ai']),
    timestamp: z.string(),
    audioData: z.string().optional(),
  })).default([]),
  createdAt: z.number().default(() => Date.now()),
  updatedAt: z.number().default(() => Date.now()),
})

const updateChatSchema = z.object({
  title: z.string().optional(),
  messages: z.array(z.object({
    id: z.string(),
    content: z.string(),
    type: z.enum(['human', 'system', 'ai']),
    timestamp: z.string(),
    audioData: z.string().optional(),
  })).optional(),
  updatedAt: z.number(),
})

router.delete('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const result = await Chat.deleteMany({ userId })
    res.status(200).json({ deletedCount: result.deletedCount })
  } catch (err) {
    logger.error('Failed to delete all chats', { error: err })
    res.status(500).json({ error: 'Failed to delete chats' })
  }
})

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const chats = await Chat.find({ userId }).sort({ updatedAt: -1 }).lean()
    res.json(chats)
  } catch (err) {
    logger.error('Failed to list chats', { error: err })
    res.status(500).json({ error: 'Failed to list chats' })
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const chat = await Chat.findOne({ id: req.params.id, userId }).lean()
    if (!chat) {
      res.status(404).json({ error: 'Chat not found' })
      return
    }
    res.json(chat)
  } catch (err) {
    logger.error('Failed to get chat', { error: err, chatId: req.params.id })
    res.status(500).json({ error: 'Failed to get chat' })
  }
})

router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const parsed = createChatSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
      return
    }
    const chat = new Chat({ ...parsed.data, userId })
    await chat.save()
    res.status(201).json(chat.toObject())
  } catch (err) {
    logger.error('Failed to create chat', { error: err })
    res.status(500).json({ error: 'Failed to create chat' })
  }
})

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const parsed = createChatSchema.safeParse({ ...req.body, id: req.params.id })
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
      return
    }
    const chat = await Chat.findOneAndUpdate(
      { id: req.params.id, userId },
      { $set: { ...parsed.data, userId } },
      { new: true, upsert: true }
    ).lean()
    res.json(chat)
  } catch (err) {
    logger.error('Failed to upsert chat', { error: err, chatId: req.params.id })
    res.status(500).json({ error: 'Failed to upsert chat' })
  }
})

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const parsed = updateChatSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
      return
    }
    const chat = await Chat.findOneAndUpdate(
      { id: req.params.id, userId },
      { $set: parsed.data },
      { new: true }
    ).lean()
    if (!chat) {
      res.status(404).json({ error: 'Chat not found' })
      return
    }
    res.json(chat)
  } catch (err) {
    logger.error('Failed to update chat', { error: err, chatId: req.params.id })
    res.status(500).json({ error: 'Failed to update chat' })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const result = await Chat.deleteOne({ id: req.params.id, userId })
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Chat not found' })
      return
    }
    res.status(204).send()
  } catch (err) {
    logger.error('Failed to delete chat', { error: err, chatId: req.params.id })
    res.status(500).json({ error: 'Failed to delete chat' })
  }
})

export default router
