import { useMemo } from 'react';
import { DollarSign, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCostTrackingStore, computeSummary } from '@/stores/costTrackingStore';

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  perplexity: 'Perplexity',
};

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

export function CostSummary() {
  const entries = useCostTrackingStore((s) => s.entries);
  const clearEntries = useCostTrackingStore((s) => s.clearEntries);
  const summary = useMemo(() => computeSummary(entries), [entries]);

  if (summary.totalCalls === 0) return null;

  const providerEntries = Object.entries(summary.byProvider).sort(
    (a, b) => b[1].cost - a[1].cost
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          API 費用追蹤
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearEntries}>
          <Trash2 className="mr-1 h-3 w-3" />
          清除
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold">{formatCost(summary.totalCost)}</div>
              <div className="text-xs text-muted-foreground">總計</div>
            </div>
            <div>
              <div className="text-lg font-bold">{formatCost(summary.last30Days)}</div>
              <div className="text-xs text-muted-foreground">近 30 天</div>
            </div>
            <div>
              <div className="text-lg font-bold">{summary.totalCalls}</div>
              <div className="text-xs text-muted-foreground">呼叫次數</div>
            </div>
          </div>

          {providerEntries.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">依 Provider</div>
              {providerEntries.map(([provider, data]) => (
                <div key={provider} className="flex items-center justify-between text-xs">
                  <span>{PROVIDER_LABELS[provider] ?? provider}</span>
                  <span className="text-muted-foreground">
                    {formatCost(data.cost)} · {formatTokens(data.tokens)} tokens · {data.calls} 次
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
