import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import {
  getDocumentDownloadUrl,
  listDocuments,
  type DocumentSummary,
} from '../../api/documentsClient'

export function DocumentsPage() {
  const { accessToken, profile } = useAuth()
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listDocuments(accessToken)
      .then((rows) => {
        if (!cancelled) setDocuments(rows)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load documents')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken])

  async function download(id: string, format: 'pdf' | 'md' | 'docx') {
    try {
      const url = await getDocumentDownloadUrl(accessToken, id, format)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold">Documents</h1>
      <p className="mb-5 text-sm text-app-text-dim">
        Generated application drafts. Download the PDF (DOCX and Markdown are also available). Cap
        this month: {profile?.documentsUsedThisMonth ?? 0} /{' '}
        {profile?.features.monthlyDocumentLimit ?? 3}.
      </p>
      {error && (
        <p role="alert" className="mb-3 text-xs text-app-danger">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-app-text-dim">Loading…</p>
      ) : documents.length === 0 ? (
        <p className="text-sm text-app-text-dim">
          No drafts yet. Ask in chat to draft an application — it opens in a canvas you can keep
          revising.
        </p>
      ) : (
        <ul className="divide-y divide-app-border rounded-xl border border-app-border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{doc.title}</div>
                <div className="text-xs text-app-text-dim">
                  {new Date(doc.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="font-medium underline underline-offset-2"
                  onClick={() => void download(doc.id, 'pdf')}
                >
                  PDF
                </button>
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => void download(doc.id, 'docx')}
                >
                  DOCX
                </button>
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => void download(doc.id, 'md')}
                >
                  MD
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
