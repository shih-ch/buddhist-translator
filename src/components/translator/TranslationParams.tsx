import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslatorStore } from '@/stores/translatorStore';
import { ParamPresets } from './ParamPresets';

export function TranslationParams() {
  const [open, setOpen] = useState(false);
  const translationParams = useTranslatorStore((s) => s.translationParams);
  const setTranslationParams = useTranslatorStore((s) => s.setTranslationParams);
  const activePreset = useTranslatorStore((s) => s.activePreset);
  const p = translationParams;

  return (
    <div className="border-b">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/50"
      >
        <span className="font-medium">
          翻譯參數
          {activePreset && (
            <span className="ml-2 text-xs text-muted-foreground">({activePreset})</span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="space-y-3 px-3 pb-3">
          <ParamPresets />

          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {/* Toggle: keepOriginalPerLine */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">保留原文逐句</Label>
              <Switch
                checked={p.keepOriginalPerLine}
                onCheckedChange={(v) => setTranslationParams({ keepOriginalPerLine: v })}
              />
            </div>

            {/* Toggle: narrativePerLine */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">敘述段逐句對照</Label>
              <Switch
                checked={p.narrativePerLine}
                onCheckedChange={(v) => setTranslationParams({ narrativePerLine: v })}
              />
            </div>

            {/* Toggle: fiveColumnMode */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">多語五欄模式</Label>
              <Switch
                checked={p.fiveColumnMode}
                onCheckedChange={(v) => setTranslationParams({ fiveColumnMode: v })}
              />
            </div>

            {/* Toggle: onlyVerseMantra */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">只輸出偈頌/咒語段</Label>
              <Switch
                checked={p.onlyVerseMantra}
                onCheckedChange={(v) => setTranslationParams({ onlyVerseMantra: v })}
              />
            </div>

            {/* Five column scope (conditional) */}
            {p.fiveColumnMode && (
              <div className="col-span-2">
                <Label className="text-xs">五欄範圍</Label>
                <Input
                  value={p.fiveColumnScope}
                  onChange={(e) => setTranslationParams({ fiveColumnScope: e.target.value })}
                  className="mt-1 h-7 text-xs"
                  placeholder="全文"
                />
              </div>
            )}

            {/* Dropdown: relayLanguage */}
            <div>
              <Label className="text-xs">中轉語言</Label>
              <Select
                value={p.relayLanguage ?? 'none'}
                onValueChange={(v) =>
                  setTranslationParams({ relayLanguage: v as 'none' | 'en' | 'ru' })
                }
              >
                <SelectTrigger className="mt-1 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">直譯（不中轉）</SelectItem>
                  <SelectItem value="en">經英文中轉</SelectItem>
                  <SelectItem value="ru">經俄文中轉</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dropdown: tibetanTranslitMode */}
            <div>
              <Label className="text-xs">Tibetan 轉寫模式</Label>
              <Select
                value={p.tibetanTranslitMode}
                onValueChange={(v) =>
                  setTranslationParams({ tibetanTranslitMode: v as 'A1' | 'A2' })
                }
              >
                <SelectTrigger className="mt-1 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A1">A1 (Wylie)</SelectItem>
                  <SelectItem value="A2">A2 (藏音羅馬音)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dropdown: mantraTranslit */}
            <div>
              <Label className="text-xs">咒語/梵語轉寫</Label>
              <Select
                value={p.mantraTranslit}
                onValueChange={(v) =>
                  setTranslationParams({
                    mantraTranslit: v as 'wylie' | 'IAST' | 'keep_original' | 'if_possible',
                  })
                }
              >
                <SelectTrigger className="mt-1 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wylie">Wylie</SelectItem>
                  <SelectItem value="IAST">IAST</SelectItem>
                  <SelectItem value="keep_original">保留原狀</SelectItem>
                  <SelectItem value="if_possible">能則提供</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dropdown: proofreadMode */}
            <div>
              <Label className="text-xs">勘誤模式</Label>
              <Select
                value={p.proofreadMode}
                onValueChange={(v) =>
                  setTranslationParams({
                    proofreadMode: v as 'off' | 'annotate_only' | 'allow_correction',
                  })
                }
              >
                <SelectTrigger className="mt-1 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">關閉</SelectItem>
                  <SelectItem value="annotate_only">標註不改</SelectItem>
                  <SelectItem value="allow_correction">允許校正</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fixed display: 漢音規則 */}
            <div>
              <Label className="text-xs">漢音規則</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                僅咒語/偈頌提供；敘述句填 —
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
