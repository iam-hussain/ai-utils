import mongoose, { Schema, Document, Model } from 'mongoose'

export type TeamJoinRequestStatus = 'pending' | 'approved' | 'rejected'

export interface ITeamJoinRequest extends Document {
  teamId: mongoose.Types.ObjectId
  requesterId: mongoose.Types.ObjectId
  status: TeamJoinRequestStatus
  createdAt: Date
  updatedAt: Date
}

const TeamJoinRequestSchema = new Schema<ITeamJoinRequest>(
  {
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
)

TeamJoinRequestSchema.index({ teamId: 1, requesterId: 1 })
TeamJoinRequestSchema.index({ teamId: 1, status: 1 })

export const TeamJoinRequest: Model<ITeamJoinRequest> =
  mongoose.models.TeamJoinRequest ??
  mongoose.model<ITeamJoinRequest>('TeamJoinRequest', TeamJoinRequestSchema)
