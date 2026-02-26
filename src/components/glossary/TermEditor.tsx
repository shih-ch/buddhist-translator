import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { GlossaryTerm } from '@/types/glossary'
import { CATEGORY_LABELS } from './GlossaryStats'

interface TermEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  term?: GlossaryTerm | null
  onSave: (term: GlossaryTerm) => void
}

const CATEGORIES = Object.keys(CATEGORY_LABELS) as GlossaryTerm['category'][]

export function TermEditor({ open, onOpenChange, term, onSave }: TermEditorProps) {
  const [original, setOriginal] = useState('')
  const [translation, setTranslation] = useState('')
  const [sanskrit, setSanskrit] = useState('')
  const [category, setCategory] = useState<GlossaryTerm['category']>('concept')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (term) {
      setOriginal(term.original)
      setTranslation(term.translation)
      setSanskrit(term.sanskrit)
      setCategory(term.category)
      setNotes(term.notes)
    } else {
      setOriginal('')
      setTranslation('')
      setSanskrit('')
      setCategory('concept')
      setNotes('')
    }
  }, [term, open])

  const handleSave = () => {
    const saved: GlossaryTerm = {
      id: term?.id ?? crypto.randomUUID(),
      original,
      translation,
      sanskrit,
      category,
      notes,
      added_at: term?.added_at ?? new Date().toISOString(),
      source_article: term?.source_article ?? '',
    }
    onSave(saved)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{term ? '編輯術語' : '新增術語'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="original">原文</Label>
            <Input
              id="original"
              value={original}
              onChange={(e) => setOriginal(e.target.value)}
              placeholder="бодхичитта"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="translation">中文翻譯</Label>
            <Input
              id="translation"
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              placeholder="菩提心"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sanskrit">梵文/藏文</Label>
            <Input
              id="sanskrit"
              value={sanskrit}
              onChange={(e) => setSanskrit(e.target.value)}
              placeholder="bodhicitta"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">分類</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as GlossaryTerm['category'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">備註</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!original || !translation}>
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
