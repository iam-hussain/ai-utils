import { Router, Request, Response } from 'express'
import { Project } from '../models/Project'
import { Team } from '../models/Team'
import { requireAuth, getUserId } from '../lib/auth'
import { getUserTeamIds } from '../lib/access'
import { logger } from '../lib/logger'
import {
  createProjectSchema,
  updateProjectSchema,
  addTeamToProjectSchema,
} from '../lib/schemas/issue-schemas'
import { DEFAULT_ENVIRONMENTS } from '../models/Project'

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

function toProjectResponse(p: {
  _id?: unknown
  name?: string
  teamIds?: unknown[]
  ownerId?: unknown
  description?: string
  environments?: string[]
  createdAt?: unknown
  updatedAt?: unknown
}) {
  const teamIds = (p.teamIds ?? []).map((id: unknown) => (id as { toString: () => string })?.toString())
  const environments = p.environments?.length ? p.environments : [...DEFAULT_ENVIRONMENTS]
  return {
    id: (p._id as { toString: () => string })?.toString(),
    name: p.name,
    teamIds,
    ownerId: (p.ownerId as { toString: () => string })?.toString(),
    description: p.description ?? '',
    environments,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

router.use(requireAuth)

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const teamIdFilter = req.query.teamId as string | undefined

    const userTeamIds = await getUserTeamIds(userId)

    const filter: Record<string, unknown> = teamIdFilter
      ? userTeamIds.some((id) => id.toString() === teamIdFilter)
        ? { teamIds: teamIdFilter }
        : { _id: null }
      : { $or: [{ ownerId: userId }, { teamIds: { $in: userTeamIds } }] }

    const projects = await Project.find(filter).sort({ updatedAt: -1 }).lean()
    res.json(projects.map(toProjectResponse))
  } catch (err) {
    logger.error('Failed to list projects', { error: err })
    res.status(500).json({ error: 'Failed to list projects' })
  }
})

router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const parsed = createProjectSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
      return
    }
    const teamIds = parsed.data.teamIds ?? []
    for (const tid of teamIds) {
      const team = await Team.findById(tid).lean()
      if (!team || !isTeamMember(team, userId)) {
        res.status(403).json({ error: `Not a member of team ${tid}` })
        return
      }
    }
    const project = await Project.create({
      name: parsed.data.name,
      teamIds,
      ownerId: userId,
      description: parsed.data.description ?? '',
      environments: parsed.data.environments ?? [...DEFAULT_ENVIRONMENTS],
    })
    res.status(201).json(toProjectResponse(project))
  } catch (err) {
    logger.error('Failed to create project', { error: err })
    res.status(500).json({ error: 'Failed to create project' })
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const project = await Project.findById(req.params.id).lean()
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    const teamIds = (project.teamIds ?? []).map((id: unknown) => (id as { toString: () => string })?.toString())
    const ownerId = (project.ownerId as { toString: () => string })?.toString()
    const teams = teamIds.length > 0 ? await Team.find({ _id: { $in: teamIds } }).lean() : []
    const hasAccess =
      ownerId === userId || (teamIds.length > 0 && teams.some((t) => isTeamMember(t, userId)))
    if (!hasAccess) {
      res.status(403).json({ error: 'Not a member of any team in this project' })
      return
    }
    res.json(toProjectResponse(project))
  } catch (err) {
    logger.error('Failed to get project', { error: err })
    res.status(500).json({ error: 'Failed to get project' })
  }
})

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const project = await Project.findById(req.params.id)
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    const teamIds = (project.teamIds ?? []).map((id: unknown) => (id as { toString: () => string })?.toString())
    const ownerId = (project.ownerId as { toString: () => string })?.toString()
    const teams = teamIds.length > 0 ? await Team.find({ _id: { $in: teamIds } }).lean() : []
    const hasAccess = ownerId === userId || teams.some((t) => isTeamMember(t, userId))
    if (!hasAccess) {
      res.status(403).json({ error: 'Not a member of any team in this project' })
      return
    }
    const parsed = updateProjectSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
      return
    }
    if (parsed.data.name != null && parsed.data.name.trim()) project.name = parsed.data.name.trim()
    if (parsed.data.description !== undefined) project.description = parsed.data.description
    if (parsed.data.environments != null && Array.isArray(parsed.data.environments)) {
      project.environments = parsed.data.environments.filter((e) => typeof e === 'string' && e.trim())
    }
    await project.save()
    res.json(toProjectResponse(project))
  } catch (err) {
    logger.error('Failed to update project', { error: err })
    res.status(500).json({ error: 'Failed to update project' })
  }
})

router.post('/:id/teams', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const parsed = addTeamToProjectSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
      return
    }
    const project = await Project.findById(req.params.id)
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    const teamIds = (project.teamIds ?? []).map((id: unknown) => (id as { toString: () => string })?.toString())
    const teams = await Team.find({ _id: { $in: teamIds } }).lean()
    const ownerId = (project.ownerId as { toString: () => string })?.toString()
    const hasAccess =
      ownerId === userId || (teamIds.length > 0 && teams.some((t) => isTeamMember(t, userId)))
    if (!hasAccess) {
      res.status(403).json({ error: 'Not a member of any team in this project' })
      return
    }
    const team = await Team.findById(parsed.data.teamId).lean()
    if (!team || !isTeamMember(team, userId)) {
      res.status(403).json({ error: 'Not a member of that team' })
      return
    }
    const tid = parsed.data.teamId
    if (teamIds.includes(tid)) {
      res.status(400).json({ error: 'Team already in project' })
      return
    }
    project.teamIds = [...(project.teamIds ?? []), team._id]
    await project.save()
    res.json(toProjectResponse(project))
  } catch (err) {
    logger.error('Failed to add team to project', { error: err })
    res.status(500).json({ error: 'Failed to add team' })
  }
})

router.delete('/:id/teams/:teamId', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const project = await Project.findById(req.params.id)
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    const teamIds = (project.teamIds ?? []).map((id: unknown) => (id as { toString: () => string })?.toString())
    const ownerId = (project.ownerId as { toString: () => string })?.toString()
    const teams = teamIds.length > 0 ? await Team.find({ _id: { $in: teamIds } }).lean() : []
    const hasAccess = ownerId === userId || teams.some((t) => isTeamMember(t, userId))
    if (!hasAccess) {
      res.status(403).json({ error: 'Not a member of any team in this project' })
      return
    }
    const toRemove = req.params.teamId
    project.teamIds = (project.teamIds ?? []).filter(
      (id) => (id as { toString: () => string })?.toString() !== toRemove
    )
    await project.save()
    res.json(toProjectResponse(project))
  } catch (err) {
    logger.error('Failed to remove team from project', { error: err })
    res.status(500).json({ error: 'Failed to remove team' })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const project = await Project.findById(req.params.id)
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    const teamIds = (project.teamIds ?? []).map((id: unknown) => (id as { toString: () => string })?.toString())
    const ownerId = (project.ownerId as { toString: () => string })?.toString()
    const teams = teamIds.length > 0 ? await Team.find({ _id: { $in: teamIds } }).lean() : []
    const hasAccess = ownerId === userId || teams.some((t) => isTeamMember(t, userId))
    if (!hasAccess) {
      res.status(403).json({ error: 'Not a member of any team in this project' })
      return
    }
    await Project.deleteOne({ _id: req.params.id })
    res.status(204).send()
  } catch (err) {
    logger.error('Failed to delete project', { error: err })
    res.status(500).json({ error: 'Failed to delete project' })
  }
})

export default router
