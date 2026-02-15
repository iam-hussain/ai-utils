import { BaseMessage } from '@langchain/core/messages'
import { StateGraph, MessagesAnnotation, START, END } from '@langchain/langgraph'
import { getModel, type LLMProvider } from '../services/llm-service'

export interface AgentState {
    messages: BaseMessage[]
}

function createCallModel(provider: LLMProvider) {
    return async function callModel(state: AgentState) {
        const messages = state.messages
        const model = getModel(provider)
        const response = await model.invoke(messages)
        return { messages: [response] }
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- LangGraph compile() return type is complex
const graphCache = new Map<LLMProvider, any>()

export function createGraph(provider: LLMProvider = 'openai') {
  const cached = graphCache.get(provider)
  if (cached) return cached
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode('agent', createCallModel(provider))
    .addEdge(START, 'agent')
    .addEdge('agent', END)
  const compiled = workflow.compile()
  graphCache.set(provider, compiled)
  return compiled
}

export const graph = createGraph('openai')
export { getModel } from '../services/llm-service'
export type { LLMProvider } from '../services/llm-service'
