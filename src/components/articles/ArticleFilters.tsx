import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ArticleFiltersProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  authors: string[]
  selectedAuthor: string
  onAuthorChange: (a: string) => void
  months: string[]
  selectedMonth: string
  onMonthChange: (m: string) => void
}

export function ArticleFilters({
  searchQuery,
  onSearchChange,
  authors,
  selectedAuthor,
  onAuthorChange,
  months,
  selectedMonth,
  onMonthChange,
}: ArticleFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder="搜尋標題..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-60"
      />
      <Select value={selectedAuthor} onValueChange={onAuthorChange}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="所有作者" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">所有作者</SelectItem>
          {authors.map((a) => (
            <SelectItem key={a} value={a}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={selectedMonth} onValueChange={onMonthChange}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="所有月份" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">所有月份</SelectItem>
          {months.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
