import { Router, Request, Response } from 'express'
import { AgentRun } from '../models/AgentRun'
import { runAgentWorkflow } from '../services/agent-executor'
import { runCriticOnRun } from '../services/critic-service'
import { requireAuth, getUserId } from '../lib/auth'
import { logger } from '../lib/logger'

const router = Router()
router.use(requireAuth)

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const runs = await AgentRun.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('projectName userGoal status createdAt forkedFromRunId ghostOfRunId')
      .lean()
    res.json(
      runs.map((r) => ({
        id: (r._id as { toString: () => string })?.toString(),
        projectName: r.projectName,
        userGoal: r.userGoal,
        status: r.status,
        createdAt: r.createdAt,
        forkedFromRunId: (r.forkedFromRunId as { toString: () => string } | undefined)?.toString(),
        ghostOfRunId: (r.ghostOfRunId as { toString: () => string } | undefined)?.toString(),
      }))
    )
  } catch (err) {
    logger.error('Failed to list agent runs', { error: err })
    res.status(500).json({ error: 'Failed to list runs' })
  }
})

router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const runs = await AgentRun.find({ userId, status: { $in: ['complete', 'failed'] } })
      .select('steps')
      .lean()
    const byAgent = new Map<
      string,
      { total: number; success: number; costSum: number; durationSum: number }
    >()
    for (const run of runs) {
      for (const step of run.steps ?? []) {
        if (!step.agentId) continue
        const cur = byAgent.get(step.agentId) ?? { total: 0, success: 0, costSum: 0, durationSum: 0 }
        cur.total += 1
        if (step.status === 'complete') cur.success += 1
        cur.costSum += step.costUsd ?? 0
        cur.durationSum += step.durationMs ?? 0
        byAgent.set(step.agentId, cur)
      }
    }
    const analytics = Array.from(byAgent.entries()).map(([agentId, data]) => ({
      agentId,
      totalRuns: data.total,
      successRate: data.total > 0 ? Math.round((data.success / data.total) * 100) : 0,
      avgCostUsd: data.total > 0 ? (data.costSum / data.total).toFixed(4) : '0',
      avgDurationSec: data.total > 0 ? ((data.durationSum / data.total) / 1000).toFixed(1) : '0',
    }))
    res.json(analytics)
  } catch (err) {
    logger.error('Failed to get analytics', { error: err })
    res.status(500).json({ error: 'Failed to get analytics' })
  }
})

router.get('/:id/ghosts', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const ghosts = await AgentRun.find({ ghostOfRunId: req.params.id, userId })
      .sort({ createdAt: -1 })
      .select('projectName status finalOutput error createdAt')
      .lean()
    res.json(
      ghosts.map((g) => ({
        id: (g._id as { toString: () => string })?.toString(),
        projectName: g.projectName,
        status: g.status,
        finalOutput: g.finalOutput,
        error: g.error,
        createdAt: g.createdAt,
      }))
    )
  } catch (err) {
    logger.error('Failed to list ghost runs', { error: err })
    res.status(500).json({ error: 'Failed to list ghosts' })
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const run = await AgentRun.findOne({ _id: req.params.id, userId }).lean()
    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }
    res.json({
      id: (run._id as { toString: () => string })?.toString(),
      projectName: run.projectName,
      userGoal: run.userGoal,
      status: run.status,
      agentDefinitions: run.agentDefinitions,
      steps: run.steps,
      finalOutput: run.finalOutput,
      error: run.error,
      llmProvider: run.llmProvider,
      forkedFromRunId: (run.forkedFromRunId as { toString: () => string } | undefined)?.toString(),
      forkedAtStepIndex: run.forkedAtStepIndex,
      ghostOfRunId: (run.ghostOfRunId as { toString: () => string } | undefined)?.toString(),
      missionBrief: run.missionBrief,
      breakpoints: run.breakpoints,
      pausedAtStepIndex: run.pausedAtStepIndex,
      userHint: run.userHint,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    })
  } catch (err) {
    logger.error('Failed to get agent run', { error: err })
    res.status(500).json({ error: 'Failed to get run' })
  }
})

