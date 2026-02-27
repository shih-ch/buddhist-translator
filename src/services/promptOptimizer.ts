import { loadLogs, type TranslationLog } from './translationLogger';
import { callFunction } from './ai/router';
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { AIMessage } from './ai/types';
import type { AIFunctionId } from '@/types/settings';

export interface OptimizationResult {
  analysis: string;
  suggestedPrompt: string;
  correctionCount: number;
  logCount: number;
}

/**
 * Analyze translation logs and suggest prompt improvements.
 */
export async function optimizePrompt(functionId: AIFunctionId): Promise<OptimizationResult> {
  const logs = await loadLogs();

  // Filter logs for this function
  const relevantLogs = logs.filter((l) => l.function === functionId && l.corrections.length > 0);

  if (relevantLogs.length === 0) {
    throw new Error('沒有找到包含修正記錄的翻譯日誌。請先進行一些翻譯並做修正後再嘗試優化。');
  }

  // Build correction summary
  const correctionSummary = buildCorrectionSummary(relevantLogs);

  const currentPrompt = useAIFunctionsStore.getState().getFunctionConfig(functionId).prompt;
  const fnConfig = useAIFunctionsStore.getState().getFunctionConfig(functionId);
  const apiKeys = useSettingsStore.getState().apiKeys;

  const messages: AIMessage[] = [
    {
      role: 'system',
      content: `你是一位 AI prompt 工程專家。你的任務是根據使用者的修正記錄來改善翻譯 prompt。

分析使用者過去對翻譯結果做過的修正，找出 prompt 中可以改善的地方，然後產生一個改良版的 prompt。

要求：
1. 保留原 prompt 的結構和風格
2. 只在必要的地方做修改或增加說明
3. 將反覆出現的修正模式整合到 prompt 中
4. 不要大幅重寫，而是精準調整

輸出格式必須是 JSON：
{
  "analysis": "分析摘要（2-5 點重要發現）",
  "suggested_prompt": "完整的改良版 prompt"
}
只回覆 JSON，不要加其他說明。`,
    },
    {
      role: 'user',
      content: `【目前的 Prompt】
${currentPrompt}

【使用者修正記錄摘要】（共 ${relevantLogs.length} 次翻譯，${correctionSummary.totalCorrections} 次修正）

${correctionSummary.text}`,
    },
  ];

  const response = await callFunction(fnConfig, apiKeys, messages);

  // Parse response
  let jsonStr = response.content.trim();
  const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1].trim();

  const parsed = JSON.parse(jsonStr) as {
    analysis: string;
    suggested_prompt: string;
  };

  return {
    analysis: parsed.analysis,
    suggestedPrompt: parsed.suggested_prompt,
    correctionCount: correctionSummary.totalCorrections,
    logCount: relevantLogs.length,
  };
}

function buildCorrectionSummary(logs: TranslationLog[]): { text: string; totalCorrections: number } {
  const byType: Record<string, string[]> = {};
  let total = 0;

  for (const log of logs) {
    for (const correction of log.corrections) {
      total++;
      const type = correction.type || 'other';
      if (!byType[type]) byType[type] = [];
      // Keep recent and distinct corrections (cap at 5 per type)
      if (byType[type].length < 5) {
        byType[type].push(correction.instruction);
      }
    }
  }

  const typeLabels: Record<string, string> = {
    terminology: '術語問題',
    style: '文風/語氣',
    missing: '遺漏內容',
    structure: '結構/排版',
    other: '其他修正',
  };

  const sections = Object.entries(byType).map(([type, instructions]) => {
    const label = typeLabels[type] || type;
    return `### ${label}（${instructions.length} 次）\n${instructions.map((i) => `- ${i}`).join('\n')}`;
  });

  return { text: sections.join('\n\n'), totalCorrections: total };
}
