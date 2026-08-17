import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileStack, Plus } from 'lucide-react'
import { useGrantInterview } from '../grants/GrantInterviewContext'
import { ACTION_TYPES } from '../lib/grants/actionTypes'
import type { GrantStatus } from '../lib/grants/types'

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function GrantsLibraryPage() {
  const navigate = useNavigate()
  const { grants, resumeGrant, reset } = useGrantInterview()
  const [actionFilter, setActionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | GrantStatus>('all')

  const filtered = useMemo(
    () =>
      grants
        .filter((g) => actionFilter === 'all' || g.actionCode === actionFilter)
        .filter((g) => statusFilter === 'all' || g.status === statusFilter)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [actionFilter, grants, statusFilter],
  )

  function startNew() {
    reset()
    navigate('/grants/builder')
  }

  function open(id: string) {
    resumeGrant(id)
    navigate('/grants/builder')
  }

  if (grants.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6">
        <FileStack size={22} className="mb-3 text-app-text-dim" />
        <h1 className="font-display text-lg font-semibold text-app-text">No applications yet</h1>
        <p className="mt-1.5 max-w-md text-center text-sm text-app-text-dim">
          Answer one question at a time. We write the PDF from your answers at the end.
        </p>
        <button
          type="button"
          onClick={startNew}
          className="mt-5 inline-flex items-center gap-1.5 border border-app-accent bg-app-accent px-3 py-2 text-sm font-medium text-app-surface"
        >
          <Plus size={14} />
          Start a new application
        </button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-lg font-semibold text-app-text">Grant applications</h1>
          <button
            type="button"
            onClick={startNew}
            className="inline-flex items-center gap-1.5 border border-app-accent bg-app-accent px-3 py-2 text-sm font-medium text-app-surface"
          >
            <Plus size={14} />
            Start a new application
          </button>
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="border border-app-border bg-app-surface px-2 py-1.5 text-sm"
          >
            <option value="all">All action types</option>
            {ACTION_TYPES.filter((a) => a.supported).map((action) => (
              <option key={action.code} value={action.code}>
                {action.code}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | GrantStatus)}
            className="border border-app-border bg-app-surface px-2 py-1.5 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="in_review">In review</option>
            <option value="complete">Complete</option>
          </select>
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-app-text-dim">No applications match these filters.</p>
        ) : (
          <div className="overflow-hidden border border-app-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-app-border text-xs text-app-text-dim">
                  <th className="px-4 py-2.5 font-medium">Action</th>
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Complete</th>
                  <th className="px-4 py-2.5 font-medium">Last edited</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((grant) => (
                  <tr
                    key={grant.id}
                    onClick={() => open(grant.id)}
                    className="cursor-pointer border-b border-app-border last:border-0 hover:bg-app-panel-2"
                  >
                    <td className="px-4 py-3 text-app-accent">{grant.actionCode}</td>
                    <td className="px-4 py-3 text-app-text">{grant.title}</td>
                    <td className="px-4 py-3 text-app-text-dim">{grant.status.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-app-text-dim">{grant.percentComplete}%</td>
                    <td className="px-4 py-3 text-app-text-dim">{formatWhen(grant.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
