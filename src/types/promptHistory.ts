import type { AIFunctionId } from './settings';

export interface PromptHistoryEntry {
  id: string;
  functionId: AIFunctionId;
  prompt: string;
  timestamp: number;
  source: 'edit' | 'reset' | 'optimize' | 'sync';
  label?: string;
}
