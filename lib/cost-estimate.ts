const COST_PER_1K: Record<string, { input: number; output: number }> = {
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
}

export function estimateCost(
  provider: string,
  modelName: string,
  tokensIn: number,
  tokensOut: number
): number {
  const rates =
    COST_PER_1K[modelName] ??
    (provider === 'openai' ? COST_PER_1K['gpt-4o-mini'] : provider === 'anthropic' ? COST_PER_1K['claude-3-5-sonnet-20241022'] : COST_PER_1K['gemini-1.5-pro'])
  return (tokensIn / 1000) * rates.input + (tokensOut / 1000) * rates.output
}
