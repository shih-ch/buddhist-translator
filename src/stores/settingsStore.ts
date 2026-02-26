import { create } from 'zustand'
import type { AIProviderId } from '@/types/settings'

const KEYS = {
  apiKeys: 'bt-apikeys',
  githubToken: 'bt-github-token',
  githubRepo: 'bt-github-repo',
  githubBranch: 'bt-github-branch',
  preferences: 'bt-preferences',
} as const

interface ApiKeys {
  openai: string
  anthropic: string
  google: string
  perplexity: string
}

interface Preferences {
  lastPreset: string
}

interface SettingsState {
  apiKeys: ApiKeys
  githubToken: string
  githubRepo: string
  githubBranch: string
  preferences: Preferences

  // API Key methods
  getApiKey: (provider: AIProviderId) => string
  setApiKey: (provider: AIProviderId, key: string) => void
  testApiKey: (provider: AIProviderId) => Promise<boolean>

  // GitHub methods
  getGitHubToken: () => string
  setGitHubToken: (token: string) => void
  getGitHubRepo: () => { owner: string; repo: string }
  setGitHubRepo: (owner: string, repo: string) => void
  getGitHubBranch: () => string
  setGitHubBranch: (branch: string) => void
  testGitHubToken: () => Promise<boolean>

  // Preferences
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const defaultApiKeys: ApiKeys = { openai: '', anthropic: '', google: '', perplexity: '' }

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiKeys: loadJson<ApiKeys>(KEYS.apiKeys, defaultApiKeys),
  githubToken: localStorage.getItem(KEYS.githubToken) ?? '',
  githubRepo: localStorage.getItem(KEYS.githubRepo) ?? 'shih-ch/mantra',
  githubBranch: localStorage.getItem(KEYS.githubBranch) ?? 'main',
  preferences: loadJson<Preferences>(KEYS.preferences, { lastPreset: '' }),

  getApiKey: (provider) => get().apiKeys[provider],

  setApiKey: (provider, key) => {
    set((state) => {
      const updated = { ...state.apiKeys, [provider]: key }
      localStorage.setItem(KEYS.apiKeys, JSON.stringify(updated))
      return { apiKeys: updated }
    })
  },

  testApiKey: async (provider) => {
    const key = get().apiKeys[provider]
    if (!key) return false
    try {
      switch (provider) {
        case 'openai': {
          const res = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${key}` },
          })
          return res.ok
        }
        case 'anthropic': {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': key,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'hi' }],
            }),
          })
          return res.ok
        }
        case 'google': {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
          )
          return res.ok
        }
        case 'perplexity': {
          const res = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${key}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: 'sonar',
              messages: [{ role: 'user', content: 'hi' }],
              max_tokens: 1,
            }),
          })
          return res.ok
        }
        default:
          return false
      }
    } catch {
      return false
    }
  },

  getGitHubToken: () => get().githubToken,

  setGitHubToken: (token) => {
    localStorage.setItem(KEYS.githubToken, token)
    set({ githubToken: token })
  },

  getGitHubRepo: () => {
    const full = get().githubRepo
    const [owner = '', repo = ''] = full.split('/')
    return { owner, repo }
  },

  setGitHubRepo: (owner, repo) => {
    const full = `${owner}/${repo}`
    localStorage.setItem(KEYS.githubRepo, full)
    set({ githubRepo: full })
  },

  getGitHubBranch: () => get().githubBranch,

  setGitHubBranch: (branch) => {
    localStorage.setItem(KEYS.githubBranch, branch)
    set({ githubBranch: branch })
  },

  testGitHubToken: async () => {
    const token = get().githubToken
    const { owner, repo } = get().getGitHubRepo()
    if (!token || !owner || !repo) return false
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.ok
    } catch {
      return false
    }
  },

  setPreference: (key, value) => {
    set((state) => {
      const updated = { ...state.preferences, [key]: value }
      localStorage.setItem(KEYS.preferences, JSON.stringify(updated))
      return { preferences: updated }
    })
  },
}))
