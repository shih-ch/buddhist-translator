import type { ArticleFrontmatter } from '@/types/article'

/**
 * Export article as PDF using html2pdf.js (dynamically imported).
 */
export async function exportPDF(
  htmlContent: string,
  _metadata: ArticleFrontmatter,
  filename: string
): Promise<void> {
  const html2pdf = (await import('html2pdf.js')).default

  // Create a container with styled content
  const container = document.createElement('div')
  container.innerHTML = htmlContent
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  container.style.lineHeight = '1.7'
  container.style.color = '#333'
  container.style.padding = '20px'

  // Style tables
  container.querySelectorAll('table').forEach((table) => {
    ;(table as HTMLElement).style.borderCollapse = 'collapse'
    ;(table as HTMLElement).style.width = '100%'
  })
  container.querySelectorAll('th, td').forEach((cell) => {
    ;(cell as HTMLElement).style.border = '1px solid #ddd'
    ;(cell as HTMLElement).style.padding = '8px'
    ;(cell as HTMLElement).style.textAlign = 'left'
  })

  const opt = {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as string[] },
  }

  document.body.appendChild(container)
  try {
    await html2pdf().set(opt).from(container).save()
  } finally {
    document.body.removeChild(container)
  }
}

/**
 * Export article as DOCX using the docx library (dynamically imported).
 */
export async function exportDOCX(
  plainContent: string,
  metadata: ArticleFrontmatter,
  filename: string
): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx')

  const paragraphs: InstanceType<typeof Paragraph>[] = []

  // Title
  if (metadata.title) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: metadata.title, bold: true, size: 32 })],
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    )
  }

  // Metadata line
  const metaParts: string[] = []
  if (metadata.author) metaParts.push(`作者：${metadata.author}`)
  if (metadata.date) metaParts.push(`日期：${metadata.date}`)
  if (metaParts.length > 0) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: metaParts.join('  |  '), size: 20, color: '666666' })],
        spacing: { after: 300 },
      })
    )
  }

  // Content: split by lines, detect headings from markdown
  const lines = plainContent.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()

    // Skip frontmatter
    if (trimmed === '---') continue
    if (/^[a-z_]+:/.test(trimmed)) continue

    // Headings
    const h1Match = trimmed.match(/^# (.+)/)
    const h2Match = trimmed.match(/^## (.+)/)
    const h3Match = trimmed.match(/^### (.+)/)

    if (h1Match) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: h1Match[1], bold: true, size: 28 })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      }))
    } else if (h2Match) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: h2Match[1], bold: true, size: 24 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }))
    } else if (h3Match) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: h3Match[1], bold: true, size: 22 })],
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 160, after: 80 },
      }))
    } else if (trimmed === '') {
      paragraphs.push(new Paragraph({ children: [] }))
    } else {
      // Strip basic markdown formatting for plain text
      const cleaned = trimmed
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')

      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: cleaned, size: 22 })],
        spacing: { after: 80 },
      }))
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
