/**
 * If the given file is a PDF, render page 1 to a JPG and return that as a File.
 * Otherwise return the file unchanged. Client-side only — uses pdfjs-dist dynamically.
 */
export async function ensureImage(file: File): Promise<File> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) return file

  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  const page = await pdf.getPage(1)

  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  await page.render({ canvasContext: ctx, viewport, canvas }).promise

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  if (!blob) throw new Error('Failed to convert PDF to image')

  const baseName = file.name.replace(/\.pdf$/i, '')
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
}
