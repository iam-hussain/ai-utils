import mongoose, { Schema, Document, Model } from 'mongoose'
import type { PromptCategory, SavedPromptSet, SavedPromptSetCategory } from './UserData'

export type TeamMemberRole = 'read' | 'write'

export interface ITeamMember {
  userId: mongoose.Types.ObjectId
  role: TeamMemberRole
}

export interface ITeam extends Document {
  name: string
  ownerId: mongoose.Types.ObjectId
  memberIds: mongoose.Types.ObjectId[]
  members?: ITeamMember[]
  isDiscoverable: boolean
  promptLibrary: PromptCategory[]
  savedPromptSets: SavedPromptSet[]
  savedPromptSetCategories: SavedPromptSetCategory[]
  createdAt: Date
  updatedAt: Date
}

const ChainStepSchema = new Schema({ promptText: String, expectedReply: String }, { _id: false })
const PromptEntrySchema = new Schema(
  {
    id: String,
    name: String,
    promptText: String,
    reply: String,
    expectedReply: String,
    chainSteps: [ChainStepSchema],
    createdAt: Number,
    updatedAt: Number,
  },
  { _id: false }
)
const PromptCategorySchema = new Schema(
  {
    id: String,
    name: String,
    prompts: [PromptEntrySchema],
    createdAt: Number,
    updatedAt: Number,
  },
  { _id: false }
)
const PromptMessageSchema = new Schema(
  { type: String, content: String, name: String, role: String },
  { _id: false }
)
const SavedPromptSetSchema = new Schema(
  {
    id: String,
    name: String,
    messages: [PromptMessageSchema],
    createdAt: Number,
  },
  { _id: false }
)
const SavedPromptSetCategorySchema = new Schema(
  {
    id: String,
    name: String,
    sets: [SavedPromptSetSchema],
    createdAt: Number,
    updatedAt: Number,
  },
  { _id: false }
)

const TeamMemberSchema = new Schema(
  { userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, role: { type: String, enum: ['read', 'write'], default: 'write' } },
  { _id: false }
)

const TeamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    memberIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    members: { type: [TeamMemberSchema], default: [] },
    isDiscoverable: { type: Boolean, default: false },
    promptLibrary: { type: [PromptCategorySchema], default: [] },
    savedPromptSets: { type: [SavedPromptSetSchema], default: [] },
    savedPromptSetCategories: { type: [SavedPromptSetCategorySchema], default: [] },
  },
  { timestamps: true }
)

TeamSchema.index({ ownerId: 1 })
TeamSchema.index({ memberIds: 1 })
TeamSchema.index({ isDiscoverable: 1, name: 1 })

export const Team: Model<ITeam> =
  mongoose.models.Team ?? mongoose.model<ITeam>('Team', TeamSchema)
