import { Badge } from '@/components/ui/badge'
import type { GlossaryTerm } from '@/types/glossary'

const CATEGORY_LABELS: Record<string, string> = {
  concept: '概念',
  person: '人名',
  place: '地名',
  practice: '修法',
  text: '經典',
  deity: '本尊/護法',
  mantra: '咒語',
}

interface GlossaryStatsProps {
  terms: GlossaryTerm[]
}

export function GlossaryStats({ terms }: GlossaryStatsProps) {
  const counts: Record<string, number> = {}
  for (const t of terms) {
    counts[t.category] = (counts[t.category] || 0) + 1
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">
        共 {terms.length} 條
      </span>
      {Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, count]) => (
          <Badge key={cat} variant="outline">
            {CATEGORY_LABELS[cat] ?? cat} {count}
          </Badge>
        ))}
    </div>
  )
}

export { CATEGORY_LABELS }
