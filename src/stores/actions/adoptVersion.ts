import type { StoreApi } from 'zustand';
import type { TranslatorState } from '../translatorStore';
import type { AIMessage } from '@/services/ai/types';
import type { AIProviderId } from '@/types/settings';
import { assembleMarkdown } from '@/services/markdownUtils';
import { callFunction } from '@/services/ai/router';
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTranslationMemoryStore } from '@/stores/translationMemoryStore';
import { logTranslation } from '@/services/translationLogger';
import { persistVersions } from '../translatorStore';
import { toast } from 'sonner';

type Get = StoreApi<TranslatorState>['getState'];
type Set = StoreApi<TranslatorState>['setState'];

/** Use AI to extract metadata (title, author) from translated content */
async function extractMetadataFromContent(
  content: string,
  originalText: string,
  provider: AIProviderId,
  model: string,
  fields: { title: boolean; author: boolean },
): Promise<{ title?: string; author?: string }> {
  try {
    const apiKeys = useSettingsStore.getState().apiKeys;
    if (!apiKeys[provider]) return {};

    const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('translation');

    const requests: string[] = [];
    if (fields.title) requests.push('title: 根據內容生成一個簡潔的繁體中文標題');
    if (fields.author) requests.push('author: 從原文或譯文中找出文章作者姓名（保留原文語言）');

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `你是佛學文章元資料提取器。請從以下內容中提取資訊。
以 JSON 格式回覆，只包含以下欄位：
${requests.join('\n')}

只回覆 JSON，不要加其他說明。例如：{"title": "標題", "author": "作者"}`,
      },
      {
        role: 'user',
        content: `【譯文】\n${content.slice(0, 1500)}\n\n【原文】\n${originalText.slice(0, 1500)}`,
      },
    ];

    const response = await callFunction(
      { ...fnConfig, provider, model },
      apiKeys,
      messages,
      { overrideProvider: provider, overrideModel: model },
    );

    // Parse JSON from response (handle markdown code blocks)
    let text = response.content.trim();
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) text = codeBlock[1].trim();

    const parsed = JSON.parse(text);
    const result: { title?: string; author?: string } = {};
    if (fields.title && parsed.title) {
      result.title = String(parsed.title).replace(/^["「『]|["」』]$/g, '');
    }
    if (fields.author && parsed.author) {
      result.author = String(parsed.author).trim();
    }
    return result;
  } catch (err) {
    console.error('[extractMetadata] error:', err);
    return {};
  }
}

export function performAdoptVersion(messageId: string, get: Get, set: Set): void {
  const state = get();
  const msg = state.messages.find((m) => m.id === messageId);
  if (!msg) return;

  // Partial replacement mode: splice result into existing previewContent
  if (state.replacementRange) {
    const { start, end, originalPreview } = state.replacementRange;
    // Auto-save a version before replacement so the user can undo
    const versionId = `ver-${Date.now()}`;
    const versions = [...state.savedVersions, {
      id: versionId,
      name: `替換前自動備份`,
      content: originalPreview,
      model: state.currentModel.model,
      provider: state.currentModel.provider,
      timestamp: Date.now(),
    }];
    persistVersions(versions);
    const newContent = originalPreview.slice(0, start) + msg.content.trim() + originalPreview.slice(end);
    set({ previewContent: newContent, replacementRange: null, savedVersions: versions });
    toast.success('已替換選取段落（已自動備份替換前版本）');
    return;
  }

  // Set translator_model from the message's actual model (or current model)
  const actualModel = msg.model || state.currentModel.model;
  const metadata = { ...state.metadata, translator_model: actualModel };
  set({ metadata });

  // First, assemble with updated metadata
  const images = state.articleImages.length > 0 ? state.articleImages : undefined;
  const md = assembleMarkdown(metadata, msg.content, state.originalText || undefined, images);
  set({ previewContent: md });

  // Save to translation memory
  if (state.originalText) {
    useTranslationMemoryStore.getState().addEntry(
      state.originalText,
      msg.content,
      state.metadata.original_language,
      state.editingArticle?.path ?? '',
    );
  }

  // If title or author is empty, ask AI to extract from content
  const needTitle = !metadata.title.trim();
  const needAuthor = !metadata.author.trim();
  if (needTitle || needAuthor) {
    extractMetadataFromContent(
      msg.content,
      state.originalText,
      state.currentModel.provider,
      state.currentModel.model,
      { title: needTitle, author: needAuthor },
    ).then((extracted) => {
      // Guard: if store was reset while extraction was in-flight, skip
      if (get().messages.length === 0) return;
      if (extracted.title || extracted.author) {
        const updated = {
          ...get().metadata,
          ...(extracted.title ? { title: extracted.title } : {}),
          ...(extracted.author ? { author: extracted.author } : {}),
        };
        set({ metadata: updated });
        const imgs = get().articleImages.length > 0 ? get().articleImages : undefined;
        const newMd = assembleMarkdown(updated, msg.content, get().originalText || undefined, imgs);
        set({ previewContent: newMd });
        const parts: string[] = [];
        if (extracted.title) parts.push(`標題：${extracted.title}`);
        if (extracted.author) parts.push(`作者：${extracted.author}`);
        toast.success(`已自動提取 ${parts.join('、')}`);
      } else {
        toast.info('無法從內容中提取標題/作者，請手動填寫');
      }
    }).catch((err) => {
      console.error('[extractMetadata] failed:', err);
      toast.error(`提取標題/作者失敗：${err instanceof Error ? err.message : 'Unknown error'}`);
    });
  }

  // Log translation session to GitHub (fire-and-forget)
  const userMessages = state.messages.filter((m) => m.role === 'user');
  const corrections = userMessages.slice(1).map((m) => ({
    type: 'other' as const,
    instruction: m.content,
  }));
  const slug = state.metadata.title || state.metadata.date;
  logTranslation({
    date: new Date().toISOString().split('T')[0],
    article: slug,
    function: 'translation',
    provider: state.currentModel.provider,
    model: state.currentModel.model,
    params: state.translationParams as unknown as Record<string, unknown>,
    rounds: userMessages.length,
    corrections,
  }).catch(() => { /* non-blocking */ });
}
