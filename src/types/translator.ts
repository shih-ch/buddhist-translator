export interface ArticleImage {
  name: string;
  url: string;
  path: string;
  sha: string;
}

export interface SavedVersion {
  id: string;
  name: string;
  content: string;
  model: string;
  provider: string;
  timestamp: number;
}
