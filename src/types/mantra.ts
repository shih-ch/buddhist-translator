export interface MantraRow {
  label: string
}

export interface Mantra {
  title: string
  rows: MantraRow[]
  segments: Array<Record<string, string>>
  /** Segment indices (>0, sorted, unique) where a new sub-table starts.
   *  e.g. [10] means render segments 0..9 as one table, 10..end as another. */
  breaks?: number[]
  summary: string
  notes?: string
}

export interface ExtractMantraResponse {
  mantras: Mantra[]
}
