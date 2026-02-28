import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Sparkles } from 'lucide-react'
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
import type { GlossaryTerm, SourceLanguage } from '@/types/glossary'
import { LANGUAGE_LABELS } from '@/types/glossary'
import { CATEGORY_LABELS } from './GlossaryStats'
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { trackedCallFunction } from '@/services/ai/trackedCall'
import { buildGlossaryFillMessages } from '@/services/ai/promptBuilder'
import { toast } from 'sonner'

interface TermEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  term?: GlossaryTerm | null
  onSave: (term: GlossaryTerm) => void
}

const CATEGORIES = Object.keys(CATEGORY_LABELS) as GlossaryTerm['category'][]
const LANGUAGES = Object.keys(LANGUAGE_LABELS) as SourceLanguage[]

export function TermEditor({ open, onOpenChange, term, onSave }: TermEditorProps) {
  const [original, setOriginal] = useState('')
  const [translation, setTranslation] = useState('')
  const [sanskrit, setSanskrit] = useState('')
  const [language, setLanguage] = useState<SourceLanguage>('sanskrit')
  const [category, setCategory] = useState<GlossaryTerm['category']>('concept')
  const [notes, setNotes] = useState('')
  const [sourceArticle, setSourceArticle] = useState('')
  const [tibetan, setTibetan] = useState('')
  const [wylie, setWylie] = useState('')
  const [definition, setDefinition] = useState('')
  const [link, setLink] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const handleAIFill = useCallback(async () => {
    if (!original.trim()) return
    setAiLoading(true)
    try {
      const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('glossary_fill')
      const apiKeys = useSettingsStore.getState().apiKeys
      const messages = buildGlossaryFillMessages(fnConfig.prompt, [original])
      const response = await trackedCallFunction(fnConfig, apiKeys, messages, undefined, 'glossary_fill')

      let jsonStr = response.content.trim()
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim()

      const results = JSON.parse(jsonStr) as { original: string; translation: string }[]
      if (results.length > 0 && results[0].translation) {
        setTranslation(results[0].translation)
        const tag = '[AI翻譯]'
        if (!notes.includes(tag)) {
          setNotes(notes ? notes + ' ' + tag : tag)
        }
      }
    } catch (err) {
      toast.error(`AI 翻譯失敗：${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setAiLoading(false)
    }
  }, [original, notes])

  useEffect(() => {
    if (term) {
      setOriginal(term.original)
      setTranslation(term.translation)
      setSanskrit(term.sanskrit)
      setLanguage(term.language || 'sanskrit')
      setCategory(term.category)
      setNotes(term.notes)
      setSourceArticle(term.source_article || '')
      setTibetan(term.tibetan || '')
      setWylie(term.wylie || '')
      setDefinition(term.definition || '')
      setLink(term.link || '')
    } else {
      setOriginal('')
      setTranslation('')
      setSanskrit('')
      setLanguage('sanskrit')
      setCategory('concept')
      setNotes('')
      setSourceArticle('')
      setTibetan('')
      setWylie('')
      setDefinition('')
      setLink('')
    }
  }, [term, open])

  const handleSave = () => {
    const saved: GlossaryTerm = {
      id: term?.id ?? crypto.randomUUID(),
      original,
      translation,
      sanskrit,
      language,
      category,
      notes,
      added_at: term?.added_at ?? new Date().toISOString(),
      source_article: sourceArticle,
      tibetan,
      wylie,
      definition,
      link,
    }
    onSave(saved)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
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
            <Label htmlFor="language">原文語言</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as SourceLanguage)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {LANGUAGE_LABELS[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="translation">中文翻譯</Label>
            <div className="flex gap-2">
              <Input
                id="translation"
                value={translation}
                onChange={(e) => setTranslation(e.target.value)}
                placeholder="菩提心"
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={handleAIFill}
                disabled={!original.trim() || aiLoading}
                title="AI 補齊翻譯"
              >
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              </Button>
            </div>
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
            <Label htmlFor="tibetan">藏文</Label>
            <Input
              id="tibetan"
              value={tibetan}
              onChange={(e) => setTibetan(e.target.value)}
              placeholder="ཨ་བ་ལ།"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wylie">威利轉寫</Label>
            <Input
              id="wylie"
              value={wylie}
              onChange={(e) => setWylie(e.target.value)}
              placeholder="a ba la"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="definition">定義</Label>
            <Textarea
              id="definition"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="link">連結</Label>
            <Input
              id="link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://read.84000-translate.org/..."
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="source_article">來源文章</Label>
            <Input
              id="source_article"
              value={sourceArticle}
              onChange={(e) => setSourceArticle(e.target.value)}
              placeholder="文章標題或 URL"
            />
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
