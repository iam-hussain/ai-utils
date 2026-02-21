import mongoose from 'mongoose'
import { Team } from '../models/Team'

/**
 * Returns the MongoDB filter to find teams the user has access to
 * (owner or member via memberIds or members.userId).
 */
export function teamQueryForUser(userId: string): Record<string, unknown> {
  const userObjId = new mongoose.Types.ObjectId(userId)
  return {
    $or: [
      { ownerId: userObjId },
      { memberIds: userObjId },
      { 'members.userId': userObjId },
    ],
  }
}

/**
 * Returns team IDs the user has access to (owner or member).
 * Use for filtering issues, projects, and other team-scoped resources.
 */
export async function getUserTeamIds(userId: string): Promise<mongoose.Types.ObjectId[]> {
  const teams = await Team.find(teamQueryForUser(userId))
    .select('_id')
    .lean()
  return teams.map((t) => t._id).filter((id): id is mongoose.Types.ObjectId => id != null)
}
