import { BaseMessage } from '@langchain/core/messages'
import { StateGraph, END } from '@langchain/langgraph'
import { getModel, type LLMProvider } from '../services/llm-service'

interface AgentState {
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

export function createGraph(provider: LLMProvider = 'openai') {
  const workflow = new StateGraph<AgentState>({
    channels: {
      messages: {
        value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
        default: () => [],
      },
    },
  })
  workflow.addNode('agent', createCallModel(provider))
  workflow.setEntryPoint('agent')
  workflow.addEdge('agent', END)
  return workflow.compile()
}

export const graph = createGraph('openai')
export { getModel } from '../services/llm-service'
export type { LLMProvider } from '../services/llm-service'
