import type { ArticleSummary } from '@/types/article'

interface ResearchFile {
  name: string
  path: string
  category: string
}

const MONTH_NAMES: Record<string, string> = {
  '01': '一月',
  '02': '二月',
  '03': '三月',
  '04': '四月',
  '05': '五月',
  '06': '六月',
  '07': '七月',
  '08': '八月',
  '09': '九月',
  '10': '十月',
  '11': '十一月',
  '12': '十二月',
}

const CATEGORY_TITLES: Record<string, string> = {
  hayagriva: '馬頭明王 (Hayagriva)',
  atavaku: '阿吒婆拘經',
  images: '圖片',
  other: '其他',
}

/**
 * Generate complete README.md content per spec 2.5
 */
export function generateReadme(
  articles: ArticleSummary[],
  researchFiles: ResearchFile[]
): string {
  const lines: string[] = []

  lines.push('# 佛學文章翻譯與研究集')
  lines.push('')
  lines.push(`共 ${articles.length} 篇翻譯文章 ｜ ${researchFiles.length} 份研究資料`)
  lines.push('')

  // ── Translations section ──
  if (articles.length > 0) {
    lines.push('## 翻譯文章')
    lines.push('')

    // Group by year then month, sorted desc
    const sorted = [...articles].sort((a, b) => b.date.localeCompare(a.date))
    const byYear = new Map<string, Map<string, ArticleSummary[]>>()

    for (const article of sorted) {
      const [year, month] = article.date.split('-')
      if (!year || !month) continue
      if (!byYear.has(year)) byYear.set(year, new Map())
      const yearMap = byYear.get(year)!
      if (!yearMap.has(month)) yearMap.set(month, [])
      yearMap.get(month)!.push(article)
    }

    // Output by year (desc) then month (desc)
    const years = [...byYear.keys()].sort((a, b) => b.localeCompare(a))
    for (const year of years) {
      lines.push(`### ${year}`)
      lines.push('')

      const monthMap = byYear.get(year)!
      const months = [...monthMap.keys()].sort((a, b) => b.localeCompare(a))
      for (const month of months) {
        lines.push(`#### ${MONTH_NAMES[month] ?? month}`)
        lines.push('')
        const monthArticles = monthMap.get(month)!
        for (const a of monthArticles) {
          lines.push(`- [${a.title}](./${a.path}) — ${a.author}, ${a.date}`)
        }
        lines.push('')
      }
    }
  }

  // ── Research section ──
  if (researchFiles.length > 0) {
    lines.push('## 研究資料')
    lines.push('')

    // Group by category
    const byCategory = new Map<string, ResearchFile[]>()
    for (const file of researchFiles) {
      const cat = file.category
      if (!byCategory.has(cat)) byCategory.set(cat, [])
      byCategory.get(cat)!.push(file)
    }

    // Output in fixed order: hayagriva, atavaku, other
    const categoryOrder = ['hayagriva', 'atavaku', 'images', 'other']
    const allCategories = [...new Set([...categoryOrder, ...byCategory.keys()])]

    for (const cat of allCategories) {
      const files = byCategory.get(cat)
      if (!files || files.length === 0) continue
      const title = CATEGORY_TITLES[cat] ?? cat
      lines.push(`### ${title}`)
      lines.push('')
      for (const f of files) {
        const label = f.name.replace(/\.[^.]+$/, '')
        lines.push(`- [${label}](./${f.path})`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}
