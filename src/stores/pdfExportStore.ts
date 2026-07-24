import { create } from 'zustand';
import { DEFAULT_LAYOUT, type BookletLayout } from '@/services/pdfBooklet';

const STORAGE_KEY = 'bt-pdf-export';

export interface PdfExportSettings extends BookletLayout {
  includeOriginal: boolean;
  includeToc: boolean;
  includeImages: boolean;
  includeQr: boolean;
  embedFont: boolean;
  pageFooter: boolean;
}

export const PDF_DEFAULTS: PdfExportSettings = {
  ...DEFAULT_LAYOUT,
  includeOriginal: false,
  includeToc: true,
  includeImages: true,
  includeQr: true,
  embedFont: false,
  pageFooter: true,
};

/** Named layout presets shown as one-tap buttons in the export dialog. */
export const PDF_PRESETS: Array<{ key: string; label: string; layout: BookletLayout }> = [
  { key: 'compact', label: '緊湊', layout: { fontSizePt: 11, lineHeight: 1.55, marginMm: 9, titleSizePt: 18, h1SizePt: 15, h2SizePt: 13, h3SizePt: 11.5 } },
  { key: 'standard', label: '標準', layout: { fontSizePt: 12, lineHeight: 1.7, marginMm: 12, titleSizePt: 19, h1SizePt: 16, h2SizePt: 14, h3SizePt: 12.5 } },
  { key: 'loose', label: '寬鬆', layout: { fontSizePt: 13, lineHeight: 1.9, marginMm: 16, titleSizePt: 20, h1SizePt: 17, h2SizePt: 15, h3SizePt: 13.5 } },
  { key: 'large', label: '大字', layout: { fontSizePt: 14, lineHeight: 1.8, marginMm: 12, titleSizePt: 21, h1SizePt: 18, h2SizePt: 16, h3SizePt: 14.5 } },
];

const DATA_KEYS: (keyof PdfExportSettings)[] = [
  'fontSizePt', 'lineHeight', 'marginMm',
  'titleSizePt', 'h1SizePt', 'h2SizePt', 'h3SizePt',
  'includeOriginal', 'includeToc', 'includeImages', 'includeQr', 'embedFont', 'pageFooter',
];

function load(): PdfExportSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...PDF_DEFAULTS };
    return { ...PDF_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...PDF_DEFAULTS };
  }
}

function save(s: PdfExportSettings) {
  const data = Object.fromEntries(DATA_KEYS.map((k) => [k, s[k]]));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota / private-mode failures — settings are non-critical
  }
}

interface PdfExportStore extends PdfExportSettings {
  update: (patch: Partial<PdfExportSettings>) => void;
  applyPreset: (key: string) => void;
  reset: () => void;
}

export const usePdfExportStore = create<PdfExportStore>((set, get) => ({
  ...load(),
  update: (patch) =>
    set((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    }),
  applyPreset: (key) => {
    const preset = PDF_PRESETS.find((p) => p.key === key);
    if (preset) get().update(preset.layout);
  },
  reset: () => get().update(PDF_DEFAULTS),
}));
