import { useEffect, useMemo, useState } from 'react'
import { Plus, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useGlossaryStore } from '@/stores/glossaryStore'
import { GlossaryStats, CATEGORY_LABELS } from './GlossaryStats'
import { TermList } from './TermList'
import { TermEditor } from './TermEditor'
import type { GlossaryTerm } from '@/types/glossary'
import { LANGUAGE_LABELS } from '@/types/glossary'

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS)
const ALL_LANGUAGES = Object.keys(LANGUAGE_LABELS)

export function GlossaryPageContent() {
  const {
    glossary,
    isLoading,
    fetchGlossary,
    addTerm,
    updateTerm,
    deleteTerm,
    deleteTermsBatch,
    exportCsv,
  } = useGlossaryStore()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('__all__')
  const [languageFilter, setLanguageFilter] = useState('__all__')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null)

  useEffect(() => {
    fetchGlossary()
  }, [fetchGlossary])

  const allTerms = glossary?.terms ?? []

  const filtered = useMemo(() => {
    return allTerms.filter((t) => {
      if (categoryFilter !== '__all__' && t.category !== categoryFilter) return false
      if (languageFilter !== '__all__' && (t.language || '') !== languageFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          t.original.toLowerCase().includes(q) ||
          t.translation.toLowerCase().includes(q) ||
          t.sanskrit.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [allTerms, search, categoryFilter, languageFilter])

  const handleSave = async (term: GlossaryTerm) => {
    if (editingTerm) {
      await updateTerm(term.id, term)
    } else {
      await addTerm(term)
    }
    setEditingTerm(null)
  }

  const handleEdit = (term: GlossaryTerm) => {
    setEditingTerm(term)
    setEditorOpen(true)
  }

  const handleAdd = () => {
    setEditingTerm(null)
    setEditorOpen(true)
  }

  const handleExport = () => {
    const csv = exportCsv()
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'glossary.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading && !glossary) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <GlossaryStats terms={allTerms} />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="搜尋術語..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-60"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="所有分類" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">所有分類</SelectItem>
            {ALL_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={languageFilter} onValueChange={setLanguageFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="所有語言" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">所有語言</SelectItem>
            {ALL_LANGUAGES.map((l) => (
              <SelectItem key={l} value={l}>
                {LANGUAGE_LABELS[l as keyof typeof LANGUAGE_LABELS]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={allTerms.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            匯出 CSV
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            新增術語
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <TermList terms={filtered} onEdit={handleEdit} onDelete={deleteTerm} onDeleteBatch={deleteTermsBatch} />
        </CardContent>
      </Card>

      <TermEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        term={editingTerm}
        onSave={handleSave}
      />
    </div>
  )
}
