import { useState, useRef } from 'react'
import { Image, Upload, Loader2, X, Sparkles, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ocrWithClaude } from '@/services/ocr'

type OCREngine = 'claude' | 'tesseract'

const ENGINE_STORAGE_KEY = 'bt-ocr-engine'

function loadEngine(): OCREngine {
  try {
    const v = localStorage.getItem(ENGINE_STORAGE_KEY)
    return v === 'tesseract' ? 'tesseract' : 'claude'
  } catch {
    return 'claude'
  }
}

interface OCRInputProps {
  onTextExtracted: (text: string) => void
}

const OCR_LANGUAGES = [
  { code: 'rus', label: '俄文' },
  { code: 'eng', label: '英文' },
  { code: 'bod', label: '藏文' },
  { code: 'san', label: '梵文' },
  { code: 'chi_tra', label: '繁體中文' },
]

export function OCRInput({ onTextExtracted }: OCRInputProps) {
  const [lang, setLang] = useState('rus')
  const [engine, setEngineState] = useState<OCREngine>(loadEngine())
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const setEngine = (v: OCREngine) => {
    setEngineState(v)
    try { localStorage.setItem(ENGINE_STORAGE_KEY, v) } catch { /* ignore */ }
  }

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('請選擇圖片檔案')
      return
    }
    const url = URL.createObjectURL(file)
    setImageUrl(url)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) handleFile(file)
        break
      }
    }
  }

  const handleOCR = async () => {
    if (!imageUrl) return
    setLoading(true)
    setProgress(0)

    try {
      let text = ''
      if (engine === 'claude') {
        text = (await ocrWithClaude(imageUrl, lang)).trim()
      } else {
        const Tesseract = await import('tesseract.js')
        const result = await Tesseract.recognize(imageUrl, lang, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100))
            }
          },
        })
        text = result.data.text.trim()
      }

      if (!text) {
        toast.error('未能識別出文字')
        return
      }
      onTextExtracted(text)
      toast.success(`已識別 ${text.length} 個字元`)
    } catch (err) {
      toast.error(`OCR 失敗：${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }

  const handleClear = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImageUrl(null)
  }

  return (
    <div className="flex flex-col gap-3 p-3" onPaste={handlePaste}>
      <div className="flex items-center gap-2">
        <div className="w-32">
          <Label className="text-xs text-muted-foreground">引擎</Label>
          <Select value={engine} onValueChange={(v) => setEngine(v as OCREngine)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude">
                <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Claude</span>
              </SelectItem>
              <SelectItem value="tesseract">
                <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> Tesseract</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">語言（提示 / Tesseract 必選）</Label>
          <Select value={lang} onValueChange={setLang}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OCR_LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="mr-1 h-3 w-3" />
          選擇圖片
        </Button>
      </div>

      {!imageUrl ? (
        <div
          className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg py-8 text-muted-foreground cursor-pointer hover:border-primary/50"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <Image className="h-8 w-8 mb-2" />
          <p className="text-sm">拖放圖片或點擊選擇</p>
          <p className="text-xs">也可以直接貼上 (Ctrl+V)</p>
        </div>
      ) : (
        <div className="relative">
          <img
            src={imageUrl}
            alt="OCR input"
            className="max-h-48 rounded-lg border object-contain w-full"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6"
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {loading && engine === 'tesseract' && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            識別中... {progress}%
          </p>
        </div>
      )}
      {loading && engine === 'claude' && (
        <p className="text-xs text-muted-foreground text-center">
          Claude 辨識中...
        </p>
      )}

      <Button
        onClick={handleOCR}
        disabled={!imageUrl || loading}
        className="w-full"
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Image className="mr-2 h-4 w-4" />
        )}
        {loading ? '識別中...' : '開始 OCR 識別'}
      </Button>
    </div>
  )
}
