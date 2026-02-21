import { apiConfig } from './api'

const { baseUrl, defaultOptions } = apiConfig

export type IssueStatus = 'open' | 'in_progress' | 'completed' | 'closed'

export interface PromptStep {
  promptText: string
  expectedReply?: string
  actualReply?: string
  envStatus: 'working' | 'not_working' | 'unknown'
}

export interface IssueLink {
  url: string
  label?: string
}

export interface IssueScreenshot {
  data?: string
  caption?: string
  mimeType?: string
}

export interface Issue {
  id: string
  title: string
  description: string
  promptSteps: PromptStep[]
  nextPromptList: string[]
  links: IssueLink[]
  screenshots: IssueScreenshot[]
  teamId: string
  projectId: string | null
  reporterId: string
  assigneeId: string | null
  reporterName?: string
  assigneeName?: string | null
  status: IssueStatus
  jiraTicketId: string | null
  tags: string[]
  environment?: string | null
  createdAt: string
  updatedAt: string
}

export interface IssueComment {
  id: string
  content: string
  authorId: string
  authorName?: string
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  teamIds?: string[]
  description?: string
  createdAt: string
  updatedAt: string
}

export interface CreateIssuePayload {
  title: string
  description?: string
  promptSteps?: PromptStep[]
  nextPromptList?: string[]
  links?: IssueLink[]
  screenshots?: IssueScreenshot[]
  teamId: string
  projectId?: string
  assigneeId?: string
  jiraTicketId?: string
  tags?: string[]
  environment?: string
}

export interface UpdateIssuePayload {
  title?: string
  description?: string
  promptSteps?: PromptStep[]
  nextPromptList?: string[]
  links?: IssueLink[]
  screenshots?: IssueScreenshot[]
  projectId?: string | null
  assigneeId?: string | null
  status?: IssueStatus
  jiraTicketId?: string | null
  tags?: string[]
  environment?: string | null
}

export async function fetchIssues(params?: {
  teamId?: string
  projectId?: string
  status?: string
  assigneeId?: string
}): Promise<Issue[]> {
  const search = new URLSearchParams()
  if (params?.teamId) search.set('teamId', params.teamId)
  if (params?.projectId) search.set('projectId', params.projectId)
  if (params?.status) search.set('status', params.status)
  if (params?.assigneeId) search.set('assigneeId', params.assigneeId)
  const qs = search.toString()
  const url = `${baseUrl}/api/issues${qs ? `?${qs}` : ''}`
  const res = await fetch(url, defaultOptions)
  if (res.status === 401) throw new Error('Unauthorized')
  if (!res.ok) throw new Error('Failed to fetch issues')
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function fetchIssue(id: string): Promise<Issue> {
  const res = await fetch(`${baseUrl}/api/issues/${id}`, defaultOptions)
  if (res.status === 404) throw new Error('Issue not found')
  if (res.status === 401) throw new Error('Unauthorized')
  if (!res.ok) throw new Error('Failed to fetch issue')
  const data = await res.json()
  return { ...data, id: data.id ?? data._id ?? id }
}

export async function createIssue(payload: CreateIssuePayload): Promise<Issue> {
  const res = await fetch(`${baseUrl}/api/issues`, {
    ...defaultOptions,
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to create issue')
  }
  return res.json()
}

export async function updateIssue(id: string, payload: UpdateIssuePayload): Promise<Issue> {
  const res = await fetch(`${baseUrl}/api/issues/${id}`, {
    ...defaultOptions,
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to update issue')
  }
  return res.json()
}

export async function deleteIssue(id: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/issues/${id}`, {
    ...defaultOptions,
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to delete issue')
  }
}

export async function fetchIssueComments(issueId: string): Promise<IssueComment[]> {
  const res = await fetch(`${baseUrl}/api/issues/${issueId}/comments`, defaultOptions)
  if (!res.ok) throw new Error('Failed to fetch comments')
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function addIssueComment(issueId: string, content: string): Promise<IssueComment> {
  const res = await fetch(`${baseUrl}/api/issues/${issueId}/comments`, {
    ...defaultOptions,
    method: 'POST',
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to add comment')
  }
  return res.json()
}

export async function fetchProjects(teamId: string): Promise<Project[]> {
  const res = await fetch(`${baseUrl}/api/projects?teamId=${encodeURIComponent(teamId)}`, defaultOptions)
  if (!res.ok) throw new Error('Failed to fetch projects')
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function exportIssue(id: string, format: 'json' | 'csv'): Promise<Blob> {
  const res = await fetch(`${baseUrl}/api/issues/${id}/export?format=${format}`, {
    ...defaultOptions,
  })
  if (!res.ok) throw new Error('Failed to export')
  return res.blob()
}
