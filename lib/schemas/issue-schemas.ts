import { z } from 'zod'

export const promptStepSchema = z.object({
  promptText: z.string().min(1),
  expectedReply: z.string().optional(),
  actualReply: z.string().optional(),
  envStatus: z.enum(['working', 'not_working', 'unknown']).default('unknown'),
})

export const linkSchema = z.object({
  url: z.string().url(),
  label: z.string().optional(),
})

export const screenshotSchema = z.object({
  data: z.string().min(1),
  caption: z.string().optional(),
  mimeType: z.string().default('image/png'),
})

export const createIssueSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().default(''),
  promptSteps: z.array(promptStepSchema).default([]),
  nextPromptList: z.array(z.string()).default([]),
  links: z.array(linkSchema).default([]),
  screenshots: z.array(screenshotSchema).default([]),
  teamId: z.string().min(1),
  projectId: z.string().optional(),
  assigneeId: z.string().optional(),
  jiraTicketId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  environment: z.string().optional(),
})

export const updateIssueSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  promptSteps: z.array(promptStepSchema).optional(),
  nextPromptList: z.array(z.string()).optional(),
  links: z.array(linkSchema).optional(),
  screenshots: z.array(screenshotSchema).optional(),
  projectId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  status: z.enum(['open', 'in_progress', 'completed', 'closed']).optional(),
  jiraTicketId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  environment: z.string().nullable().optional(),
})

export const createCommentSchema = z.object({
  content: z.string().min(1).max(10000),
})

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  teamIds: z.array(z.string()).default([]),
  description: z.string().optional(),
  environments: z.array(z.string()).optional(),
})

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  environments: z.array(z.string()).optional(),
})

export const addTeamToProjectSchema = z.object({
  teamId: z.string().min(1),
})
