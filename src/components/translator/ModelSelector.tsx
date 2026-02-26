import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslatorStore } from '@/stores/translatorStore';
import { AI_PROVIDERS } from '@/stores/aiModels';
import type { AIProviderId } from '@/types/settings';

const PROVIDER_IDS = Object.keys(AI_PROVIDERS) as AIProviderId[];

export function ModelSelector() {
  const { currentModel, setCurrentModel, totalTokens, totalCost } = useTranslatorStore();

  const currentProvider = AI_PROVIDERS[currentModel.provider];
  const models = currentProvider?.models ?? [];

  const handleProviderChange = (providerId: string) => {
    const provider = AI_PROVIDERS[providerId as AIProviderId];
    if (provider && provider.models.length > 0) {
      setCurrentModel(providerId as AIProviderId, provider.models[0].id);
    }
  };

  return (
    <div className="flex items-center gap-2 border-b px-3 py-2">
      <Select value={currentModel.provider} onValueChange={handleProviderChange}>
        <SelectTrigger className="h-7 w-[110px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROVIDER_IDS.map((id) => (
            <SelectItem key={id} value={id}>
              {AI_PROVIDERS[id].name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentModel.model}
        onValueChange={(model) => setCurrentModel(currentModel.provider, model)}
      >
        <SelectTrigger className="h-7 w-[160px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
        {totalTokens > 0 && <span>{totalTokens.toLocaleString()} tokens</span>}
        {totalCost > 0 && <span>${totalCost.toFixed(4)}</span>}
      </div>
    </div>
  );
}
