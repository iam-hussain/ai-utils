import { Router, Request, Response } from 'express'
import { UserData } from '../models/UserData'
import { requireAuth } from '../lib/auth'
import { logger } from '../lib/logger'
import { putUserDataSchema } from '../lib/schemas/user-data-schemas'

const router = Router()

const DEFAULT_USER_DATA = {
  skills: [],
  promptLibrary: [],
  mcpServers: {},
  mcpSelection: null,
  skillSelection: [],
  savedPromptSets: [],
  savedPromptSetCategories: [],
  llmProvider: 'openai',
} as const

function migrateToCategories(doc: { savedPromptSetCategories?: unknown[]; savedPromptSets?: unknown[] }) {
  const categories = doc.savedPromptSetCategories ?? []
  const flatSets = doc.savedPromptSets ?? []
  if (Array.isArray(categories) && categories.length > 0) {
    return categories
  }
  if (Array.isArray(flatSets) && flatSets.length > 0) {
    return [{
      id: `cat-${Date.now()}`,
      name: 'General',
      sets: flatSets,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }]
  }
  return []
}

router.use(requireAuth)

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const doc = await UserData.findOne({ userId }).lean()
    if (!doc) {
      res.json(DEFAULT_USER_DATA)
      return
    }
    const categories = migrateToCategories(doc)
    res.json({
      skills: doc.skills ?? [],
      promptLibrary: doc.promptLibrary ?? [],
      mcpServers: doc.mcpServers ?? {},
      mcpSelection: doc.mcpSelection ?? null,
      skillSelection: doc.skillSelection ?? [],
      savedPromptSets: doc.savedPromptSets ?? [],
      savedPromptSetCategories: categories,
      llmProvider: doc.llmProvider ?? 'openai',
    })
  } catch (err) {
    logger.error('Failed to get user data', { error: err })
    res.status(500).json({ error: 'Failed to get user data' })
  }
})

router.put('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const parsed = putUserDataSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
      return
    }
    const doc = await UserData.findOneAndUpdate(
      { userId },
      {
        $set: {
          skills: parsed.data.skills,
          promptLibrary: parsed.data.promptLibrary,
          mcpServers: parsed.data.mcpServers,
          mcpSelection: parsed.data.mcpSelection,
          skillSelection: parsed.data.skillSelection,
          savedPromptSets: parsed.data.savedPromptSets,
          savedPromptSetCategories: parsed.data.savedPromptSetCategories ?? [],
          ...(parsed.data.llmProvider != null && { llmProvider: parsed.data.llmProvider }),
        },
      },
      { new: true, upsert: true }
    ).lean()
    res.json({
      skills: doc!.skills ?? [],
      promptLibrary: doc!.promptLibrary ?? [],
      mcpServers: doc!.mcpServers ?? {},
      mcpSelection: doc!.mcpSelection ?? null,
      skillSelection: doc!.skillSelection ?? [],
      savedPromptSets: doc!.savedPromptSets ?? [],
      savedPromptSetCategories: doc!.savedPromptSetCategories ?? [],
      llmProvider: doc!.llmProvider ?? 'openai',
    })
  } catch (err) {
    logger.error('Failed to save user data', { error: err })
    res.status(500).json({ error: 'Failed to save user data' })
  }
})

export default router
