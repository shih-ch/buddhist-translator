import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslatorStore } from '@/stores/translatorStore';
import { ParamPresets } from './ParamPresets';

export function TranslationParams() {
  const [open, setOpen] = useState(false);
  const params = useTranslatorStore((s) => s.translationParams);
  const activePreset = useTranslatorStore((s) => s.activePreset);
  const setParams = useTranslatorStore((s) => s.setTranslationParams);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/50">
        <span className="font-medium">
          翻譯參數
          {activePreset && (
            <span className="ml-2 text-xs text-muted-foreground">({activePreset})</span>
          )}
        </span>
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </CollapsibleTrigger>

      <CollapsibleContent className="px-3 pb-3 space-y-3">
        {/* Quick Presets */}
        <ParamPresets />

        {/* Parameter Controls */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
          {/* Toggle: keepOriginalPerLine */}
          <div className="flex items-center justify-between">
            <Label htmlFor="keepOriginal" className="text-xs">保留原文逐句</Label>
            <Switch
              id="keepOriginal"
              size="sm"
              checked={params.keepOriginalPerLine}
              onCheckedChange={(v) => setParams({ keepOriginalPerLine: v })}
            />
          </div>

          {/* Toggle: narrativePerLine */}
          <div className="flex items-center justify-between">
            <Label htmlFor="narrative" className="text-xs">敘述段逐句對照</Label>
            <Switch
              id="narrative"
              size="sm"
              checked={params.narrativePerLine}
              onCheckedChange={(v) => setParams({ narrativePerLine: v })}
            />
          </div>

          {/* Toggle: fiveColumnMode */}
          <div className="flex items-center justify-between">
            <Label htmlFor="fiveCol" className="text-xs">多語五欄模式</Label>
            <Switch
              id="fiveCol"
              size="sm"
              checked={params.fiveColumnMode}
              onCheckedChange={(v) => setParams({ fiveColumnMode: v })}
            />
          </div>

          {/* Toggle: onlyVerseMantra */}
          <div className="flex items-center justify-between">
            <Label htmlFor="verseOnly" className="text-xs">只輸出偈頌/咒語段</Label>
            <Switch
              id="verseOnly"
              size="sm"
              checked={params.onlyVerseMantra}
              onCheckedChange={(v) => setParams({ onlyVerseMantra: v })}
            />
          </div>

          {/* Five-column scope (conditional) */}
          {params.fiveColumnMode && (
            <div className="col-span-2 flex items-center gap-2">
              <Label htmlFor="fiveColScope" className="text-xs shrink-0">五欄範圍</Label>
              <Input
                id="fiveColScope"
                value={params.fiveColumnScope}
                onChange={(e) => setParams({ fiveColumnScope: e.target.value })}
                placeholder="全文"
                className="h-7 text-xs"
              />
            </div>
          )}

          {/* Dropdown: tibetanTranslitMode */}
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">藏文轉寫</Label>
            <Select
              value={params.tibetanTranslitMode}
              onValueChange={(v) => setParams({ tibetanTranslitMode: v as 'A1' | 'A2' })}
            >
              <SelectTrigger size="sm" className="h-7 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A1">A1（Wylie）</SelectItem>
                <SelectItem value="A2">A2（藏音羅馬音）</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dropdown: mantraTranslit */}
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">咒語轉寫</Label>
            <Select
              value={params.mantraTranslit}
              onValueChange={(v) => setParams({ mantraTranslit: v as 'IAST' | 'keep_original' | 'if_possible' })}
            >
              <SelectTrigger size="sm" className="h-7 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IAST">IAST</SelectItem>
                <SelectItem value="keep_original">保留原狀</SelectItem>
                <SelectItem value="if_possible">能則提供</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dropdown: proofreadMode */}
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">勘誤模式</Label>
            <Select
              value={params.proofreadMode}
              onValueChange={(v) => setParams({ proofreadMode: v as 'off' | 'annotate_only' | 'allow_correction' })}
            >
              <SelectTrigger size="sm" className="h-7 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">關閉</SelectItem>
                <SelectItem value="annotate_only">標註不改</SelectItem>
                <SelectItem value="allow_correction">允許校正</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fixed display: hanyin rule */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">漢音規則</Label>
            <span className="text-xs text-muted-foreground">僅咒語/偈頌；敘述句填 —</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
