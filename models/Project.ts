import mongoose, { Schema, Document, Model } from 'mongoose'

export const DEFAULT_ENVIRONMENTS = ['DEV', 'SIT', 'UAT', 'PT', 'PROD']

export interface IProject extends Document {
  name: string
  teamIds: mongoose.Types.ObjectId[]
  ownerId: mongoose.Types.ObjectId
  description?: string
  environments: string[]
  createdAt: Date
  updatedAt: Date
}

const ProjectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true },
    teamIds: { type: [Schema.Types.ObjectId], ref: 'Team', default: [] },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, trim: true, default: '' },
    environments: { type: [String], default: () => [...DEFAULT_ENVIRONMENTS] },
  },
  { timestamps: true }
)

ProjectSchema.index({ teamIds: 1 })

export const Project: Model<IProject> =
  mongoose.models.Project ?? mongoose.model<IProject>('Project', ProjectSchema)
