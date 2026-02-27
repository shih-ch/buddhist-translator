import { useSettingsStore } from '@/stores/settingsStore'
import type { Article, ArticleSummary } from '@/types/article'
import type { Glossary } from '@/types/glossary'
import type { AppConfig } from '@/types/settings'
import {
  parseMarkdown,
  parseFrontmatterOnly,
  assembleMarkdown,
  generateFilePath,
  toSummary,
} from './markdownUtils'
import { generateReadme } from '@/utils/readmeGenerator'
import type { TranslationLog } from './translationLogger'

// ─── UTF-8 safe base64 helpers ───

function decodeBase64(base64: string): string {
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function encodeBase64(content: string): string {
  const bytes = new TextEncoder().encode(content)
  let binary = ''
  for (const b of bytes) {
    binary += String.fromCharCode(b)
  }
  return btoa(binary)
}

/** Encode path for GitHub API: only encode URL-unsafe ASCII chars, keep Unicode as-is */
function encodePath(path: string): string {
  return path
    .split('/')
    .map((seg) => seg.replace(/[#?% ]/g, (c) => encodeURIComponent(c)))
    .join('/')
}

// ─── Types ───

interface FileEntry {
  name: string
  path: string
  type: 'file' | 'dir'
  sha: string
}

interface ResearchFile {
  name: string
  path: string
  category: string
}

// ─── GitHubService ───

class GitHubService {
  private apiBase = 'https://api.github.com'

  private get token(): string {
    return useSettingsStore.getState().githubToken
  }

  private get owner(): string {
    return useSettingsStore.getState().getGitHubRepo().owner
  }

  private get repo(): string {
    return useSettingsStore.getState().getGitHubRepo().repo
  }

  private get branch(): string {
    return useSettingsStore.getState().githubBranch
  }

  // ─── Low-level API ───

  private async apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github.v3+json',
      ...(options.headers as Record<string, string> ?? {}),
    }
    const res = await fetch(url, { ...options, headers })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`GitHub API ${res.status}: ${body}`)
    }
    return res
  }

  // ─── Basic Operations ───

  async getFile(path: string): Promise<{ content: string; sha: string }> {
    const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${encodePath(path)}?ref=${this.branch}`
    const res = await this.apiFetch(url)
    const data = await res.json()
    return {
      content: decodeBase64(data.content.replace(/\n/g, '')),
      sha: data.sha,
    }
  }

  async listDirectory(path: string): Promise<FileEntry[]> {
    const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${encodePath(path)}?ref=${this.branch}`
    const res = await this.apiFetch(url)
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.map((item: Record<string, unknown>) => ({
      name: item.name as string,
      path: item.path as string,
      type: item.type as 'file' | 'dir',
      sha: item.sha as string,
    }))
  }

  async createOrUpdateFile(
    path: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<{ sha: string }> {
    const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${encodePath(path)}`
    const encoded = encodeBase64(content)

    const attempt = async (currentSha?: string) => {
      const body: Record<string, string> = {
        message,
        content: encoded,
        branch: this.branch,
      }
      if (currentSha) body.sha = currentSha
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      return res
    }

    let res = await attempt(sha)

    // On 409 SHA conflict, re-fetch latest SHA and retry once
    if (res.status === 409) {
      console.warn(`[GitHub] SHA conflict on ${path}, retrying with fresh SHA...`)
      try {
        const latest = await this.getFile(path)
        res = await attempt(latest.sha)
      } catch {
        // File might have been deleted; retry without SHA
        res = await attempt(undefined)
      }
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`GitHub API ${res.status}: ${body}`)
    }

    const data = await res.json()
    return { sha: data.content.sha }
  }

  async deleteFile(path: string, sha: string, message: string): Promise<void> {
    const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${encodePath(path)}`
    await this.apiFetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sha, branch: this.branch }),
    })
  }

  // ─── Translation Operations ───

  async saveTranslation(article: Article): Promise<void> {
    const path = article.path || generateFilePath(article.frontmatter.date, article.frontmatter.title)
    const content = assembleMarkdown(article.frontmatter, article.content, article.originalText)
    const message = article.sha
      ? `Update translation: ${article.frontmatter.title}`
      : `Add translation: ${article.frontmatter.title}`
    await this.createOrUpdateFile(path, content, message, article.sha)
    // Update README after saving
    try {
      await this.updateReadme()
    } catch {
      // Don't fail the save if README update fails
    }
  }

  async loadTranslation(path: string): Promise<Article> {
    const { content: raw, sha } = await this.getFile(path)
    const { frontmatter, content, originalText } = parseMarkdown(raw)
    return { path, frontmatter, content, originalText, sha }
  }

  async listTranslations(): Promise<ArticleSummary[]> {
    const summaries: ArticleSummary[] = []
    try {
      // Use Git Tree API to get proper Unicode paths (Contents API escapes non-ASCII)
      const treeUrl = `${this.apiBase}/repos/${this.owner}/${this.repo}/git/trees/${this.branch}?recursive=1`
      const res = await this.apiFetch(treeUrl)
      const data = await res.json()
      const mdFiles: string[] = (data.tree ?? [])
        .filter((item: { path: string; type: string }) =>
          item.type === 'blob' && item.path.startsWith('translations/') && item.path.endsWith('.md')
        )
        .map((item: { path: string }) => item.path)

      for (const filePath of mdFiles) {
        try {
          const { content } = await this.getFile(filePath)
          const fm = parseFrontmatterOnly(content)
          if (fm) {
            summaries.push(toSummary(filePath, fm))
          }
        } catch (err) {
          console.error(`[listTranslations] failed to read ${filePath}:`, err)
        }
      }
    } catch (err) {
      console.error('[listTranslations] error:', err)
    }
    return summaries.sort((a, b) => b.date.localeCompare(a.date))
  }

  // ─── Glossary Operations ───

  async saveGlossary(glossary: Glossary): Promise<void> {
    const content = JSON.stringify(glossary, null, 2)
    let sha: string | undefined
    try {
      const existing = await this.getFile('glossary.json')
      sha = existing.sha
    } catch {
      // File doesn't exist yet
    }
    await this.createOrUpdateFile('glossary.json', content, 'Update glossary', sha)
  }

  async loadGlossary(): Promise<Glossary> {
    try {
      const { content } = await this.getFile('glossary.json')
      return JSON.parse(content)
    } catch {
      return { version: 1, updated_at: new Date().toISOString(), terms: [] }
    }
  }

  // ─── Config Operations ───

  async saveConfig(config: AppConfig): Promise<void> {
    const content = JSON.stringify(config, null, 2)
    let sha: string | undefined
    try {
      const existing = await this.getFile('config.json')
      sha = existing.sha
    } catch {
      // File doesn't exist yet
    }
    await this.createOrUpdateFile('config.json', content, 'Update config', sha)
  }

  async loadConfig(): Promise<AppConfig | null> {
    try {
      const { content } = await this.getFile('config.json')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  // ─── Translation Logs ───

  async saveTranslationLogs(logs: TranslationLog[]): Promise<void> {
    const content = JSON.stringify(logs, null, 2)
    let sha: string | undefined
    try {
      const existing = await this.getFile('translation_logs.json')
      sha = existing.sha
    } catch {
      // File doesn't exist yet
    }
    await this.createOrUpdateFile('translation_logs.json', content, 'Update translation logs', sha)
  }

  async loadTranslationLogs(): Promise<TranslationLog[]> {
    try {
      const { content } = await this.getFile('translation_logs.json')
      return JSON.parse(content)
    } catch {
      return []
    }
  }

  // ─── README ───

  async updateReadme(): Promise<void> {
    const articles = await this.listTranslations()
    const researchFiles = await this.listResearchFiles()
    const readmeContent = generateReadme(articles, researchFiles, { owner: this.owner, repo: this.repo })
    let sha: string | undefined
    try {
      const existing = await this.getFile('README.md')
      sha = existing.sha
    } catch {
      // File doesn't exist yet
    }
    await this.createOrUpdateFile('README.md', readmeContent, 'Update README', sha)
  }

  async listResearchFiles(): Promise<ResearchFile[]> {
    const result: ResearchFile[] = []
    try {
      const entries = await this.listDirectory('research')
      for (const entry of entries) {
        if (entry.type === 'dir') {
          const subFiles = await this.listDirectory(entry.path)
          for (const sub of subFiles) {
            if (sub.type === 'file') {
              result.push({
                name: sub.name,
                path: sub.path,
                category: entry.name,
              })
            }
          }
        } else if (entry.type === 'file') {
          result.push({
            name: entry.name,
            path: entry.path,
            category: 'other',
          })
        }
      }
    } catch {
      // research/ may not exist
    }
    return result
  }

  // ─── Migration ───

  async migrateRepoStructure(): Promise<void> {
    const rootFiles = await this.listDirectory('')

    for (const file of rootFiles) {
      if (file.type !== 'file') continue
      // Skip known root files
      if (['README.md', 'glossary.json', 'config.json', 'translation_logs.json'].includes(file.name)) continue

      let targetDir = ''
      const nameLower = file.name.toLowerCase()

      if (nameLower.includes('hayagriva') || nameLower.includes('馬頭明王')) {
        targetDir = 'research/hayagriva'
      } else if (nameLower.includes('atavaku') || nameLower.includes('阿吒婆拘')) {
        targetDir = 'research/atavaku'
      } else if (/\.(png|jpg|jpeg|gif|webp)$/i.test(file.name)) {
        targetDir = 'research/images'
      } else if (/\.(md|html)$/i.test(file.name)) {
        targetDir = 'research'
      } else {
        continue
      }

      // Read, create at new location, delete old
      try {
        const { content, sha } = await this.getFile(file.path)
        const newPath = `${targetDir}/${file.name}`
        await this.createOrUpdateFile(newPath, content, `Migrate: ${file.name} → ${newPath}`)
        await this.deleteFile(file.path, sha, `Migrate: remove old ${file.path}`)
      } catch {
        // Skip files that can't be migrated
      }
    }

    // Update README after migration
    await this.updateReadme()
  }

  // ─── Utilities ───

  async testConnection(): Promise<boolean> {
    try {
      const res = await this.apiFetch(
        `${this.apiBase}/repos/${this.owner}/${this.repo}`
      )
      return res.ok
    } catch {
      return false
    }
  }
}

export const githubService = new GitHubService()
export type { FileEntry, ResearchFile }
