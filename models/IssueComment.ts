import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IIssueComment extends Document {
  issueId: mongoose.Types.ObjectId
  authorId: mongoose.Types.ObjectId
  content: string
  createdAt: Date
  updatedAt: Date
}

const IssueCommentSchema = new Schema<IIssueComment>(
  {
    issueId: { type: Schema.Types.ObjectId, ref: 'Issue', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
)

IssueCommentSchema.index({ issueId: 1 })

export const IssueComment: Model<IIssueComment> =
  mongoose.models.IssueComment ??
  mongoose.model<IIssueComment>('IssueComment', IssueCommentSchema)
