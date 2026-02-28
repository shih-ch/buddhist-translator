import { Button } from '@/components/ui/button';
import { useTranslatorStore } from '@/stores/translatorStore';
import type { TranslationParams } from '@/types/settings';

const PRESETS: { name: string; icon: string; params: TranslationParams }[] = [
  {
    name: '一般文章',
    icon: '\u{1F4C4}',
    params: {
      keepOriginalPerLine: true,
      narrativePerLine: false,
      fiveColumnMode: false,
      fiveColumnScope: '全文',
      tibetanTranslitMode: 'A1',
      mantraTranslit: 'wylie',
      onlyVerseMantra: false,
      proofreadMode: 'annotate_only',
      relayLanguage: 'none',
    },
  },
  {
    name: '五欄全文',
    icon: '\u{1F4CA}',
    params: {
      keepOriginalPerLine: true,
      narrativePerLine: true,
      fiveColumnMode: true,
      fiveColumnScope: '全文',
      tibetanTranslitMode: 'A1',
      mantraTranslit: 'wylie',
      onlyVerseMantra: false,
      proofreadMode: 'annotate_only',
      relayLanguage: 'none',
    },
  },
  {
    name: '儀軌/偈頌',
    icon: '\u{1F4FF}',
    params: {
      keepOriginalPerLine: true,
      narrativePerLine: false,
      fiveColumnMode: true,
      fiveColumnScope: '僅偈頌與咒語',
      tibetanTranslitMode: 'A1',
      mantraTranslit: 'wylie',
      onlyVerseMantra: true,
      proofreadMode: 'off',
      relayLanguage: 'none',
    },
  },
  {
    name: '校對模式',
    icon: '\u{1F50D}',
    params: {
      keepOriginalPerLine: true,
      narrativePerLine: true,
      fiveColumnMode: false,
      fiveColumnScope: '全文',
      tibetanTranslitMode: 'A1',
      mantraTranslit: 'wylie',
      onlyVerseMantra: false,
      proofreadMode: 'annotate_only',
      relayLanguage: 'none',
    },
  },
];

export function ParamPresets() {
  const { activePreset, applyPreset } = useTranslatorStore();

  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.map((p) => (
        <Button
          key={p.name}
          variant={activePreset === p.name ? 'default' : 'outline'}
          size="xs"
          onClick={() => applyPreset(p.name, p.params)}
        >
          <span className="mr-1">{p.icon}</span>
          {p.name}
        </Button>
      ))}
    </div>
  );
}
