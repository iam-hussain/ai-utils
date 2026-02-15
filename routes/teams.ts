import { Router, Request, Response } from 'express'
import mongoose from 'mongoose'
import { Team } from '../models/Team'
import { User } from '../models/User'
import { TeamInvite } from '../models/TeamInvite'
import { TeamJoinRequest } from '../models/TeamJoinRequest'
import { requireAuth } from '../lib/auth'
import { logger } from '../lib/logger'
import {
  createTeamSchema,
  inviteTeamSchema,
  updateTeamPromptsSchema,
  updateMemberRoleSchema,
} from '../lib/schemas/user-data-schemas'

const router = Router()

function migrateTeamToCategories(team: { savedPromptSetCategories?: unknown[]; savedPromptSets?: unknown[] }) {
  const categories = team.savedPromptSetCategories ?? []
  const flatSets = team.savedPromptSets ?? []
  if (Array.isArray(categories) && categories.length > 0) return categories
  if (Array.isArray(flatSets) && flatSets.length > 0) {
    return [{ id: `cat-${Date.now()}`, name: 'General', sets: flatSets, createdAt: Date.now(), updatedAt: Date.now() }]
  }
  return []
}

type TeamDoc = {
  _id?: unknown
  name?: string
  ownerId?: { toString: () => string }
  memberIds?: unknown[]
  members?: { userId: { toString: () => string }; role: string }[]
  isDiscoverable?: boolean
  promptLibrary?: unknown[]
  savedPromptSets?: unknown[]
  savedPromptSetCategories?: unknown[]
  createdAt?: unknown
  updatedAt?: unknown
}

function toTeamResponse(t: TeamDoc) {
  const categories = migrateTeamToCategories(t)
  const memberIds = (t.memberIds ?? []).map((id: unknown) => (id as { toString: () => string })?.toString())
  const members = (t.members ?? []).map((m) => ({
    userId: m.userId?.toString(),
    role: m.role ?? 'write',
  }))
  return {
    id: (t._id as { toString: () => string })?.toString(),
    name: t.name,
    ownerId: t.ownerId?.toString(),
    memberIds,
    members,
    memberCount: memberIds.length + 1,
    isDiscoverable: t.isDiscoverable ?? false,
    promptLibrary: t.promptLibrary ?? [],
    savedPromptSets: t.savedPromptSets ?? [],
    savedPromptSetCategories: categories,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}

router.use(requireAuth)

function isMember(team: TeamDoc, userId: string): boolean {
  const owner = team.ownerId?.toString()
  const memberIds = (team.memberIds ?? []).map((id: unknown) => (id as { toString: () => string })?.toString())
  const memberUserIds = (team.members ?? []).map((m) => m.userId?.toString())
  const allMemberIds = [...new Set([...memberIds, ...memberUserIds])]
  return owner === userId || allMemberIds.includes(userId)
}

function getMemberRole(team: TeamDoc, userId: string): 'owner' | 'read' | 'write' | null {
  if (team.ownerId?.toString() === userId) return 'owner'
  const member = (team.members ?? []).find((m) => m.userId?.toString() === userId)
  if (member) return (member.role as 'read' | 'write') ?? 'write'
  const memberIds = (team.memberIds ?? []).map((id: unknown) => (id as { toString: () => string })?.toString())
  if (memberIds.includes(userId)) return 'write'
  return null
}

function canEdit(team: TeamDoc, userId: string): boolean {
  const role = getMemberRole(team, userId)
  return role === 'owner' || role === 'write'
}

function canManageMembers(team: TeamDoc, userId: string): boolean {
  return team.ownerId?.toString() === userId
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const teams = await Team.find({
      $or: [{ ownerId: userId }, { memberIds: userId }],
    })
      .sort({ updatedAt: -1 })
      .lean()
    res.json(teams.map(toTeamResponse))
  } catch (err) {
    logger.error('Failed to list teams', { error: err })
    res.status(500).json({ error: 'Failed to list teams' })
  }
})

