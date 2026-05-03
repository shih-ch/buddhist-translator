export interface MantraRow {
  label: string
}

export interface Mantra {
  title: string
  rows: MantraRow[]
  segments: Array<Record<string, string>>
  summary: string
  notes?: string
}

export interface ExtractMantraResponse {
  mantras: Mantra[]
}