router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const { userGoal, llmProvider = 'openai' } = req.body ?? {}
    if (!userGoal || typeof userGoal !== 'string' || userGoal.trim().length === 0) {
      res.status(400).json({ error: 'userGoal is required' })
      return
    }
    const run = await AgentRun.create({
      userId,
      projectName: 'Untitled',
      userGoal: userGoal.trim(),
      status: 'designing',
      steps: [],
      llmProvider: ['openai', 'anthropic', 'google'].includes(llmProvider) ? llmProvider : 'openai',
    })
    import('../services/title-generator').then(({ generateTitleFromGoal }) =>
      generateTitleFromGoal(userGoal.trim()).then((title) => {
        if (title && title !== 'Untitled') {
          AgentRun.findByIdAndUpdate(run._id, { projectName: title }).catch(() => { })
        }
      })
    )
    res.status(201).json({
      id: run._id?.toString(),
      projectName: run.projectName,
      userGoal: run.userGoal,
      status: run.status,
      createdAt: run.createdAt,
    })
  } catch (err) {
    logger.error('Failed to create agent run', { error: err })
    res.status(500).json({ error: 'Failed to create run' })
  }
})

router.post('/:id/ghost', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const { agentId, newPrompt } = req.body ?? {}
    const liveRun = await AgentRun.findOne({ _id: req.params.id, userId }).lean()
    if (!liveRun) {
      res.status(404).json({ error: 'Run not found' })
      return
    }
    if (!liveRun.agentDefinitions?.length || !agentId || typeof newPrompt !== 'string') {
      res.status(400).json({ error: 'Run has no agents, or agentId and newPrompt are required' })
      return
    }
    const agents = liveRun.agentDefinitions.map((a) =>
      a.id === agentId ? { ...a, prompt: newPrompt } : a
    )
    const ghost = await AgentRun.create({
      userId,
      projectName: `${liveRun.projectName} (ghost)`,
      userGoal: liveRun.userGoal,
      status: 'designing',
      agentDefinitions: agents,
      steps: liveRun.steps.map((s) => ({ ...s, status: 'pending' as const })),
      llmProvider: liveRun.llmProvider ?? 'openai',
      ghostOfRunId: liveRun._id,
    })
    res.status(201).json({
      id: ghost._id?.toString(),
      projectName: ghost.projectName,
      userGoal: ghost.userGoal,
      status: ghost.status,
      ghostOfRunId: liveRun._id?.toString(),
      createdAt: ghost.createdAt,
    })
  } catch (err) {
    logger.error('Failed to create ghost run', { error: err })
    res.status(500).json({ error: 'Failed to create ghost' })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const run = await AgentRun.findOneAndDelete({ _id: req.params.id, userId })
    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }
    res.json({ ok: true })
  } catch (err) {
    logger.error('Failed to delete run', { error: err })
    res.status(500).json({ error: 'Failed to delete run' })
  }
})

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const { projectName } = req.body ?? {}
    const run = await AgentRun.findOneAndUpdate(
      { _id: req.params.id, userId },
      typeof projectName === 'string' && projectName.trim() ? { $set: { projectName: projectName.trim().slice(0, 120) } } : {},
      { new: true }
    )
    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }
    res.json({ projectName: run.projectName })
  } catch (err) {
    logger.error('Failed to update run', { error: err })
    res.status(500).json({ error: 'Failed to update' })
  }
})

router.post('/:id/generate-title', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const run = await AgentRun.findOne({ _id: req.params.id, userId })
    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }
    const { generateTitleFromGoal } = await import('../services/title-generator')
    const title = await generateTitleFromGoal(run.userGoal)
    run.projectName = title
    await run.save()
    res.json({ projectName: title })
  } catch (err) {
    logger.error('Failed to generate title', { error: err })
    res.status(500).json({ error: 'Failed to generate title' })
  }
})

router.post('/:id/design', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const run = await AgentRun.findOne({ _id: req.params.id, userId })
    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }
    if (run.status !== 'designing') {
      res.status(400).json({ error: 'Run must be in designing status' })
      return
    }
    const llmProvider = (run.llmProvider ?? 'openai') as 'openai' | 'anthropic' | 'google'
    res.json({ ok: true, status: 'draft' })
    runAgentWorkflow({
      runId: run._id!.toString(),
      userId,
      userGoal: run.userGoal,
      llmProvider,
      designOnly: true,
    }).catch((err) => logger.error('Design failed', { error: err, runId: run._id }))
  } catch (err) {
    logger.error('Failed to design', { error: err })
    res.status(500).json({ error: 'Failed to design' })
  }
})

