import { githubService } from '@/services/github'
import { useSettingsStore } from '@/stores/settingsStore'
import type { Glossary } from '@/types/glossary'

export const BACKUP_APP_ID = 'buddhist-translator'
export const BACKUP_VERSION = 1

const BT_PREFIX = 'bt-'

/**
 * Kept out of the default export. `bt-notion-token` belongs here too — it is a
 * Notion integration secret, and leaving it out of this list meant the "no API
 * keys" export quietly shipped it.
 */
export const SENSITIVE_KEYS = ['bt-apikeys', 'bt-github-token', 'bt-notion-token']

/** Extensions we can round-trip as text. Anything else is recorded but not fetched. */
const TEXT_EXTENSIONS = ['.md', '.json', '.txt', '.html', '.htm', '.csv', '.yml', '.yaml', '.xml']

/** The Contents API truncates above 1MB; glossary.json is fetched separately via the Blob API. */
const MAX_FILE_BYTES = 1_000_000

export interface BackupFile {
  app: string
  version: number
  created_at: string
  source: { owner: string; repo: string; branch: string } | null
  /** localStorage entries, verbatim (values are the stored JSON strings). */
  settings: Record<string, string>
  includes_secrets: boolean
  articles: { path: string; sha: string; content: string }[]
  glossary: Glossary | null
  /** config.json, translation_logs.json, README.md, research/** … */
  files: { path: string; content: string }[]
  skipped: { path: string; reason: string }[]
}

export interface BackupProgress {
  done: number
  total: number
  label: string
}

export function collectSettings(includeSensitive: boolean): Record<string, string> {
  const result: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(BT_PREFIX)) continue
    if (!includeSensitive && SENSITIVE_KEYS.includes(key)) continue
    const value = localStorage.getItem(key)
    if (value !== null) result[key] = value
  }
  return result
}

function isTextFile(path: string): boolean {
  const lower = path.toLowerCase()
  return TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

interface CreateBackupOptions {
  includeSensitive: boolean
  /** Skip the GitHub round-trip entirely (settings-only backup). */
  includeRepo: boolean
  onProgress?: (progress: BackupProgress) => void
  signal?: AbortSignal
}

/**
 * Snapshot of everything the app owns: local settings plus, optionally, every
 * text file in the GitHub repo (articles, glossary, config, logs, research).
 *
 * Files are fetched one at a time with a yield in between: a repo with hundreds
 * of articles would otherwise freeze the tab and burst against the API.
 */
export async function createFullBackup(opts: CreateBackupOptions): Promise<BackupFile> {
  const { owner, repo } = useSettingsStore.getState().getGitHubRepo()
  const branch = useSettingsStore.getState().githubBranch

  const backup: BackupFile = {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    created_at: new Date().toISOString(),
    source: opts.includeRepo && owner && repo ? { owner, repo, branch } : null,
    settings: collectSettings(opts.includeSensitive),
    includes_secrets: opts.includeSensitive,
    articles: [],
    glossary: null,
    files: [],
    skipped: [],
  }

  if (!opts.includeRepo) return backup
  if (!owner || !repo) throw new Error('尚未設定 GitHub 儲存庫，無法備份文章與術語表。')

  opts.onProgress?.({ done: 0, total: 0, label: '讀取檔案清單…' })
  const allFiles = await githubService.listAllFiles()

  // glossary.json goes through loadGlossary() so it uses the >1MB Blob API fallback.
  const targets = allFiles.filter((f) => f.path !== 'glossary.json')
  const total = targets.length + 1 // +1 for the glossary
  let done = 0

  const tick = (label: string) => {
    done++
    opts.onProgress?.({ done, total, label })
  }

  for (const file of targets) {
    if (opts.signal?.aborted) throw new Error('備份已取消')

    if (!isTextFile(file.path)) {
      backup.skipped.push({ path: file.path, reason: '非文字檔（如圖片）' })
      tick(file.path)
      continue
    }
    if (file.size > MAX_FILE_BYTES) {
      backup.skipped.push({ path: file.path, reason: '超過 1MB，GitHub Contents API 無法完整取回' })
      tick(file.path)
      continue
    }

    try {
      const { content } = await githubService.getFile(file.path)
      if (file.path.startsWith('translations/') && file.path.endsWith('.md')) {
        backup.articles.push({ path: file.path, sha: file.sha, content })
      } else {
        backup.files.push({ path: file.path, content })
      }
    } catch (err) {
      backup.skipped.push({
        path: file.path,
        reason: err instanceof Error ? err.message : '讀取失敗',
      })
    }
    tick(file.path)
    // Yield so the progress UI repaints and the tab stays responsive.
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  if (opts.signal?.aborted) throw new Error('備份已取消')
  try {
    backup.glossary = await githubService.loadGlossary()
  } catch (err) {
    backup.skipped.push({
      path: 'glossary.json',
      reason: err instanceof Error ? err.message : '讀取失敗',
    })
  }
  tick('glossary.json')

  return backup
}

export type ParsedBackup =
  | { kind: 'full'; backup: BackupFile }
  /** Pre-v1 export: a flat `{ "bt-key": "value" }` map with no envelope. */
  | { kind: 'legacy'; settings: Record<string, string> }

export function parseBackup(text: string): ParsedBackup {
  const data: unknown = JSON.parse(text)
  if (!data || typeof data !== 'object') throw new Error('檔案格式錯誤')

  const obj = data as Record<string, unknown>
  if (obj.app === BACKUP_APP_ID && typeof obj.version === 'number') {
    if (obj.version > BACKUP_VERSION) {
      throw new Error(`備份檔版本 ${obj.version} 較新，請先更新此應用程式`)
    }
    return { kind: 'full', backup: obj as unknown as BackupFile }
  }

  const settings: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith(BT_PREFIX) && typeof value === 'string') settings[key] = value
  }
  if (Object.keys(settings).length === 0) throw new Error('檔案格式錯誤')
  return { kind: 'legacy', settings }
}

/** Writes settings back to localStorage. Repo content in a backup is read-only. */
export function restoreSettings(settings: Record<string, string>): number {
  let count = 0
  for (const [key, value] of Object.entries(settings)) {
    if (!key.startsWith(BT_PREFIX) || typeof value !== 'string') continue
    try {
      localStorage.setItem(key, value)
      count++
    } catch {
      // Quota exceeded — keep going so the smaller entries still land.
    }
  }
  return count
}

export function downloadBackup(backup: BackupFile, filename: string): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
