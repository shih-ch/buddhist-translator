import { githubService } from './github'

export interface TranslationLog {
  date: string
  article: string
  function: string
  provider: string
  model: string
  params: Record<string, unknown>
  rounds: number
  corrections: Array<{
    type: 'terminology' | 'style' | 'missing' | 'structure' | 'other'
    instruction: string
  }>
}

/**
 * Append a translation log entry and save to GitHub.
 */
export async function logTranslation(log: TranslationLog): Promise<void> {
  const logs = await loadLogs()
  logs.push(log)
  await githubService.saveTranslationLogs(logs)
}

/**
 * Load all translation logs from GitHub.
 */
export async function loadLogs(): Promise<TranslationLog[]> {
  return githubService.loadTranslationLogs()
}
