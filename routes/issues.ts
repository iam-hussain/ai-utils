import { Router, Request, Response } from 'express'
import { Team } from '../models/Team'
import { Project } from '../models/Project'
import { Issue } from '../models/Issue'
import { IssueComment } from '../models/IssueComment'
import { requireAuth, getUserId } from '../lib/auth'
import { teamQueryForUser } from '../lib/access'
import { logger } from '../lib/logger'
import {
  createIssueSchema,
  updateIssueSchema,
  createCommentSchema,
} from '../lib/schemas/issue-schemas'

const router = Router()

type TeamDoc = {
  ownerId?: { toString: () => string }
  memberIds?: unknown[]
  members?: { userId: { toString: () => string } }[]
}

function isTeamMember(team: TeamDoc, userId: string): boolean {
  const owner = team.ownerId?.toString()
  const memberIds = (team.memberIds ?? []).map((id: unknown) => (id as { toString: () => string })?.toString())
  const memberUserIds = (team.members ?? []).map((m) => m.userId?.toString())
  const all = [...new Set([owner, ...memberIds, ...memberUserIds].filter(Boolean))]
  return all.includes(userId)
}

/** Extract user id from populated ref (doc with _id) or raw ObjectId */
function refToId(ref: unknown): string | null {
  if (!ref) return null
  const r = ref as { _id?: { toString: () => string }; toString?: () => string }
  if (r._id && typeof r._id === 'object') return r._id.toString()
  return r.toString?.() ?? null
}

router.use(requireAuth)

// --- Issues ---
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const teamId = req.query.teamId as string | undefined
    const projectId = req.query.projectId as string | undefined
    const status = req.query.status as string | undefined
    const assigneeId = req.query.assigneeId as string | undefined

    const teams = await Team.find(teamQueryForUser(userId))
      .select('_id')
      .lean()
    const teamObjectIds = teams.map((t) => t._id).filter(Boolean)

    const filter: Record<string, unknown> = { teamId: { $in: teamObjectIds } }
    if (teamId) filter.teamId = teamId
    if (projectId) filter.projectId = projectId
    if (status) filter.status = status
    if (assigneeId) filter.assigneeId = assigneeId

    const issues = await Issue.find(filter)
      .populate('reporterId', 'name email')
      .populate('assigneeId', 'name email')
      .sort({ updatedAt: -1 })
      .lean()

    const userMap = new Map<string, { name?: string; email?: string }>()
    const addUser = (u: { _id?: unknown; name?: string; email?: string }) => {
      const id = refToId(u)
      if (id) userMap.set(id, { name: u?.name, email: u?.email })
    }
    issues.forEach((i) => {
      const r = i.reporterId as { _id?: unknown; name?: string; email?: string }
      const a = i.assigneeId as { _id?: unknown; name?: string; email?: string } | null
      if (r) addUser(r)
      if (a) addUser(a)
    })

    res.json(
      issues.map((i) => ({
        id: (i._id as { toString: () => string })?.toString(),
        title: i.title,
        description: i.description,
        promptSteps: i.promptSteps ?? [],
        nextPromptList: i.nextPromptList ?? [],
        links: i.links ?? [],
        screenshots: (i.screenshots ?? []).map((s) => ({ caption: s.caption, mimeType: s.mimeType })),
        teamId: (i.teamId as { toString: () => string })?.toString(),
        projectId: i.projectId ? (i.projectId as { toString: () => string }).toString() : null,
        reporterId: refToId(i.reporterId) ?? '',
        assigneeId: refToId(i.assigneeId),
        reporterName: userMap.get(refToId(i.reporterId) ?? '')?.name,
        assigneeName: i.assigneeId ? userMap.get(refToId(i.assigneeId) ?? '')?.name : null,
        status: i.status,
        jiraTicketId: i.jiraTicketId ?? null,
        tags: i.tags ?? [],
        environment: i.environment ?? null,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      }))
    )
  } catch (err) {
    logger.error('Failed to list issues', { error: err })
    res.status(500).json({ error: 'Failed to list issues' })
  }
})

