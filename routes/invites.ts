import { Router, Request, Response } from 'express'
import mongoose from 'mongoose'
import { TeamInvite } from '../models/TeamInvite'
import { Team } from '../models/Team'
import { requireAuth } from '../lib/auth'
import { logger } from '../lib/logger'

const router = Router()

router.use(requireAuth)

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const invites = await TeamInvite.find({ inviteeId: userId, status: 'pending' })
      .populate({ path: 'teamId', select: 'name' })
      .populate('inviterId', 'name email')
      .sort({ createdAt: -1 })
      .lean()
    res.json(
      invites.map((inv) => ({
        id: inv._id?.toString(),
        teamId: (inv.teamId as { _id?: { toString: () => string }; name?: string })?._id?.toString(),
        teamName: (inv.teamId as { name?: string })?.name,
        inviterName: (inv.inviterId as { name?: string; email?: string })?.name || (inv.inviterId as { email?: string })?.email,
        inviterEmail: (inv.inviterId as { email?: string })?.email,
        createdAt: inv.createdAt,
      }))
    )
  } catch (err) {
    logger.error('Failed to list invites', { error: err })
    res.status(500).json({ error: 'Failed to list invites' })
  }
})

router.post('/:id/accept', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const invite = await TeamInvite.findOne({ _id: req.params.id, inviteeId: userId, status: 'pending' })
    if (!invite) {
      res.status(404).json({ error: 'Invite not found or already handled' })
      return
    }
    const team = await Team.findById(invite.teamId)
    if (!team) {
      res.status(404).json({ error: 'Team not found' })
      return
    }
    const memberIds = (team.memberIds ?? []).map((id) => id.toString())
    if (memberIds.includes(userId)) {
      invite.status = 'accepted'
      await invite.save()
      return res.json({ ok: true, message: 'Already a member' })
    }
    const userObjId = new mongoose.Types.ObjectId(userId)
    team.memberIds = [...(team.memberIds ?? []), userObjId]
    const members = team.members ?? []
    const existingMember = members.some((m) => m.userId.toString() === userId)
    if (!existingMember) {
      team.members = [...members, { userId: userObjId, role: 'write' as const }]
    }
    await team.save()
    invite.status = 'accepted'
    await invite.save()
    res.json({ ok: true })
  } catch (err) {
    logger.error('Failed to accept invite', { error: err })
    res.status(500).json({ error: 'Failed to accept invite' })
  }
})

router.post('/:id/decline', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user: { userId: string } }).user.userId
    const invite = await TeamInvite.findOne({ _id: req.params.id, inviteeId: userId, status: 'pending' })
    if (!invite) {
      res.status(404).json({ error: 'Invite not found or already handled' })
      return
    }
    invite.status = 'declined'
    await invite.save()
    res.json({ ok: true })
  } catch (err) {
    logger.error('Failed to decline invite', { error: err })
    res.status(500).json({ error: 'Failed to decline invite' })
  }
})

export default router
