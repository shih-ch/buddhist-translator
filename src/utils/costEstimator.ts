import type { AIModel } from '../services/ai/types';

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

/**
 * Calculate cost based on token counts and model pricing.
 * Prices in AIModel are per 1M tokens.
 */
export function calculateCost(
  model: AIModel,
  promptTokens: number,
  completionTokens: number
): CostBreakdown {
  const inputCost = (promptTokens / 1_000_000) * model.inputPrice;
  const outputCost = (completionTokens / 1_000_000) * model.outputPrice;
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}

/**
 * Format a dollar amount for display.
 * - Below $0.01: "< $0.01"
 * - Otherwise: "$X.XXXX" (4 decimal places)
 */
export function formatCost(amount: number): string {
  if (amount <= 0) return '$0.00';
  if (amount < 0.01) return '< $0.01';
  return `$${amount.toFixed(4)}`;
}

/**
 * Calculate cumulative cost for a series of API responses.
 */
export function calculateCumulativeCost(
  model: AIModel,
  responses: Array<{ prompt_tokens: number; completion_tokens: number }>
): CostBreakdown {
  let totalInput = 0;
  let totalOutput = 0;
  for (const r of responses) {
    totalInput += r.prompt_tokens;
    totalOutput += r.completion_tokens;
  }
  return calculateCost(model, totalInput, totalOutput);
}
