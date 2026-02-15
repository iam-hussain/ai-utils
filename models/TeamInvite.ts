import mongoose, { Schema, Document, Model } from 'mongoose'

export type TeamInviteStatus = 'pending' | 'accepted' | 'declined'

export interface ITeamInvite extends Document {
  teamId: mongoose.Types.ObjectId
  inviterId: mongoose.Types.ObjectId
  inviteeId: mongoose.Types.ObjectId
  status: TeamInviteStatus
  createdAt: Date
  updatedAt: Date
}

const TeamInviteSchema = new Schema<ITeamInvite>(
  {
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    inviterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    inviteeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  },
  { timestamps: true }
)

TeamInviteSchema.index({ inviteeId: 1, status: 1 })
TeamInviteSchema.index({ teamId: 1, inviteeId: 1 })

export const TeamInvite: Model<ITeamInvite> =
  mongoose.models.TeamInvite ?? mongoose.model<ITeamInvite>('TeamInvite', TeamInviteSchema)
