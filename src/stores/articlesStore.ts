import { create } from 'zustand'
import type { ArticleSummary } from '@/types/article'
import { githubService } from '@/services/github'
import type { ResearchFile } from '@/services/github'

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface ArticlesState {
  articles: ArticleSummary[]
  researchFiles: ResearchFile[]
  isLoading: boolean
  lastFetched: number | null

  fetchArticles: () => Promise<void>
  fetchResearchFiles: () => Promise<void>
  getArticlesByMonth: () => Record<string, ArticleSummary[]>
  getAuthors: () => string[]
  invalidateCache: () => void
}

export const useArticlesStore = create<ArticlesState>((set, get) => ({
  articles: [],
  researchFiles: [],
  isLoading: false,
  lastFetched: null,

  fetchArticles: async () => {
    const { lastFetched, isLoading } = get()
    if (isLoading) return
    if (lastFetched && Date.now() - lastFetched < CACHE_TTL) return

    set({ isLoading: true })
    try {
      const articles = await githubService.listTranslations()
      set({ articles, lastFetched: Date.now() })
    } catch (err) {
      console.error('Failed to fetch articles:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  fetchResearchFiles: async () => {
    try {
      const researchFiles = await githubService.listResearchFiles()
      set({ researchFiles })
    } catch (err) {
      console.error('Failed to fetch research files:', err)
    }
  },

  getArticlesByMonth: () => {
    const { articles } = get()
    const map: Record<string, ArticleSummary[]> = {}
    for (const a of articles) {
      const key = a.date.slice(0, 7) // YYYY-MM
      if (!map[key]) map[key] = []
      map[key].push(a)
    }
    return map
  },

  getAuthors: () => {
    const { articles } = get()
    return [...new Set(articles.map((a) => a.author).filter(Boolean))]
  },

  invalidateCache: () => {
    set({ lastFetched: null })
  },
}))