router.get('/:id/members', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const team = await Team.findById(req.params.id)
    if (!team) {
      res.status(404).json({ error: 'Team not found' })
      return
    }
    if (!isMember(team, userId)) {
      res.status(403).json({ error: 'Not a member of this team' })
      return
    }
    const memberIds = [...(team.memberIds ?? []), team.ownerId]
    const users = await User.find({ _id: { $in: memberIds } })
      .select('_id name email')
      .lean()
    const userMap = new Map(users.map((u) => [(u._id as { toString: () => string }).toString(), u]))
    const members = memberIds.map((id) => {
      const idStr = id.toString()
      const u = userMap.get(idStr) as { _id?: unknown; name?: string; email?: string } | undefined
      const role = idStr === team.ownerId?.toString() ? 'owner' : getMemberRole(team, idStr)
      return {
        userId: idStr,
        email: u?.email ?? null,
        name: u?.name ?? null,
        role,
      }
    })
    res.json(members)
  } catch (err) {
    logger.error('Failed to list members', { error: err })
    res.status(500).json({ error: 'Failed to list members' })
  }
})

router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string)?.trim()
    if (!q || q.length < 2) {
      res.json([])
      return
    }
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const teams = await Team.find({
      isDiscoverable: true,
      name: { $regex: q, $options: 'i' },
      $nor: [{ ownerId: userId }, { memberIds: userId }],
    })
      .select('name ownerId memberIds')
      .limit(20)
      .lean()
    res.json(
      teams.map((t) => ({
        id: (t._id as { toString: () => string })?.toString(),
        name: t.name,
        memberCount: (t.memberIds?.length ?? 0) + 1,
      }))
    )
  } catch (err) {
    logger.error('Failed to search teams', { error: err })
    res.status(500).json({ error: 'Failed to search teams' })
  }
})

router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const parsed = createTeamSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
      return
    }
    const team = await Team.create({
      name: parsed.data.name,
      ownerId: userId,
      memberIds: [],
    })
    res.status(201).json({
      id: team._id?.toString(),
      name: team.name,
      ownerId: team.ownerId?.toString(),
      memberIds: [],
      memberCount: 1,
      promptLibrary: [],
      savedPromptSets: [],
      savedPromptSetCategories: [],
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    })
  } catch (err) {
    logger.error('Failed to create team', { error: err })
    res.status(500).json({ error: 'Failed to create team' })
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const team = await Team.findById(req.params.id).lean()
    if (!team) {
      res.status(404).json({ error: 'Team not found' })
      return
    }
    if (!isMember(team, userId)) {
      res.status(403).json({ error: 'Not a member of this team' })
      return
    }
    res.json(toTeamResponse(team))
  } catch (err) {
    logger.error('Failed to get team', { error: err })
    res.status(500).json({ error: 'Failed to get team' })
  }
})

router.put('/:id/prompts', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const team = await Team.findById(req.params.id)
    if (!team) {
      res.status(404).json({ error: 'Team not found' })
      return
    }
    if (!canEdit(team, userId)) {
      res.status(403).json({ error: 'Not authorized to edit team prompts' })
      return
    }
    const parsed = updateTeamPromptsSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
      return
    }
    team.promptLibrary = parsed.data.promptLibrary
    team.savedPromptSets = parsed.data.savedPromptSets
    team.savedPromptSetCategories = parsed.data.savedPromptSetCategories ?? []
    await team.save()
    res.json({
      promptLibrary: team.promptLibrary,
      savedPromptSets: team.savedPromptSets,
      savedPromptSetCategories: team.savedPromptSetCategories,
    })
  } catch (err) {
    logger.error('Failed to update team prompts', { error: err })
    res.status(500).json({ error: 'Failed to update team prompts' })
  }
})

