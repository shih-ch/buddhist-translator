import type { AIResponse } from '@/types/chat';

const MOCK_TRANSLATION = `# 關於修行中的障礙

在修行道路上，我們不可避免地會遇到各種障礙。這些障礙並非偶然，而是修行過程中自然出現的考驗。

## 外在障礙

外在障礙包括環境的干擾、人際關係的紛擾，以及各種世俗事務的牽絆。對於修行者而言，最重要的是不要被這些外在因素所動搖。

## 內在障礙

內在障礙則更為微細，包括：

1. **散亂**（виксепа, vikṣepa）：心念不斷飄散，無法安住。
2. **昏沉**（стяна, styāna）：修行時昏昏欲睡，覺知模糊。
3. **掉舉**（аудхатья, auddhatya）：心念浮動不安，無法平靜。

## 對治方法

蓮花生大士（Padmasambhava）曾開示：「障礙即是成就的莊嚴。」每一個障礙的出現，都是我們深化修行的機會。

> 當障礙生起時，不要逃避，不要抗拒，而是直接觀照它的本質。

這便是大圓滿（Dzogchen）修行的核心要義。`;

const MOCK_TERMS = [
  {
    original: 'виксепа',
    translation: '散亂',
    sanskrit: 'vikṣepa',
    category: 'concept',
    notes: '五蓋之一',
  },
  {
    original: 'стяна',
    translation: '昏沉',
    sanskrit: 'styāna',
    category: 'concept',
    notes: '',
  },
  {
    original: 'Падмасамбхава',
    translation: '蓮花生大士',
    sanskrit: 'Padmasambhava',
    category: 'person',
    notes: '藏傳佛教開山祖師',
  },
  {
    original: 'Дзогчен',
    translation: '大圓滿',
    sanskrit: 'Dzogchen',
    category: 'practice',
    notes: '寧瑪派最高教法',
  },
];

const MOCK_FORMATTED = {
  title: '關於修行中的障礙',
  tags: ['修行', '障礙', '大圓滿', '五蓋', '對治'],
  formatted_content: MOCK_TRANSLATION,
};

/**
 * Simulate streaming AI response by calling back with chunks of text.
 */
export async function mockStreamingCall(
  _messages: { role: string; content: string }[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<AIResponse> {
  const text = MOCK_TRANSLATION;
  const chunkSize = 3;
  let output = '';

  for (let i = 0; i < text.length; i += chunkSize) {
    if (signal?.aborted) break;
    const chunk = text.slice(i, i + chunkSize);
    output += chunk;
    onChunk(chunk);
    await sleep(15);
  }

  return {
    content: output,
    model: 'mock-model',
    usage: {
      prompt_tokens: 500,
      completion_tokens: output.length,
      total_tokens: 500 + output.length,
    },
  };
}

/**
 * Mock term extraction call — returns a list of extracted terms.
 */
export async function mockTermExtraction(
  _originalText: string,
  _translatedText: string
): Promise<typeof MOCK_TERMS> {
  await sleep(800);
  return MOCK_TERMS;
}

/**
 * Mock formatting call — returns formatted content with title and tags.
 */
export async function mockFormattingCall(
  _content: string
): Promise<typeof MOCK_FORMATTED> {
  await sleep(600);
  return MOCK_FORMATTED;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
