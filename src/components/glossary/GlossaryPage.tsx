import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Download, Upload, BookOpen } from 'lucide-react'
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
import { toast } from 'sonner'
import { Import84000Dialog } from './Import84000Dialog'

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS)
const ALL_LANGUAGES = Object.keys(LANGUAGE_LABELS)

/** Parse CSV text into array of records, handling quoted fields and BOM */
function parseCSV(text: string): Record<string, string>[] {
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const parseRow = (row: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (inQuotes) {
        if (ch === '"') {
          if (row[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current);
    return fields;
  };

  const headers = parseRow(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = (values[idx] ?? '').trim();
    });
    rows.push(record);
  }
  return rows;
}

export function GlossaryPageContent() {
  const {
    glossary,
    isLoading,
    fetchGlossary,
    addTerm,
    addTermsBatch,
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [import84000Open, setImport84000Open] = useState(false)

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

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be selected again
    e.target.value = ''

    try {
      const text = await file.text()
      const rows = parseCSV(text)
      if (rows.length === 0) {
        toast.error('CSV 檔案無有效資料')
        return
      }

      const existingOriginals = new Set(
        (glossary?.terms ?? []).map((t) => t.original.toLowerCase()),
      )

      const newTerms: GlossaryTerm[] = []
      let skipped = 0

      for (const row of rows) {
        const original = row.original || row['原文'] || ''
        const translation = row.translation || row['翻譯'] || row['譯文'] || ''
        if (!original || !translation) continue

        if (existingOriginals.has(original.toLowerCase())) {
          skipped++
          continue
        }
        existingOriginals.add(original.toLowerCase())

        const validCategories = ['concept', 'person', 'place', 'practice', 'text', 'deity', 'mantra']
        const cat = row.category || row['分類'] || 'concept'

        newTerms.push({
          id: crypto.randomUUID(),
          original,
          translation,
          sanskrit: row.sanskrit || row['梵文'] || '',
          language: (row.language || row['語言'] || 'sanskrit') as GlossaryTerm['language'],
          category: (validCategories.includes(cat) ? cat : 'concept') as GlossaryTerm['category'],
          notes: row.notes || row['備註'] || '',
          added_at: new Date().toISOString(),
          source_article: row.source_article || row['來源'] || '',
        })
      }

      if (newTerms.length > 0) {
        await addTermsBatch(newTerms)
      }
      toast.success(`已匯入 ${newTerms.length} 筆術語${skipped > 0 ? `，跳過 ${skipped} 筆重複` : ''}`)
    } catch (err) {
      toast.error(`匯入失敗：${err instanceof Error ? err.message : 'Unknown error'}`)
    }
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
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImportCsv}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            匯入 CSV
          </Button>
          <Button variant="outline" onClick={() => setImport84000Open(true)}>
            <BookOpen className="mr-2 h-4 w-4" />
            匯入 84000
          </Button>
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

      <Import84000Dialog open={import84000Open} onOpenChange={setImport84000Open} />
    </div>
  )
}
