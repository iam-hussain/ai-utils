import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IChatMessage {
  id: string
  content: string
  type: 'human' | 'system' | 'ai'
  timestamp: string
  audioData?: string
}

export interface IChat extends Document {
  id: string
  userId: mongoose.Types.ObjectId
  title: string
  messages: IChatMessage[]
  createdAt: number
  updatedAt: number
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    id: { type: String, required: true },
    content: { type: String, required: true },
    type: { type: String, enum: ['human', 'system', 'ai'], required: true },
    timestamp: { type: String, required: true },
    audioData: { type: String },
  },
  { _id: false }
)

const ChatSchema = new Schema<IChat>(
  {
    id: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, default: 'New Chat' },
    messages: { type: [ChatMessageSchema], default: [] },
    createdAt: { type: Number, required: true },
    updatedAt: { type: Number, required: true },
  },
  { timestamps: false }
)

ChatSchema.index({ userId: 1, id: 1 }, { unique: true })
ChatSchema.index({ userId: 1, updatedAt: -1 })

export const Chat: Model<IChat> = mongoose.models.Chat ?? mongoose.model<IChat>('Chat', ChatSchema)