router.post('/:id/invite', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const team = await Team.findById(req.params.id)
    if (!team) {
      res.status(404).json({ error: 'Team not found' })
      return
    }
    if (!canManageMembers(team, userId)) {
      res.status(403).json({ error: 'Only the owner can invite members' })
      return
    }
    const parsed = inviteTeamSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid email', details: parsed.error.flatten() })
      return
    }
    const invitee = await User.findOne({ email: parsed.data.email }).select('_id')
    if (!invitee) {
      res.status(404).json({ error: 'User not found with that email' })
      return
    }
    const inviteeId = invitee._id.toString()
    if (team.ownerId.toString() === inviteeId) {
      res.status(400).json({ error: 'User is already the owner' })
      return
    }
    const memberIds = (team.memberIds ?? []).map((id) => id.toString())
    if (memberIds.includes(inviteeId)) {
      res.status(400).json({ error: 'User is already a member' })
      return
    }
    const existing = await TeamInvite.findOne({ teamId: team._id, inviteeId, status: 'pending' })
    if (existing) {
      res.status(400).json({ error: 'Invite already sent' })
      return
    }
    await TeamInvite.create({
      teamId: team._id,
      inviterId: userId,
      inviteeId: invitee._id,
      status: 'pending',
    })
    res.json({ ok: true, message: 'Invite sent' })
  } catch (err) {
    logger.error('Failed to invite to team', { error: err })
    res.status(500).json({ error: 'Failed to invite' })
  }
})

router.put('/:id/discoverable', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const team = await Team.findById(req.params.id)
    if (!team) {
      res.status(404).json({ error: 'Team not found' })
      return
    }
    if (team.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the owner can change discoverability' })
      return
    }
    const isDiscoverable = req.body?.isDiscoverable === true
    team.isDiscoverable = isDiscoverable
    await team.save()
    res.json({ isDiscoverable: team.isDiscoverable })
  } catch (err) {
    logger.error('Failed to update discoverability', { error: err })
    res.status(500).json({ error: 'Failed to update' })
  }
})

router.post('/:id/request', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const team = await Team.findById(req.params.id)
    if (!team) {
      res.status(404).json({ error: 'Team not found' })
      return
    }
    if (!team.isDiscoverable) {
      res.status(403).json({ error: 'Team is not open for join requests' })
      return
    }
    if (isMember(team, userId)) {
      res.status(400).json({ error: 'Already a member' })
      return
    }
    const existing = await TeamJoinRequest.findOne({ teamId: team._id, requesterId: userId, status: 'pending' })
    if (existing) {
      res.status(400).json({ error: 'Join request already pending' })
      return
    }
    await TeamJoinRequest.create({ teamId: team._id, requesterId: userId, status: 'pending' })
    res.json({ ok: true, message: 'Join request sent' })
  } catch (err) {
    logger.error('Failed to request join', { error: err })
    res.status(500).json({ error: 'Failed to request join' })
  }
})

router.get('/:id/requests', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const team = await Team.findById(req.params.id)
    if (!team) {
      res.status(404).json({ error: 'Team not found' })
      return
    }
    if (!canManageMembers(team, userId)) {
      res.status(403).json({ error: 'Only the owner can view join requests' })
      return
    }
    const requests = await TeamJoinRequest.find({ teamId: team._id, status: 'pending' })
      .populate('requesterId', 'name email')
      .sort({ createdAt: -1 })
      .lean()
    res.json(
      requests.map((r) => {
        const reqUser = r.requesterId as { _id?: { toString: () => string }; name?: string; email?: string }
        return {
          id: (r._id as { toString: () => string })?.toString(),
          requesterId: reqUser?._id?.toString(),
          requesterName: reqUser?.name ?? reqUser?.email,
          requesterEmail: reqUser?.email,
          createdAt: r.createdAt,
        }
      })
    )
  } catch (err) {
    logger.error('Failed to list join requests', { error: err })
    res.status(500).json({ error: 'Failed to list requests' })
  }
})