router.patch('/:id/agent-definitions', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const { agentDefinitions } = req.body ?? {}
    if (!Array.isArray(agentDefinitions)) {
      res.status(400).json({ error: 'agentDefinitions array is required' })
      return
    }
    const run = await AgentRun.findOne({ _id: req.params.id, userId })
    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }
    if ((run as { status: string }).status !== 'draft') {
      res.status(400).json({ error: 'Can only edit agent definitions when run is in draft status' })
      return
    }
    const valid = agentDefinitions.filter(
      (a: unknown): a is { id: string; prompt: string } =>
        typeof a === 'object' && a !== null && typeof (a as { id?: unknown }).id === 'string' && typeof (a as { prompt?: unknown }).prompt === 'string'
    )
    run.agentDefinitions = valid.map((a) => {
      const x = a as Record<string, unknown>
      return {
        id: a.id,
        prompt: a.prompt,
        tools: Array.isArray(x.tools) ? (x.tools as string[]) : undefined,
        inputSource: typeof x.inputSource === 'string' ? x.inputSource : undefined,
        nextStep: typeof x.nextStep === 'string' ? x.nextStep : undefined,
        dependencies: Array.isArray(x.dependencies) ? (x.dependencies as string[]) : undefined,
      }
    })
    run.steps = valid.map((a) => ({ agentId: a.id, agentName: a.id, status: 'pending' as const }))
    await run.save()
    res.json({ agentDefinitions: run.agentDefinitions })
  } catch (err) {
    logger.error('Failed to update agent definitions', { error: err })
    res.status(500).json({ error: 'Failed to update' })
  }
})

router.post('/:id/run-critic', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const run = await runCriticOnRun(req.params.id, userId)
    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }
    res.json({
      ok: true,
      steps: run.steps?.map((s) => ({ agentId: s.agentId, criticResult: s.criticResult })),
    })
  } catch (err) {
    logger.error('Failed to run critic', { error: err })
    res.status(500).json({ error: 'Failed to run critic' })
  }
})

router.post('/:id/promote-ghost/:ghostId', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const liveRun = await AgentRun.findOne({ _id: req.params.id, userId })
    const ghostRun = await AgentRun.findOne({ _id: req.params.ghostId, userId }).lean()
    if (!liveRun || !ghostRun || ghostRun.ghostOfRunId?.toString() !== req.params.id) {
      res.status(404).json({ error: 'Run not found or ghost does not belong to this run' })
      return
    }
    if (!ghostRun.agentDefinitions?.length) {
      res.status(400).json({ error: 'Ghost run has no agent definitions' })
      return
    }
    liveRun.agentDefinitions = ghostRun.agentDefinitions
    await liveRun.save()
    res.json({ ok: true, message: 'Ghost promoted to live' })
  } catch (err) {
    logger.error('Failed to promote ghost', { error: err })
    res.status(500).json({ error: 'Failed to promote' })
  }
})

