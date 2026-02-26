import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AI_PROVIDERS } from '@/stores/aiModels';
import { useTranslatorStore } from '@/stores/translatorStore';
import type { AIProviderId } from '@/types/settings';

export function ModelSelector() {
  const currentModel = useTranslatorStore((s) => s.currentModel);
  const totalTokens = useTranslatorStore((s) => s.totalTokens);
  const totalCost = useTranslatorStore((s) => s.totalCost);
  const setCurrentModel = useTranslatorStore((s) => s.setCurrentModel);

  const providerIds = Object.keys(AI_PROVIDERS) as AIProviderId[];

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b text-xs">
      {/* Provider select */}
      <Select
        value={currentModel.provider}
        onValueChange={(v) => {
          const pid = v as AIProviderId;
          const firstModel = AI_PROVIDERS[pid].models[0];
          setCurrentModel(pid, firstModel.id);
        }}
      >
        <SelectTrigger size="sm" className="h-7 text-xs w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {providerIds.map((pid) => (
            <SelectItem key={pid} value={pid}>
              {AI_PROVIDERS[pid].name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Model select */}
      <Select
        value={currentModel.model}
        onValueChange={(v) => setCurrentModel(currentModel.provider, v)}
      >
        <SelectTrigger size="sm" className="h-7 text-xs w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AI_PROVIDERS[currentModel.provider].models.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Stats */}
      <div className="ml-auto flex items-center gap-2">
        {totalTokens > 0 && (
          <>
            <Badge variant="secondary" className="text-[10px] font-normal">
              {totalTokens.toLocaleString()} tokens
            </Badge>
            <Badge variant="outline" className="text-[10px] font-normal">
              {totalCost < 0.01 ? '< $0.01' : `$${totalCost.toFixed(4)}`}
            </Badge>
          </>
        )}
      </div>
    </div>
  );
}