router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const parsed = createIssueSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
      return
    }
    const team = await Team.findById(parsed.data.teamId).lean()
    if (!team || !isTeamMember(team, userId)) {
      res.status(403).json({ error: 'Not a member of this team' })
      return
    }
    if (parsed.data.projectId) {
      const project = await Project.findById(parsed.data.projectId).lean()
      const teamIds = (project?.teamIds ?? []).map((id: unknown) => (id as { toString: () => string })?.toString())
      if (!project || !teamIds.includes(parsed.data.teamId)) {
        res.status(400).json({ error: 'Project not found or team not in project' })
        return
      }
    }
    const issue = await Issue.create({
      ...parsed.data,
      reporterId: userId,
      projectId: parsed.data.projectId || undefined,
      environment: parsed.data.environment || undefined,
    })
    const populated = await Issue.findById(issue._id)
      .populate('reporterId', 'name email')
      .populate('assigneeId', 'name email')
      .lean()
    const r = populated?.reporterId as { _id?: unknown; name?: string }
    const a = populated?.assigneeId as { _id?: unknown; name?: string } | null
    res.status(201).json({
      id: issue._id?.toString(),
      title: issue.title,
      description: issue.description,
      promptSteps: issue.promptSteps,
      nextPromptList: issue.nextPromptList,
      links: issue.links,
      screenshots: issue.screenshots,
      teamId: (issue.teamId as { toString: () => string })?.toString(),
      projectId: issue.projectId ? (issue.projectId as { toString: () => string }).toString() : null,
      reporterId: userId,
      assigneeId: issue.assigneeId ? (issue.assigneeId as { toString: () => string }).toString() : null,
      reporterName: r?.name,
      assigneeName: a?.name ?? null,
      status: issue.status,
      jiraTicketId: issue.jiraTicketId ?? null,
      tags: issue.tags,
      environment: issue.environment ?? null,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    })
  } catch (err) {
    logger.error('Failed to create issue', { error: err })
    res.status(500).json({ error: 'Failed to create issue' })
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const issue = await Issue.findById(req.params.id)
      .populate('reporterId', 'name email')
      .populate('assigneeId', 'name email')
      .lean()
    if (!issue) {
      res.status(404).json({ error: 'Issue not found' })
      return
    }
    const team = await Team.findById(issue.teamId).lean()
    if (!team || !isTeamMember(team, userId)) {
      res.status(403).json({ error: 'Not a member of this team' })
      return
    }
    const r = issue.reporterId as { _id?: unknown; name?: string; email?: string }
    const a = issue.assigneeId as { _id?: unknown; name?: string; email?: string } | null
    res.json({
      id: (issue._id as { toString: () => string })?.toString(),
      title: issue.title,
      description: issue.description,
      promptSteps: issue.promptSteps ?? [],
      nextPromptList: issue.nextPromptList ?? [],
      links: issue.links ?? [],
      screenshots: issue.screenshots ?? [],
      teamId: (issue.teamId as { toString: () => string })?.toString(),
      projectId: issue.projectId ? (issue.projectId as { toString: () => string }).toString() : null,
      reporterId: refToId(issue.reporterId) ?? '',
      assigneeId: refToId(issue.assigneeId),
      reporterName: r?.name ?? r?.email,
      assigneeName: a?.name ?? a?.email ?? null,
      status: issue.status,
      jiraTicketId: issue.jiraTicketId ?? null,
      tags: issue.tags ?? [],
      environment: issue.environment ?? null,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    })
  } catch (err) {
    logger.error('Failed to get issue', { error: err })
    res.status(500).json({ error: 'Failed to get issue' })
  }
})

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const issue = await Issue.findById(req.params.id)
    if (!issue) {
      res.status(404).json({ error: 'Issue not found' })
      return
    }
    const team = await Team.findById(issue.teamId).lean()
    if (!team || !isTeamMember(team, userId)) {
      res.status(403).json({ error: 'Not a member of this team' })
      return
    }
    const assigneeId = issue.assigneeId?.toString()
    const reporterId = (issue.reporterId as { toString: () => string })?.toString()
    const canChange = assigneeId
      ? assigneeId === userId
      : reporterId === userId
    if (!canChange) {
      res.status(403).json({ error: 'Only the assigned person can change this issue' })
      return
    }
    const parsed = updateIssueSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
      return
    }
    const updates = parsed.data as Record<string, unknown>
    if (updates.projectId === null) updates.projectId = undefined
    if (updates.assigneeId === null) updates.assigneeId = undefined
    if (updates.environment === null) updates.environment = undefined
    if (updates.jiraTicketId === null) updates.jiraTicketId = undefined
    if (updates.assigneeId) {
      const memberIds = [
        (team.ownerId as { toString: () => string })?.toString(),
        ...(team.memberIds ?? []).map((id: unknown) => (id as { toString: () => string })?.toString()),
      ]
      if (!memberIds.includes(updates.assigneeId as string)) {
        res.status(400).json({ error: 'Assignee must be a team member' })
        return
      }
    }
    Object.assign(issue, updates)
    await issue.save()
    const populated = await Issue.findById(issue._id)
      .populate('reporterId', 'name email')
      .populate('assigneeId', 'name email')
      .lean()
    const r = populated?.reporterId as { _id?: unknown; name?: string }
    const a = populated?.assigneeId as { _id?: unknown; name?: string } | null
    res.json({
      id: (issue._id as { toString: () => string })?.toString(),
      title: issue.title,
      description: issue.description,
      promptSteps: issue.promptSteps,
      nextPromptList: issue.nextPromptList,
      links: issue.links,
      screenshots: issue.screenshots,
      teamId: (issue.teamId as { toString: () => string })?.toString(),
      projectId: issue.projectId ? (issue.projectId as { toString: () => string }).toString() : null,
      reporterId: refToId(issue.reporterId) ?? '',
      assigneeId: refToId(issue.assigneeId),
      reporterName: r?.name,
      assigneeName: a?.name ?? null,
      status: issue.status,
      jiraTicketId: issue.jiraTicketId ?? null,
      tags: issue.tags,
      environment: issue.environment ?? null,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    })
  } catch (err) {
    logger.error('Failed to update issue', { error: err })
    res.status(500).json({ error: 'Failed to update issue' })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const issue = await Issue.findById(req.params.id)
    if (!issue) {
      res.status(404).json({ error: 'Issue not found' })
      return
    }
    const team = await Team.findById(issue.teamId).lean()
    if (!team || !isTeamMember(team, userId)) {
      res.status(403).json({ error: 'Not a member of this team' })
      return
    }
    const assigneeId = issue.assigneeId?.toString()
    const reporterId = (issue.reporterId as { toString: () => string })?.toString()
    const canDelete = reporterId === userId || (assigneeId != null && assigneeId === userId)
    if (!canDelete) {
      res.status(403).json({ error: 'Only the creator or assignee can delete this issue' })
      return
    }
    await IssueComment.deleteMany({ issueId: issue._id })
    await Issue.deleteOne({ _id: issue._id })
    res.status(204).send()
  } catch (err) {
    logger.error('Failed to delete issue', { error: err })
    res.status(500).json({ error: 'Failed to delete issue' })
  }
})

