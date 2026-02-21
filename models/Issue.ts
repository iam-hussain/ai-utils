import mongoose, { Schema, Document, Model } from 'mongoose'

export type IssueStatus = 'open' | 'in_progress' | 'completed' | 'closed'

export interface IPromptStep {
  promptText: string
  expectedReply?: string
  actualReply?: string
  envStatus: 'working' | 'not_working' | 'unknown'
}

export interface ILink {
  url: string
  label?: string
}

export interface IScreenshot {
  data: string // base64
  caption?: string
  mimeType?: string
}

export interface IIssue extends Document {
  title: string
  description: string
  promptSteps: IPromptStep[]
  nextPromptList?: string[]
  links: ILink[]
  screenshots: IScreenshot[]
  teamId: mongoose.Types.ObjectId
  projectId?: mongoose.Types.ObjectId
  reporterId: mongoose.Types.ObjectId
  assigneeId?: mongoose.Types.ObjectId
  status: IssueStatus
  jiraTicketId?: string
  tags: string[]
  environment?: string
  createdAt: Date
  updatedAt: Date
}

const PromptStepSchema = new Schema(
  {
    promptText: { type: String, required: true },
    expectedReply: String,
    actualReply: String,
    envStatus: { type: String, enum: ['working', 'not_working', 'unknown'], default: 'unknown' },
  },
  { _id: false }
)

const LinkSchema = new Schema(
  { url: { type: String, required: true }, label: String },
  { _id: false }
)

const ScreenshotSchema = new Schema(
  {
    data: { type: String, required: true },
    caption: String,
    mimeType: { type: String, default: 'image/png' },
  },
  { _id: false }
)

const IssueSchema = new Schema<IIssue>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, default: '' },
    promptSteps: { type: [PromptStepSchema], default: [] },
    nextPromptList: { type: [String], default: [] },
    links: { type: [LinkSchema], default: [] },
    screenshots: { type: [ScreenshotSchema], default: [] },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'completed', 'closed'],
      default: 'open',
    },
    jiraTicketId: { type: String, trim: true },
    tags: { type: [String], default: [] },
    environment: { type: String, trim: true },
  },
  { timestamps: true }
)

IssueSchema.index({ teamId: 1, status: 1 })
IssueSchema.index({ projectId: 1, status: 1 })
IssueSchema.index({ assigneeId: 1 })
IssueSchema.index({ reporterId: 1 })
IssueSchema.index({ jiraTicketId: 1 })

export const Issue: Model<IIssue> =
  mongoose.models.Issue ?? mongoose.model<IIssue>('Issue', IssueSchema)
