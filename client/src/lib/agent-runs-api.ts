import { apiUrl, apiConfig } from './api'

export interface CriticResult {
  contradictions: string[]
  severity: 'low' | 'medium' | 'high'
  stepIndex?: number
}

export interface AgentStep {
  agentId: string
  agentName?: string
  status: 'pending' | 'running' | 'complete' | 'failed'
  thought?: string
  action?: string
  observation?: string
  reflection?: string
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  startedAt?: string
  completedAt?: string
  criticResult?: CriticResult
  tokensIn?: number
  tokensOut?: number
  durationMs?: number
  costUsd?: number
}

export interface AgentAnalytics {
  agentId: string
  totalRuns: number
  successRate: number
  avgCostUsd: string
  avgDurationSec: string
}

export interface AgentDefinition {
  id: string
  prompt: string
  tools?: string[]
  inputSource?: string
  nextStep?: string
  dependencies?: string[]
}

export interface AgentRunSummary {
  id: string
  projectName: string
  userGoal: string
  status: 'designing' | 'draft' | 'running' | 'complete' | 'failed' | 'paused'
  createdAt: string
  forkedFromRunId?: string
  ghostOfRunId?: string
}

export interface AgentRunDetail extends AgentRunSummary {
  agentDefinitions?: AgentDefinition[]
  steps: AgentStep[]
  finalOutput?: string
  error?: string
  llmProvider?: string
  updatedAt?: string
  forkedAtStepIndex?: number
  missionBrief?: { summary?: string; inputs?: string[]; stages?: string[]; successCriteria?: string[] }
  breakpoints?: { type: string; stepIndex?: number }[]
  pausedAtStepIndex?: number
  userHint?: string
}

export interface ForkRunOptions {
  stepIndex: number
  editedAgentId?: string
  editedPrompt?: string
}

export async function getAgentAnalytics(): Promise<AgentAnalytics[]> {
  const res = await fetch(apiUrl('/api/agent-runs/analytics'), {
    ...apiConfig.defaultOptions,
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to get analytics')
  return res.json()
}

export async function listAgentRuns(): Promise<AgentRunSummary[]> {
  const res = await fetch(apiUrl('/api/agent-runs'), {
    ...apiConfig.defaultOptions,
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to list agent runs')
  return res.json()
}

export async function listGhostRuns(liveRunId: string): Promise<AgentRunSummary[]> {
  const res = await fetch(apiUrl(`/api/agent-runs/${liveRunId}/ghosts`), {
    ...apiConfig.defaultOptions,
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to list ghost runs')
  return res.json()
}

export async function getAgentRun(id: string): Promise<AgentRunDetail> {
  const res = await fetch(apiUrl(`/api/agent-runs/${id}`), {
    ...apiConfig.defaultOptions,
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to get agent run')
  return res.json()
}

export async function createAgentRun(userGoal: string, llmProvider = 'openai'): Promise<AgentRunSummary> {
  const res = await fetch(apiUrl('/api/agent-runs'), {
    method: 'POST',
    ...apiConfig.defaultOptions,
    credentials: 'include',
    body: JSON.stringify({ userGoal, llmProvider }),
  })
  if (!res.ok) throw new Error('Failed to create agent run')
  return res.json()
}

export async function createGhostRun(
  id: string,
  agentId: string,
  newPrompt: string
): Promise<AgentRunSummary & { ghostOfRunId?: string }> {
  const res = await fetch(apiUrl(`/api/agent-runs/${id}/ghost`), {
    method: 'POST',
    ...apiConfig.defaultOptions,
    credentials: 'include',
    body: JSON.stringify({ agentId, newPrompt }),
  })
  if (!res.ok) throw new Error('Failed to create ghost run')
  return res.json()
}

export async function resumeAgentRun(runId: string, userHint: string): Promise<{ ok: boolean; status: string }> {
  const res = await fetch(apiUrl(`/api/agent-runs/${runId}/resume`), {
    method: 'POST',
    ...apiConfig.defaultOptions,
    credentials: 'include',
    body: JSON.stringify({ userHint }),
  })
  if (!res.ok) throw new Error('Failed to resume run')
  return res.json()
}

export async function deleteAgentRun(runId: string): Promise<{ ok: boolean }> {
  const res = await fetch(apiUrl(`/api/agent-runs/${runId}`), {
    method: 'DELETE',
    ...apiConfig.defaultOptions,
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to delete run')
  return res.json()
}

export async function updateAgentRunTitle(runId: string, projectName: string): Promise<{ projectName: string }> {
  const res = await fetch(apiUrl(`/api/agent-runs/${runId}`), {
    method: 'PATCH',
    ...apiConfig.defaultOptions,
    credentials: 'include',
    body: JSON.stringify({ projectName }),
  })
  if (!res.ok) throw new Error('Failed to update title')
  return res.json()
}

export async function generateAgentRunTitle(runId: string): Promise<{ projectName: string }> {
  const res = await fetch(apiUrl(`/api/agent-runs/${runId}/generate-title`), {
    method: 'POST',
    ...apiConfig.defaultOptions,
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to generate title')
  return res.json()
}

export async function designAgentRun(runId: string): Promise<{ ok: boolean; status: string }> {
  const res = await fetch(apiUrl(`/api/agent-runs/${runId}/design`), {
    method: 'POST',
    ...apiConfig.defaultOptions,
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to design')
  return res.json()
}

export async function updateAgentDefinitions(
  runId: string,
  agentDefinitions: AgentDefinition[]
): Promise<{ agentDefinitions: AgentDefinition[] }> {
  const res = await fetch(apiUrl(`/api/agent-runs/${runId}/agent-definitions`), {
    method: 'PATCH',
    ...apiConfig.defaultOptions,
    credentials: 'include',
    body: JSON.stringify({ agentDefinitions }),
  })
  if (!res.ok) throw new Error('Failed to update agent definitions')
  return res.json()
}

export async function runCritic(runId: string): Promise<{ ok: boolean; steps?: { agentId: string; criticResult?: CriticResult }[] }> {
  const res = await fetch(apiUrl(`/api/agent-runs/${runId}/run-critic`), {
    method: 'POST',
    ...apiConfig.defaultOptions,
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to run critic')
  return res.json()
}

export async function promoteGhostToLive(liveId: string, ghostId: string): Promise<{ ok: boolean }> {
  const res = await fetch(apiUrl(`/api/agent-runs/${liveId}/promote-ghost/${ghostId}`), {
    method: 'POST',
    ...apiConfig.defaultOptions,
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to promote ghost')
  return res.json()
}

export async function forkAgentRun(
  id: string,
  options: ForkRunOptions
): Promise<AgentRunSummary & { forkedFromRunId?: string; forkedAtStepIndex?: number }> {
  const res = await fetch(apiUrl(`/api/agent-runs/${id}/fork`), {
    method: 'POST',
    ...apiConfig.defaultOptions,
    credentials: 'include',
    body: JSON.stringify(options),
  })
  if (!res.ok) throw new Error('Failed to fork run')
  return res.json()
}

export async function executeAgentRun(
  id: string,
  llmProvider?: string,
  options?: { editedAgentId?: string; editedPrompt?: string; breakpoints?: { type: string; stepIndex?: number }[] }
): Promise<{ ok: boolean; status: string }> {
  const res = await fetch(apiUrl(`/api/agent-runs/${id}/execute`), {
    method: 'POST',
    ...apiConfig.defaultOptions,
    credentials: 'include',
    body: JSON.stringify({ llmProvider, breakpoints: options?.breakpoints, ...options }),
  })
  if (!res.ok) throw new Error('Failed to execute agent run')
  return res.json()
}
