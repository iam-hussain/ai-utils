import { describe, it, expect } from 'vitest'
import {
  sendMessageSchema,
  testPromptMessageSchema,
  mcpCallToolSchema,
  mcpConnectSchema,
} from './schemas'

describe('sendMessageSchema', () => {
  it('accepts valid payload', () => {
    const result = sendMessageSchema.safeParse({
      roomId: 'room-1',
      message: 'Hello',
      type: 'human',
    })
    expect(result.success).toBe(true)
  })

  it('accepts payload with history', () => {
    const result = sendMessageSchema.safeParse({
      roomId: 'room-1',
      message: 'Follow up',
      type: 'human',
      history: [{ content: 'Hi', type: 'human' }, { content: 'Hey', type: 'ai' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing roomId', () => {
    const result = sendMessageSchema.safeParse({
      message: 'Hello',
      type: 'human',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid type', () => {
    const result = sendMessageSchema.safeParse({
      roomId: 'room-1',
      message: 'Hello',
      type: 'invalid',
    })
    expect(result.success).toBe(false)
  })
})

describe('testPromptMessageSchema', () => {
  it('accepts messages array', () => {
    const result = testPromptMessageSchema.safeParse({
      messages: [{ type: 'human', content: 'Hi' }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts prompt + type', () => {
    const result = testPromptMessageSchema.safeParse({
      prompt: 'Hello',
      type: 'human',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty payload', () => {
    const result = testPromptMessageSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('mcpCallToolSchema', () => {
  it('accepts url + toolName', () => {
    const result = mcpCallToolSchema.safeParse({
      toolName: 'test_tool',
      url: 'https://example.com/mcp',
    })
    expect(result.success).toBe(true)
  })

  it('accepts command + args + toolName', () => {
    const result = mcpCallToolSchema.safeParse({
      toolName: 'test_tool',
      command: 'npx',
      args: ['-y', 'mcp-server'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing toolName', () => {
    const result = mcpCallToolSchema.safeParse({
      url: 'https://example.com',
    })
    expect(result.success).toBe(false)
  })
})

describe('mcpConnectSchema', () => {
  it('accepts url', () => {
    const result = mcpConnectSchema.safeParse({
      url: 'https://example.com/mcp',
    })
    expect(result.success).toBe(true)
  })

  it('accepts command + args', () => {
    const result = mcpConnectSchema.safeParse({
      command: 'npx',
      args: ['-y', 'mcp-server'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty payload', () => {
    const result = mcpConnectSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
