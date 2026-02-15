import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'

export type LLMProvider = 'openai' | 'anthropic' | 'google'

const temperature = parseFloat(process.env.OPENAI_TEMPERATURE ?? '0') || 0

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
const CRITIC_MODEL = process.env.CRITIC_MODEL || 'gpt-4o-mini'
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
const GOOGLE_MODEL = process.env.GOOGLE_MODEL || 'gemini-1.5-pro'

function createOpenAIModel(): BaseChatModel {
  return new ChatOpenAI({
    modelName: OPENAI_MODEL,
    temperature,
    streaming: true,
  })
}

function createAnthropicModel(): BaseChatModel {
  return new ChatAnthropic({
    model: ANTHROPIC_MODEL,
    temperature,
    streaming: true,
  })
}

function createGoogleModel(): BaseChatModel {
  return new ChatGoogleGenerativeAI({
    model: GOOGLE_MODEL,
    temperature,
    streaming: true,
  })
}

function createCriticModel(): BaseChatModel {
  return new ChatOpenAI({
    modelName: CRITIC_MODEL,
    temperature: 0,
    streaming: false,
  })
}

export function getCriticModel(): BaseChatModel {
  return createCriticModel()
}

export function getModel(provider: LLMProvider = 'openai'): BaseChatModel {
  switch (provider) {
    case 'anthropic':
      return createAnthropicModel()
    case 'google':
      return createGoogleModel()
    case 'openai':
    default:
      return createOpenAIModel()
  }
}

export const MODEL_NAMES: Record<LLMProvider, string> = {
  openai: OPENAI_MODEL,
  anthropic: ANTHROPIC_MODEL,
  google: GOOGLE_MODEL,
}

export const LLM_OPTIONS: { value: LLMProvider; label: string }[] = [
  { value: 'openai', label: `OpenAI (${OPENAI_MODEL})` },
  { value: 'anthropic', label: `Anthropic Claude (${ANTHROPIC_MODEL})` },
  { value: 'google', label: `Google Gemini (${GOOGLE_MODEL})` },
]
