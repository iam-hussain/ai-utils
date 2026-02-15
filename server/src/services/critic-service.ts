import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { getCriticModel } from './llm-service'
import { AgentRun, type IAgentRun, type ICriticResult } from '../models/AgentRun'
import { CRITIC_AGENT_PROMPT } from '../prompts/critic'
import { logger } from '../lib/logger'

function extractJsonFromResponse(content: string): Record<string, unknown> | null {
  const match = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = match ? match[1]!.trim() : content.trim()
  try {
    return JSON.parse(jsonStr) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function runCriticOnRun(runId: string, userId: string): Promise<IAgentRun | null> {
  const run = await AgentRun.findOne({ _id: runId, userId })
  if (!run) return null

  const allSteps = run.steps ?? []
  const steps = allSteps.filter((s) => s.status === 'complete' && (s.output || s.observation))
  if (steps.length < 2) {
    allSteps.forEach((s) => {
      s.criticResult = { contradictions: [], severity: 'low' }
    })
    await run.save()
    return run
  }

  const model = getCriticModel()
  const stepsSummary = steps
    .map(
      (s, i) =>
        `Step ${i + 1} (${s.agentId}):\nObservation: ${s.observation ?? 'N/A'}\nOutput: ${JSON.stringify(s.output ?? {})}`
    )
    .join('\n\n')

  try {
    const response = await model.invoke([
      new SystemMessage(CRITIC_AGENT_PROMPT),
      new HumanMessage(
        `Analyze these agent steps for contradictions:\n\n${stepsSummary}\n\nRespond with JSON only.`
      ),
    ])
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content)
    const parsed = extractJsonFromResponse(content)
    const contradictions = (parsed?.contradictions as string[]) ?? []
    const severity = (parsed?.severity as 'low' | 'medium' | 'high') ?? 'low'

    const result: ICriticResult = { contradictions, severity }

    run.steps?.forEach((s, i) => {
      const hasIssue = contradictions.some((c) => c.toLowerCase().includes(`step ${i + 1}`))
      s.criticResult = hasIssue ? { ...result, stepIndex: i } : { contradictions: [], severity: 'low', stepIndex: i }
    })
    await run.save()
    return run
  } catch (err) {
    logger.error('Critic run failed', { error: err, runId })
    return null
  }
}