// --- Comments ---
router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const issue = await Issue.findById(req.params.id).lean()
    if (!issue) {
      res.status(404).json({ error: 'Issue not found' })
      return
    }
    const team = await Team.findById(issue.teamId).lean()
    if (!team || !isTeamMember(team, userId)) {
      res.status(403).json({ error: 'Not a member of this team' })
      return
    }
    const comments = await IssueComment.find({ issueId: req.params.id })
      .populate('authorId', 'name email')
      .sort({ createdAt: 1 })
      .lean()
    res.json(
      comments.map((c) => {
        const a = c.authorId as { _id?: unknown; name?: string; email?: string }
        return {
          id: (c._id as { toString: () => string })?.toString(),
          content: c.content,
          authorId: (c.authorId as { toString: () => string })?.toString(),
          authorName: a?.name ?? a?.email,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }
      })
    )
  } catch (err) {
    logger.error('Failed to list comments', { error: err })
    res.status(500).json({ error: 'Failed to list comments' })
  }
})

router.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const issue = await Issue.findById(req.params.id)
    if (!issue) {
      res.status(404).json({ error: 'Issue not found' })
      return
    }
    const team = await Team.findById(issue.teamId).lean()
    if (!team || !isTeamMember(team, userId)) {
      res.status(403).json({ error: 'Not a member of this team' })
      return
    }
    const parsed = createCommentSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
      return
    }
    const comment = await IssueComment.create({
      issueId: issue._id,
      authorId: userId,
      content: parsed.data.content,
    })
    const populated = await IssueComment.findById(comment._id)
      .populate('authorId', 'name email')
      .lean()
    const a = populated?.authorId as { _id?: unknown; name?: string; email?: string }
    res.status(201).json({
      id: (comment._id as { toString: () => string })?.toString(),
      content: comment.content,
      authorId: userId,
      authorName: a?.name ?? a?.email,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    })
  } catch (err) {
    logger.error('Failed to create comment', { error: err })
    res.status(500).json({ error: 'Failed to create comment' })
  }
})