router.post('/:id/fork', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const { stepIndex, editedAgentId, editedPrompt } = req.body ?? {}
    const parentRun = await AgentRun.findOne({ _id: req.params.id, userId }).lean()
    if (!parentRun) {
      res.status(404).json({ error: 'Run not found' })
      return
    }
    if (!parentRun.agentDefinitions?.length || !parentRun.steps?.length) {
      res.status(400).json({ error: 'Run has no agents or steps to fork' })
      return
    }
    const idx = typeof stepIndex === 'number' ? Math.max(0, Math.min(stepIndex, parentRun.steps.length - 1)) : 0
    const agents = parentRun.agentDefinitions.map((a) => ({
      ...a,
      prompt: editedAgentId === a.id && typeof editedPrompt === 'string' ? editedPrompt : a.prompt,
    }))
    const steps = parentRun.steps.map((s, i) =>
      i < idx ? { ...s, agentId: s.agentId, agentName: s.agentName ?? s.agentId, status: 'complete' as const } : { agentId: s.agentId, agentName: s.agentName ?? s.agentId, status: 'pending' as const }
    )
    const forked = await AgentRun.create({
      userId,
      projectName: `${parentRun.projectName} (fork)`,
      userGoal: parentRun.userGoal,
      status: 'designing',
      agentDefinitions: agents,
      steps,
      llmProvider: parentRun.llmProvider ?? 'openai',
      forkedFromRunId: parentRun._id,
      forkedAtStepIndex: idx,
    })
    res.status(201).json({
      id: forked._id?.toString(),
      projectName: forked.projectName,
      userGoal: forked.userGoal,
      status: forked.status,
      forkedFromRunId: parentRun._id?.toString(),
      forkedAtStepIndex: idx,
      createdAt: forked.createdAt,
    })
  } catch (err) {
    logger.error('Failed to fork agent run', { error: err })
    res.status(500).json({ error: 'Failed to fork run' })
  }
})

router.post('/:id/resume', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const { userHint } = req.body ?? {}
    const run = await AgentRun.findOne({ _id: req.params.id, userId })
    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }
    if (run.status !== 'paused') {
      res.status(400).json({ error: 'Run is not paused' })
      return
    }
    const llmProvider = (run.llmProvider ?? 'openai') as 'openai' | 'anthropic' | 'google'
    res.json({ ok: true, status: 'running' })
    runAgentWorkflow({
      runId: run._id!.toString(),
      userId,
      userGoal: run.userGoal,
      llmProvider,
      forkedFromRunId: run.forkedFromRunId?.toString() ?? run.ghostOfRunId?.toString() ?? run._id?.toString(),
      forkedAtStepIndex: run.forkedAtStepIndex ?? run.pausedAtStepIndex ?? (run.ghostOfRunId ? 0 : undefined),
      resumeFromPaused: true,
      userHint: typeof userHint === 'string' ? userHint : undefined,
    }).catch((err) => logger.error('Agent run resume failed', { error: err, runId: run._id }))
  } catch (err) {
    logger.error('Failed to resume agent run', { error: err })
    res.status(500).json({ error: 'Failed to resume' })
  }
})

router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const run = await AgentRun.findOne({ _id: req.params.id, userId })
    if (!run) {
      res.status(404).json({ error: 'Run not found' })
      return
    }
    if (run.status === 'running') {
      res.status(400).json({ error: 'Run already in progress' })
      return
    }
    if ((run as { status: string }).status === 'paused') {
      res.status(400).json({ error: 'Use POST /:id/resume to resume a paused run' })
      return
    }
    const llmProvider = (req.body?.llmProvider ?? run.llmProvider) as 'openai' | 'anthropic' | 'google'
    const { editedAgentId, editedPrompt } = req.body ?? {}
    res.json({ ok: true, status: 'running' })
    const forkId = run.forkedFromRunId?.toString() ?? run.ghostOfRunId?.toString()
    const forkStep = run.forkedAtStepIndex ?? (run.ghostOfRunId ? 0 : undefined)
    const breakpoints = req.body?.breakpoints
    if (Array.isArray(breakpoints)) {
      run.breakpoints = breakpoints
      await run.save()
    }
    runAgentWorkflow({
      runId: run._id!.toString(),
      userId,
      userGoal: run.userGoal,
      llmProvider: ['openai', 'anthropic', 'google'].includes(llmProvider) ? llmProvider : 'openai',
      forkedFromRunId: forkId ?? run._id?.toString(),
      forkedAtStepIndex: forkStep ?? run.pausedAtStepIndex,
      editedAgentId: typeof editedAgentId === 'string' ? editedAgentId : undefined,
      editedPrompt: typeof editedPrompt === 'string' ? editedPrompt : undefined,
      resumeFromPaused: false,
      userHint: typeof req.body?.userHint === 'string' ? req.body.userHint : undefined,
    }).catch((err) => logger.error('Agent run failed', { error: err, runId: run._id }))
  } catch (err) {
    logger.error('Failed to execute agent run', { error: err })
    res.status(500).json({ error: 'Failed to execute' })
  }
})

export default router
