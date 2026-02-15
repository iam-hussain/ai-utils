import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import { META_AGENT_ARCHITECT_PROMPT, SUPERVISOR_AGENT_PROMPT } from '../prompts/meta-agent'
import { AgentRun, type IAgentRun, type IAgentStep, type IAgentDefinition } from '../models/AgentRun'
import { getModel, MODEL_NAMES, type LLMProvider } from './llm-service'
import { estimateCost } from '../lib/cost-estimate'
import { generateTitleFromGoal } from './title-generator'
import { logger } from '../lib/logger'

function extractJsonFromResponse(content: string): Record<string, unknown> | null {
  const tryParse = (str: string): Record<string, unknown> | null => {
    try {
      const p = JSON.parse(str.trim()) as Record<string, unknown>
      return p && typeof p === 'object' ? p : null
    } catch {
      return null
    }
  }
  const codeBlockRe = /```(?:json)?\s*([\s\S]*?)```/g
  let m
  let lastBlock = ''
  while ((m = codeBlockRe.exec(content)) !== null) {
    lastBlock = m[1] ?? ''
  }
  if (lastBlock) {
    const p = tryParse(lastBlock)
    if (p) return p
  }
  const braceStart = content.indexOf('{')
  if (braceStart >= 0) {
    let depth = 0
    let end = -1
    for (let i = braceStart; i < content.length; i++) {
      if (content[i] === '{') depth++
      if (content[i] === '}') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    if (end > braceStart) {
      const p = tryParse(content.slice(braceStart, end + 1))
      if (p) return p
    }
  }
  const p = tryParse(content)
  return p
}

function topologicalSort(agents: IAgentDefinition[]): IAgentDefinition[] {
  const byId = new Map(agents.map((a) => [a.id, a]))
  const visited = new Set<string>()
  const result: IAgentDefinition[] = []

  function visit(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    const agent = byId.get(id)
    if (!agent) return
    for (const dep of agent.dependencies ?? []) {
      visit(dep)
    }
    result.push(agent)
  }

  for (const agent of agents) {
    visit(agent.id)
  }
  return result
}

export interface RunAgentOptions {
  runId: string
  userId: string
  userGoal: string
  llmProvider: LLMProvider
  onStep?: (step: IAgentStep) => void
  forkedFromRunId?: string
  forkedAtStepIndex?: number
  editedAgentId?: string
  editedPrompt?: string
  resumeFromPaused?: boolean
  userHint?: string
  designOnly?: boolean
}

export async function runAgentWorkflow(options: RunAgentOptions): Promise<IAgentRun> {
  const { runId, userId, userGoal, llmProvider, onStep, forkedFromRunId, forkedAtStepIndex, editedAgentId, editedPrompt, resumeFromPaused, userHint, designOnly } = options
  const run = await AgentRun.findById(runId)
  if (!run) throw new Error('Agent run not found')

  const model = getModel(llmProvider)

  try {
    let agents: IAgentDefinition[]
    let sortedAgents: IAgentDefinition[]
    const outputByAgent = new Map<string, Record<string, unknown>>()

    if (forkedFromRunId && forkedAtStepIndex !== undefined) {
      const parentRun = await AgentRun.findOne({ _id: forkedFromRunId, userId }).lean()
      if (!parentRun?.agentDefinitions?.length || !parentRun.steps?.length) {
        run.status = 'failed'
        run.error = 'Fork source run not found or has no agents'
        await run.save()
        return run
      }
      agents = (run.agentDefinitions?.length ? run.agentDefinitions : parentRun.agentDefinitions).map((a) =>
        editedAgentId === a.id && editedPrompt ? { ...a, prompt: editedPrompt } : a
      )
      sortedAgents = topologicalSort(agents)
      run.agentDefinitions = agents
      run.status = 'running'
      for (let i = 0; i < forkedAtStepIndex && i < parentRun.steps.length; i++) {
        const s = parentRun.steps[i]!
        if (s.output) outputByAgent.set(s.agentId, s.output)
      }
      const steps: IAgentStep[] = agents.map((a, i) => {
        const existing = parentRun.steps[i]
        if (i < forkedAtStepIndex && existing?.status === 'complete') {
          return { ...existing, agentId: a.id, agentName: a.id }
        }
        return { agentId: a.id, agentName: a.id, status: 'pending' as const }
      })
      run.steps = steps
      await run.save()
    } else if ((run as { status: string }).status === 'draft' && run.agentDefinitions?.length) {
      agents = run.agentDefinitions
      sortedAgents = topologicalSort(agents)
      run.status = 'running'
      run.steps = agents.map((a) => ({ agentId: a.id, agentName: a.id, status: 'pending' as const }))
      await run.save()
    } else {
      run.status = 'designing'
      await run.save()

      const creatorMessages = [
        new SystemMessage(META_AGENT_ARCHITECT_PROMPT),
        new HumanMessage(`User goal: ${userGoal}\n\nDesign the agent team and output the JSON configuration.`),
      ]
      const creatorResponse = await model.invoke(creatorMessages)
      const creatorContent = typeof creatorResponse.content === 'string' ? creatorResponse.content : JSON.stringify(creatorResponse.content)
      const parsed = extractJsonFromResponse(creatorContent)

      let rawAgents = parsed?.agents
      if (!rawAgents || !Array.isArray(rawAgents)) {
        rawAgents = parsed?.agent as Array<Record<string, unknown>>
      }
      if (!rawAgents || !Array.isArray(rawAgents)) {
        run.status = 'failed'
        run.error = `Creator agent did not return valid JSON with agents array. Got: ${parsed ? JSON.stringify(Object.keys(parsed)) : 'null'}. Raw content (first 500 chars): ${creatorContent.slice(0, 500)}`
        await run.save()
        return run
      }

      const rawAgentsTyped = rawAgents as Array<Record<string, unknown>>
      agents = rawAgentsTyped.map((a) => ({
        id: String(a.id ?? a.agent_id ?? ''),
        prompt: String(a.prompt ?? ''),
        tools: Array.isArray(a.tools) ? (a.tools as string[]) : undefined,
        inputSource: a.inputSource ?? a.input_source ? String(a.inputSource ?? a.input_source) : undefined,
        nextStep: a.nextStep ?? a.next_step ? String(a.nextStep ?? a.next_step) : undefined,
        dependencies: Array.isArray(a.dependencies) ? (a.dependencies as string[]) : undefined,
      }))
      const creatorTitle = (parsed?.project_name as string)?.trim()
      const needsTitle = !creatorTitle || creatorTitle === 'Untitled' || creatorTitle === 'untitled'
      run.projectName = needsTitle ? await generateTitleFromGoal(userGoal) : creatorTitle.replace(/_/g, ' ')
      run.agentDefinitions = agents
      const mb = parsed?.mission_brief as Record<string, unknown> | undefined
      if (mb && typeof mb === 'object') {
        run.missionBrief = {
          summary: typeof mb.summary === 'string' ? mb.summary : undefined,
          inputs: Array.isArray(mb.inputs) ? (mb.inputs as string[]) : undefined,
          stages: Array.isArray(mb.stages) ? (mb.stages as string[]) : undefined,
          successCriteria: Array.isArray(mb.success_criteria) ? (mb.success_criteria as string[]) : Array.isArray(mb.successCriteria) ? (mb.successCriteria as string[]) : undefined,
        }
      }
      const steps: IAgentStep[] = agents.map((a) => ({
        agentId: a.id,
        agentName: a.id,
        status: 'pending',
      }))
      run.steps = steps
      sortedAgents = topologicalSort(agents)
      if (designOnly) {
        run.status = 'draft'
        await run.save()
        return run
      }
      run.status = 'running'
      await run.save()
    }

    const steps = run.steps
    let startIndex = forkedAtStepIndex ?? 0
    if (resumeFromPaused && (run as { status: string }).status === 'paused' && run.pausedAtStepIndex != null) {
      startIndex = run.pausedAtStepIndex
      run.status = 'running'
      run.pausedAtStepIndex = undefined
    }
    const agentsToRun = sortedAgents.slice(startIndex)
    const breakpoints = run.breakpoints ?? []

    for (const agent of agentsToRun) {
      const stepIndex = steps.findIndex((s) => s.agentId === agent.id)
      if (stepIndex < 0) continue

      const step = steps[stepIndex]!
      const shouldPause = breakpoints.some(
        (bp) => bp.type === 'pause_before_step' && bp.stepIndex === stepIndex
      )
      if (shouldPause && !resumeFromPaused) {
        run.status = 'paused'
        run.pausedAtStepIndex = stepIndex
        await run.save()
        return run
      }

      step.status = 'running'
      step.startedAt = new Date()
      await run.save()
      onStep?.(step)

      let inputPayload: Record<string, unknown> = {}
      if (agent.inputSource && outputByAgent.has(agent.inputSource)) {
        inputPayload = outputByAgent.get(agent.inputSource) ?? {}
      } else if (outputByAgent.size === 0) {
        inputPayload = { user_goal: userGoal }
      } else {
        const prevOutputs = sortedAgents
          .slice(0, sortedAgents.indexOf(agent))
          .map((a) => outputByAgent.get(a.id))
          .filter(Boolean) as Record<string, unknown>[]
        inputPayload = Object.assign({}, ...prevOutputs)
      }
      if (userHint) {
        inputPayload = { ...inputPayload, _user_hint: userHint }
      }

      step.input = inputPayload

      const agentMessages = [
        new SystemMessage(SUPERVISOR_AGENT_PROMPT),
        new SystemMessage(`You are agent "${agent.id}". Your instructions:\n\n${agent.prompt}`),
        new HumanMessage(
          `Input for this step:\n${JSON.stringify(inputPayload, null, 2)}${inputPayload._user_hint ? `\n\nUSER HINT (follow this): ${inputPayload._user_hint}` : ''}\n\nProcess this and provide your output. Include Thought, Action, Observation, Reflection in your reasoning. End with a JSON block: {"output": {...}} with the data for the next step.`
        ),
      ]

      try {
        const startTime = Date.now()
        const response = await model.invoke(agentMessages)
        const durationMs = Date.now() - startTime
        step.completedAt = new Date()
        step.durationMs = durationMs

        const usage = (response as { usage_metadata?: { input_tokens?: number; output_tokens?: number } }).usage_metadata
        const tokensIn = usage?.input_tokens ?? 0
        const tokensOut = usage?.output_tokens ?? 0
        if (tokensIn || tokensOut) {
          step.tokensIn = tokensIn
          step.tokensOut = tokensOut
          step.costUsd = estimateCost(llmProvider, MODEL_NAMES[llmProvider], tokensIn, tokensOut)
        }

        const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content)
        const outputMatch = content.match(/\{"output"\s*:\s*(\{[\s\S]*?\})\s*\}/)
        let agentOutput: Record<string, unknown> = {}
        if (outputMatch) {
          try {
            agentOutput = JSON.parse(outputMatch[1]!) as Record<string, unknown>
          } catch {
            agentOutput = { raw: content }
          }
        } else {
          const extracted = extractJsonFromResponse(content)
          agentOutput = (extracted?.output as Record<string, unknown>) ?? { raw: content }
        }

        outputByAgent.set(agent.id, agentOutput)
        step.output = agentOutput
        step.status = 'complete'
        step.observation = JSON.stringify(agentOutput).slice(0, 500)
      } catch (err) {
        step.status = 'failed'
        step.error = err instanceof Error ? err.message : 'Unknown error'
        step.completedAt = new Date()
        run.status = 'failed'
        run.error = step.error
        await run.save()
        onStep?.(step)
        return run
      }

      await run.save()
      onStep?.(step)
    }

    const lastAgent = sortedAgents[sortedAgents.length - 1]
    const finalOutput = lastAgent ? outputByAgent.get(lastAgent.id) : undefined
    run.finalOutput = finalOutput ? JSON.stringify(finalOutput, null, 2) : undefined
    run.status = 'complete'
    await run.save()
  } catch (err) {
    logger.error('Agent workflow failed', { error: err, runId })
    run.status = 'failed'
    run.error = err instanceof Error ? err.message : 'Workflow failed'
    await run.save()
  }

  return run
}
