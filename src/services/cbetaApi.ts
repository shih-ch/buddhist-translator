const BASE_URL = 'https://cbdata.dila.edu.tw/stable';

export interface CBETAWorkInfo {
  work: string;
  title: string;
  juan: number;
  byline: string;
  creators: string;
  category: string;
  cjk_chars: number;
}

interface CBETAJuanResponse {
  num_found: number;
  results: string[];
  work_info?: CBETAWorkInfo;
}

interface CBETATocResponse {
  num_found: number;
  results: Array<{ juan: number; title?: string }>;
}

/** Validate CBETA work ID format (e.g. T0001, X0001, J0001, L0001) */
export function validateCBETAId(id: string): boolean {
  return /^[A-Z]{1,2}\d{4}[a-z]?$/i.test(id.trim());
}

/** Fetch work info (title, author, juans count) */
export async function fetchWorkInfo(workId: string): Promise<CBETAWorkInfo> {
  const id = workId.trim().toUpperCase();
  const resp = await fetch(`${BASE_URL}/juans?work=${id}&juan=1&work_info=1`);
  if (!resp.ok) throw new Error(`CBETA API 錯誤：${resp.status}`);
  const data: CBETAJuanResponse = await resp.json();
  if (!data.work_info) throw new Error(`找不到經文：${id}`);
  return data.work_info;
}

/** Fetch a single juan's text content */
export async function fetchJuanText(workId: string, juan: number): Promise<string> {
  const id = workId.trim().toUpperCase();
  const resp = await fetch(`${BASE_URL}/juans?work=${id}&juan=${juan}`);
  if (!resp.ok) throw new Error(`CBETA API 錯誤：${resp.status}`);
  const data: CBETAJuanResponse = await resp.json();
  if (data.num_found === 0 || !data.results.length) {
    throw new Error(`找不到 ${id} 卷${juan}`);
  }
  return htmlToPlainText(data.results[0]);
}

/** Fetch the list of juan numbers for a work */
export async function fetchJuanList(workId: string): Promise<number[]> {
  const id = workId.trim().toUpperCase();
  const resp = await fetch(`${BASE_URL}/works/toc?work=${id}`);
  if (!resp.ok) throw new Error(`CBETA API 錯誤：${resp.status}`);
  const data: CBETATocResponse = await resp.json();
  if (data.num_found === 0) {
    throw new Error(`找不到目錄：${id}`);
  }
  return data.results.map((r) => r.juan);
}

/** Convert CBETA HTML to plain text, preserving paragraph structure */
export function htmlToPlainText(html: string): string {
  // Remove inline notes and apparatus
  let text = html.replace(/<note[^>]*>[\s\S]*?<\/note>/gi, '');
  // Convert <p>, <br>, <div> to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<p[^>]*>/gi, '');
  text = text.replace(/<div[^>]*>/gi, '');
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // Clean up whitespace: collapse multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}
