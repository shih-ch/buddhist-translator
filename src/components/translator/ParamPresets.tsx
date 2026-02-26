import { Button } from '@/components/ui/button';
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore';
import { useTranslatorStore } from '@/stores/translatorStore';

export function ParamPresets() {
  const presets = useAIFunctionsStore((s) => s.presets);
  const activePreset = useTranslatorStore((s) => s.activePreset);
  const applyPreset = useTranslatorStore((s) => s.applyPreset);

  return (
    <div className="flex flex-wrap gap-1.5">
      {presets.map((preset) => (
        <Button
          key={preset.name}
          variant={activePreset === preset.name ? 'default' : 'outline'}
          size="sm"
          className="text-xs"
          onClick={() => applyPreset(preset.name, preset.params)}
        >
          <span className="mr-1">{preset.icon}</span>
          {preset.name}
        </Button>
      ))}
    </div>
  );
}