// --- Export ---
router.get('/:id/export', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const format = (req.query.format as string) || 'json'
    const issue = await Issue.findById(req.params.id)
      .populate('reporterId', 'name email')
      .populate('assigneeId', 'name email')
      .lean()
    if (!issue) {
      res.status(404).json({ error: 'Issue not found' })
      return
    }
    const team = await Team.findById(issue.teamId).lean()
    if (!team || !isTeamMember(team, userId)) {
      res.status(403).json({ error: 'Not a member of this team' })
      return
    }
    const r = issue.reporterId as { name?: string; email?: string }
    const a = issue.assigneeId as { name?: string; email?: string } | null
    const payload = {
      id: (issue._id as { toString: () => string })?.toString(),
      title: issue.title,
      description: issue.description,
      promptSteps: issue.promptSteps ?? [],
      nextPromptList: issue.nextPromptList ?? [],
      links: issue.links ?? [],
      screenshots: (issue.screenshots ?? []).map((s) => ({ caption: s.caption, mimeType: s.mimeType })),
      teamId: (issue.teamId as { toString: () => string })?.toString(),
      projectId: issue.projectId ? (issue.projectId as { toString: () => string }).toString() : null,
      reporterId: refToId(issue.reporterId) ?? '',
      assigneeId: refToId(issue.assigneeId),
      reporterName: r?.name ?? r?.email,
      assigneeName: a?.name ?? a?.email ?? null,
      status: issue.status,
      jiraTicketId: issue.jiraTicketId ?? null,
      tags: issue.tags ?? [],
      environment: issue.environment ?? null,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    }
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="issue-${req.params.id}.json"`)
      return res.send(JSON.stringify(payload, null, 2))
    }
    if (format === 'csv') {
      const rows = [
        ['Field', 'Value'],
        ['ID', payload.id],
        ['Title', payload.title],
        ['Description', payload.description],
        ['Status', payload.status],
        ['Reporter', payload.reporterName],
        ['Assignee', payload.assigneeName ?? ''],
        ['Jira', payload.jiraTicketId ?? ''],
        ['Tags', payload.tags.join(', ')],
        ['Created', payload.createdAt],
        ['Updated', payload.updatedAt],
      ]
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="issue-${req.params.id}.csv"`)
      return res.send(csv)
    }
    res.status(400).json({ error: 'Format must be json or csv. PDF/XLSX coming soon.' })
  } catch (err) {
    logger.error('Failed to export issue', { error: err })
    res.status(500).json({ error: 'Failed to export' })
  }
})

export default router
