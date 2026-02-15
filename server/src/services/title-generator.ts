import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { getCriticModel } from './llm-service'
import { logger } from '../lib/logger'

export async function generateTitleFromGoal(userGoal: string): Promise<string> {
  if (!userGoal?.trim()) return 'Untitled'
  try {
    const model = getCriticModel()
    const response = await model.invoke([
      new SystemMessage(
        'You generate short, human-readable titles (2-6 words) for agent run goals. Output ONLY the title, no quotes, no explanation.'
      ),
      new HumanMessage(`Generate a concise title for this goal:\n\n${userGoal.trim()}`),
    ])
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content)
    const title = content.trim().replace(/^["']|["']$/g, '').slice(0, 80)
    return title || 'Untitled'
  } catch (err) {
    logger.error('Title generation failed', { error: err })
    return 'Untitled'
  }
}
