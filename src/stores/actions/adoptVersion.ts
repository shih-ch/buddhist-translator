import type { TranslatorStoreGet, TranslatorStoreSet } from '../translatorStore';
import type { AIMessage } from '@/services/ai/types';
import type { AIProviderId } from '@/types/settings';
import { assembleMarkdown } from '@/services/markdownUtils';
import { callFunction } from '@/services/ai/router';
import { trackedCallFunction } from '@/services/ai/trackedCall';
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTranslationMemoryStore } from '@/stores/translationMemoryStore';
import { logTranslation } from '@/services/translationLogger';
import { persistVersions } from './versionStorage';
import { toast } from 'sonner';

/**
 * Pull the first JSON object out of a model reply. Models sometimes wrap it in
 * a code fence or add a sentence around it; JSON.parse on the raw reply then
 * failed and the extraction silently came back empty.
 */
function parseJsonObject(reply: string): Record<string, unknown> {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : reply;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('模型沒有回傳 JSON');
  return JSON.parse(body.slice(start, end + 1));
}

/**
 * Author names are as likely to be a signature at the end of a teaching as a
 * byline at the top, so send both ends of a long original.
 */
function headAndTail(text: string, head = 2000, tail = 1000): string {
  if (text.length <= head + tail) return text;
  return `${text.slice(0, head)}\n\n[……中略……]\n\n${text.slice(-tail)}`;
}

/** Use AI to extract metadata (title, author) from translated content */
async function extractMetadataFromContent(
  content: string,
  originalText: string,
  provider: AIProviderId,
  model: string,
  fields: { title: boolean; author: boolean },
  /** The source article's own title, if one came in with the import. */
  sourceTitle?: string,
): Promise<{ title?: string; author?: string }> {
  const apiKeys = useSettingsStore.getState().apiKeys;
  if (!apiKeys[provider]) throw new Error(`未設定 ${provider} 的 API Key`);

  const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('translation');

  const requests: string[] = [];
  if (fields.title) {
    requests.push(
      sourceTitle
        ? `title: 將原文標題「${sourceTitle}」忠實翻譯成簡潔的繁體中文標題，不要另外發想`
        : 'title: 根據內容生成一個簡潔的繁體中文標題'
    );
  }
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
      content: `【譯文】\n${content.slice(0, 1500)}\n\n【原文】\n${headAndTail(originalText)}`,
    },
  ];

  const response = await callFunction(
    { ...fnConfig, provider, model },
    apiKeys,
    messages,
    { overrideProvider: provider, overrideModel: model },
  );

  const parsed = parseJsonObject(response.content);
  const result: { title?: string; author?: string } = {};
  if (fields.title && parsed.title) {
    result.title = String(parsed.title).replace(/^["「『]|["」』]$/g, '');
  }
  if (fields.author && parsed.author) {
    result.author = String(parsed.author).trim();
  }
  return result;
}

const TIBETAN_RE = /[\u0F00-\u0FFF]/g;
const count = (text: string, re: RegExp) => (text.match(re) || []).length;

/**
 * Run 譯文排版 on a translation body. The formatter is a cheap model told to
 * touch layout only; if its output lost text (or touched Tibetan) the
 * unformatted translation is the better result, so that throws instead.
 */
async function autoFormatBody(content: string): Promise<string> {
  const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('translation_formatting');
  const apiKeys = useSettingsStore.getState().apiKeys;
  if (!apiKeys[fnConfig.provider]) throw new Error(`未設定 ${fnConfig.provider} 的 API Key`);

  const response = await trackedCallFunction(
    fnConfig,
    apiKeys,
    [
      { role: 'system', content: fnConfig.prompt },
      { role: 'user', content },
    ],
    undefined,
    'translation_formatting',
  );
  const fenced = response.content.match(/^\s*```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/);
  const out = (fenced ? fenced[1] : response.content).trim();

  const visible = (t: string) => t.replace(/\s/g, '').length;
  if (visible(out) < visible(content) * 0.85) throw new Error('排版結果少了內容');
  if (count(out, TIBETAN_RE) < count(content, TIBETAN_RE) * 0.98) throw new Error('排版結果改動了藏文');
  return out;
}

export function performAdoptVersion(messageId: string, get: TranslatorStoreGet, set: TranslatorStoreSet): void {
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

  // Auto-format and title/author extraction both finish later and each rebuilds
  // the preview. They share `body` so whichever lands second keeps the other's
  // result, and neither overwrites a preview the user has edited (or replaced
  // by adopting another reply) in the meantime.
  let body = msg.content;
  let lastAssembled = md;
  const rebuildPreview = (): boolean => {
    const latest = get();
    if (latest.previewContent !== lastAssembled) return false;
    const imgs = latest.articleImages.length > 0 ? latest.articleImages : undefined;
    lastAssembled = assembleMarkdown(latest.metadata, body, latest.originalText || undefined, imgs);
    set({ previewContent: lastAssembled });
    return true;
  };

  if (useSettingsStore.getState().preferences.autoFormatOnAdopt) {
    autoFormatBody(msg.content)
      .then((formatted) => {
        if (get().messages.length === 0) return;
        body = formatted;
        if (rebuildPreview()) toast.success('已自動 AI 排版');
        else toast.info('預覽已被修改，略過自動 AI 排版');
      })
      .catch((err) => {
        console.error('[autoFormat] failed:', err);
        toast.error(`自動 AI 排版失敗，保留未排版的譯文：${err instanceof Error ? err.message : 'Unknown error'}`);
      });
  }

  // Save to translation memory
  if (state.originalText) {
    useTranslationMemoryStore.getState().addEntry(
      state.originalText,
      msg.content,
      state.metadata.original_language,
      state.editingArticle?.path ?? '',
    );
  }

  // A title with no Chinese in it is the source article's own title — URL import
  // fills the field from the page, in the original language. Treating it as
  // "already has a title" meant no zh-TW title was ever generated for imports.
  const currentTitle = metadata.title.trim();
  const needTitle = !currentTitle || !/[\u3400-\u9fff\uf900-\ufaff]/.test(currentTitle);
  const needAuthor = !metadata.author.trim();
  if (needTitle || needAuthor) {
    extractMetadataFromContent(
      msg.content,
      state.originalText,
      state.currentModel.provider,
      state.currentModel.model,
      { title: needTitle, author: needAuthor },
      needTitle && currentTitle ? currentTitle : undefined,
    ).then((extracted) => {
      // Guard: if store was reset while extraction was in-flight, skip
      const latest = get();
      if (latest.messages.length === 0) return;
      if (extracted.title || extracted.author) {
        const updated = {
          ...latest.metadata,
          ...(extracted.title ? { title: extracted.title } : {}),
          ...(extracted.author ? { author: extracted.author } : {}),
        };
        set({ metadata: updated });
        rebuildPreview();
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