router.post('/:id/requests/:reqId/approve', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const team = await Team.findById(req.params.id)
    if (!team) {
      res.status(404).json({ error: 'Team not found' })
      return
    }
    if (!canManageMembers(team, userId)) {
      res.status(403).json({ error: 'Only the owner can approve requests' })
      return
    }
    const joinReq = await TeamJoinRequest.findOne({
      _id: req.params.reqId,
      teamId: team._id,
      status: 'pending',
    })
    if (!joinReq) {
      res.status(404).json({ error: 'Request not found or already handled' })
      return
    }
    const requesterId = joinReq.requesterId.toString()
    team.memberIds = [...(team.memberIds ?? []), joinReq.requesterId]
    const members = team.members ?? []
    const hasMember = members.some((m) => m.userId.toString() === requesterId)
    if (!hasMember) {
      team.members = [...members, { userId: joinReq.requesterId, role: 'write' as const }]
    }
    await team.save()
    joinReq.status = 'approved'
    await joinReq.save()
    res.json({ ok: true })
  } catch (err) {
    logger.error('Failed to approve request', { error: err })
    res.status(500).json({ error: 'Failed to approve' })
  }
})

router.post('/:id/requests/:reqId/reject', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const team = await Team.findById(req.params.id)
    if (!team) {
      res.status(404).json({ error: 'Team not found' })
      return
    }
    if (!canManageMembers(team, userId)) {
      res.status(403).json({ error: 'Only the owner can reject requests' })
      return
    }
    const joinReq = await TeamJoinRequest.findOne({
      _id: req.params.reqId,
      teamId: team._id,
      status: 'pending',
    })
    if (!joinReq) {
      res.status(404).json({ error: 'Request not found or already handled' })
      return
    }
    joinReq.status = 'rejected'
    await joinReq.save()
    res.json({ ok: true })
  } catch (err) {
    logger.error('Failed to reject request', { error: err })
    res.status(500).json({ error: 'Failed to reject' })
  }
})

router.put('/:id/members/:memberId/role', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const team = await Team.findById(req.params.id)
    if (!team) {
      res.status(404).json({ error: 'Team not found' })
      return
    }
    if (!canManageMembers(team, userId)) {
      res.status(403).json({ error: 'Only the owner can change member roles' })
      return
    }
    const memberId = req.params.memberId
    const parsed = updateMemberRoleSchema.safeParse({ userId: memberId, role: req.body?.role })
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
      return
    }
    if (team.ownerId.toString() === memberId) {
      res.status(400).json({ error: 'Cannot change owner role' })
      return
    }
    const memberIds = (team.memberIds ?? []).map((id) => id.toString())
    if (!memberIds.includes(memberId)) {
      res.status(404).json({ error: 'Member not found' })
      return
    }
    const memberObjId = new mongoose.Types.ObjectId(memberId)
    const members = team.members ?? []
    const idx = members.findIndex((m) => m.userId.toString() === memberId)
    const newMember = { userId: memberObjId, role: parsed.data.role as 'read' | 'write' }
    if (idx >= 0) {
      members[idx] = newMember
    } else {
      team.members = [...members, newMember]
    }
    await team.save()
    res.json({ members: team.members })
  } catch (err) {
    logger.error('Failed to update member role', { error: err })
    res.status(500).json({ error: 'Failed to update role' })
  }
})

router.delete('/:id/leave', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const team = await Team.findById(req.params.id)
    if (!team) {
      res.status(404).json({ error: 'Team not found' })
      return
    }
    if (team.ownerId.toString() === userId) {
      res.status(400).json({ error: 'Owner cannot leave. Transfer ownership or delete the team.' })
      return
    }
    team.memberIds = (team.memberIds ?? []).filter((id) => id.toString() !== userId)
    await team.save()
    res.json({ ok: true })
  } catch (err) {
    logger.error('Failed to leave team', { error: err })
    res.status(500).json({ error: 'Failed to leave team' })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const team = await Team.findById(req.params.id)
    if (!team) {
      res.status(404).json({ error: 'Team not found' })
      return
    }
    if (team.ownerId.toString() !== userId) {
      res.status(403).json({ error: 'Only the owner can delete the team' })
      return
    }
    await Team.deleteOne({ _id: req.params.id })
    res.status(204).send()
  } catch (err) {
    logger.error('Failed to delete team', { error: err })
    res.status(500).json({ error: 'Failed to delete team' })
  }
})

export default router
