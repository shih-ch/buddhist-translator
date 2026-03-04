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

// Serialize log writes to prevent concurrent read-modify-write races
let _logChain = Promise.resolve()

/**
 * Append a translation log entry and save to GitHub.
 */
export async function logTranslation(log: TranslationLog): Promise<void> {
  _logChain = _logChain.then(
    () => doLogTranslation(log),
    () => doLogTranslation(log),
  ).catch((err) => {
    console.error('Failed to save translation log:', err)
  })
  return _logChain
}

async function doLogTranslation(log: TranslationLog): Promise<void> {
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
