import { useState, useCallback } from 'react'
import { Plus, X, GripVertical } from 'lucide-react'
import Sheet from './ui/Sheet'
import Button from './ui/Button'
import { toast } from './ui/Toast'
import {
  useAddCategory, useAddMode, useAddSource,
  useCatalog, useDeleteCategory, useDeleteMode, useDeleteSource, useReassignExpenses,
  useReorderCategories,
} from '@/hooks/data'

type ReassignKind = 'category' | 'source' | 'mode'
interface ReassignItem { kind: ReassignKind; id: string; name: string }

const REASSIGN_COLUMN: Record<ReassignKind, 'category_id' | 'source_id' | 'payment_mode_id'> = {
  category: 'category_id',
  source: 'source_id',
  mode: 'payment_mode_id',
}
// category_id is NOT NULL on expenses — unlike source/mode, a category can
// only be reassigned to another category, never cleared.
const REASSIGN_ALLOWS_UNASSIGN: Record<ReassignKind, boolean> = { category: false, source: true, mode: true }

/**
 * Categories / sources / payment modes manager.
 * Deletes fail with a clear toast when expenses still reference the row
 * (FK has no cascade on purpose — no silent data loss).
 */
export default function CatalogSheet({ open, onClose, bookId }: { open: boolean; onClose: () => void; bookId: string | null }) {
  const { data: catalog } = useCatalog(bookId)
  const addCat = useAddCategory(bookId)
  const delCat = useDeleteCategory(bookId)
  const reorderCats = useReorderCategories(bookId)
  const addSrc = useAddSource(bookId)
  const delSrc = useDeleteSource(bookId)
  const addMode = useAddMode(bookId)
  const delMode = useDeleteMode(bookId)
  const reassign = useReassignExpenses(bookId)

  const [catName, setCatName] = useState('')
  const [srcName, setSrcName] = useState('')
  const [srcCat, setSrcCat] = useState('')
  const [modeName, setModeName] = useState('')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [reassignItem, setReassignItem] = useState<ReassignItem | null>(null)
  const [reassignTarget, setReassignTarget] = useState('')

  function isForeignKeyError(e: unknown): boolean {
    const msg = e && typeof e === 'object' && 'message' in e
      ? String((e as { message: unknown }).message)
      : e instanceof Error ? e.message : String(e)
    return msg.includes('foreign key')
  }

  function fail(e: unknown) {
    // Supabase errors are objects with message, code, details, hint
    const msg = e && typeof e === 'object' && 'message' in e
      ? String((e as { message: unknown }).message)
      : e instanceof Error ? e.message : String(e)
    if (msg.includes('foreign key')) {
      toast({ tone: 'error', title: 'In use', message: 'Expenses still reference this. Reassign or delete them first.' })
    } else if (msg.includes('duplicate key')) {
      toast({ tone: 'info', title: 'Already exists' })
    } else {
      toast({ tone: 'error', title: 'Failed', message: msg })
    }
  }

  function deleteMutationFor(kind: ReassignKind) {
    return kind === 'category' ? delCat : kind === 'source' ? delSrc : delMode
  }

  function deleteWithReassignFallback(kind: ReassignKind, id: string, name: string) {
    deleteMutationFor(kind).mutate(id, {
      onError: e => { if (isForeignKeyError(e)) { setReassignTarget(''); setReassignItem({ kind, id, name }) } else fail(e) },
    })
  }

  function confirmReassignAndDelete() {
    if (!reassignItem) return
    if (!reassignTarget && !REASSIGN_ALLOWS_UNASSIGN[reassignItem.kind]) return
    reassign.mutate(
      { column: REASSIGN_COLUMN[reassignItem.kind], fromId: reassignItem.id, toId: reassignTarget || null },
      {
        onSuccess: () => {
          deleteMutationFor(reassignItem.kind).mutate(reassignItem.id, {
            onSuccess: () => { toast({ tone: 'success', title: 'Deleted' }); setReassignItem(null) },
            onError: fail,
          })
        },
        onError: fail,
      },
    )
  }

  /** Persist new category order after drag-and-drop. */
  function commitOrder(ids: string[]) {
    reorderCats.mutate(ids, { onError: fail })
  }

  /** Native HTML5 drag-and-drop handlers for category reordering. */
  const onDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
    setDraggedIndex(index)
    // Visual feedback
    ;(e.currentTarget as HTMLElement).style.opacity = '0.5'
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDragEnter = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    const ids = catalog?.categories.map(c => c.id) ?? []
    const from = draggedIndex
    const to = index
    const newIds = [...ids]
    const [removed] = newIds.splice(from, 1)
    newIds.splice(to, 0, removed)
    commitOrder(newIds)
    setDraggedIndex(index)
  }, [catalog, draggedIndex])

  const onDragEnd = useCallback((e: React.DragEvent) => {
    ;(e.currentTarget as HTMLElement).style.opacity = '1'
    setDraggedIndex(null)
  }, [])

  const inputCls = 'min-w-0 flex-1 rounded-card border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand'

  return (
    <Sheet open={open} onClose={onClose} title="Categories & sources">
      <div className="space-y-6">
        {/* Categories */}
        <section>
          <p className="mb-2 text-xs font-semibold text-text-3">Categories</p>
          <div className="mb-2 flex gap-2">
            <input value={catName} onChange={e => setCatName(e.target.value)} placeholder="New category…"
              onKeyDown={e => e.key === 'Enter' && catName.trim() && addCat.mutate(catName.trim(), { onSuccess: () => setCatName(''), onError: fail })}
              className={inputCls} />
            <Button variant="secondary" className="!px-3" disabled={!catName.trim()}
              onClick={() => addCat.mutate(catName.trim(), { onSuccess: () => { setCatName(''); toast({ tone: 'success', title: 'Category added' }) }, onError: fail })}>
              <Plus size={16} />
            </Button>
          </div>
          <div className="space-y-1">
            {catalog?.categories.map((c, i) => (
              <div
                key={c.id}
                draggable
                onDragStart={e => onDragStart(e, i)}
                onDragOver={onDragOver}
                onDragEnter={e => onDragEnter(e, i)}
                onDragEnd={onDragEnd}
                className={`flex items-center gap-1 rounded-card border border-line bg-surface-2 py-1 pl-3 pr-1 cursor-grab active:cursor-grabbing transition-opacity ${reorderCats.isPending ? 'opacity-60' : ''} ${draggedIndex === i ? 'opacity-50 bg-brand-tint' : ''}`}
                style={{ touchAction: 'none' }}
              >
                <GripVertical size={14} className="text-text-3 shrink-0 select-none" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-2">{c.name}</span>
                <button aria-label={`Delete ${c.name}`} onClick={() => deleteWithReassignFallback('category', c.id, c.name)} className="tap-none rounded-full p-1 text-text-3 hover:text-danger">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-text-3">Drag to reorder · order here is the order you see while logging.</p>

          {reassignItem?.kind === 'category' && (
            <div className="mt-2 space-y-2 rounded-card border border-line bg-surface-2 p-3">
              <p className="text-xs text-text-2">
                <span className="font-semibold text-text-1">{reassignItem.name}</span> has expenses in it.
                Move them to another category first, then it can be deleted.
              </p>
              {catalog && catalog.categories.filter(c => c.id !== reassignItem.id).length === 0 ? (
                <p className="text-xs text-danger">This is the only category left — add another one before deleting this.</p>
              ) : (
                <select value={reassignTarget} onChange={e => setReassignTarget(e.target.value)} className={`w-full ${inputCls}`}>
                  <option value="">Pick a category…</option>
                  {catalog?.categories.filter(c => c.id !== reassignItem.id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setReassignItem(null)}>Cancel</Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  disabled={!reassignTarget}
                  loading={reassign.isPending || delCat.isPending}
                  onClick={confirmReassignAndDelete}
                >
                  Move &amp; delete
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Sources */}
        <section>
          <p className="mb-2 text-xs font-semibold text-text-3">Sources</p>
          <div className="mb-2 flex gap-2">
            <select value={srcCat} onChange={e => setSrcCat(e.target.value)} className={`${inputCls} !flex-none basis-32`}>
              <option value="">Any category</option>
              {catalog?.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={srcName} onChange={e => setSrcName(e.target.value)} placeholder="e.g. Swiggy"
              onKeyDown={e => e.key === 'Enter' && srcName.trim() && addSrc.mutate({ name: srcName.trim(), category_id: srcCat || null }, { onSuccess: () => setSrcName(''), onError: fail })}
              className={inputCls} />
            <Button variant="secondary" className="!px-3" disabled={!srcName.trim()}
              onClick={() => addSrc.mutate({ name: srcName.trim(), category_id: srcCat || null }, { onSuccess: () => { setSrcName(''); toast({ tone: 'success', title: 'Source added' }) }, onError: fail })}>
              <Plus size={16} />
            </Button>
          </div>
          <div className="space-y-1">
            {catalog?.sources.length === 0 && (
              <p className="text-[11px] text-text-3">
                No sources yet. The Log page works without them; add merchants or places here to get a second chip rail.
              </p>
            )}
            {catalog?.sources.map(s => (
              <div key={s.id} className="flex items-center justify-between rounded-card border border-line bg-surface-2 px-3 py-1.5">
                <span className="truncate text-xs text-text-2">
                  {s.name}
                  <span className="ml-1.5 text-text-3">
                    · {catalog.categories.find(c => c.id === s.category_id)?.name ?? 'any'}
                  </span>
                </span>
                <button aria-label={`Delete ${s.name}`} onClick={() => deleteWithReassignFallback('source', s.id, s.name)} className="tap-none p-0.5 text-text-3 hover:text-danger">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>

          {reassignItem?.kind === 'source' && (
            <div className="mt-2 space-y-2 rounded-card border border-line bg-surface-2 p-3">
              <p className="text-xs text-text-2">
                <span className="font-semibold text-text-1">{reassignItem.name}</span> has expenses pointing at it.
                Move them to another source first, then it can be deleted.
              </p>
              <select value={reassignTarget} onChange={e => setReassignTarget(e.target.value)} className={`w-full ${inputCls}`}>
                <option value="">Unassign (no source)</option>
                {catalog?.sources.filter(s => s.id !== reassignItem.id).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setReassignItem(null)}>Cancel</Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  loading={reassign.isPending || delSrc.isPending}
                  onClick={confirmReassignAndDelete}
                >
                  Move &amp; delete
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Payment modes */}
        <section>
          <p className="mb-2 text-xs font-semibold text-text-3">Payment modes</p>
          <div className="mb-2 flex gap-2">
            <input value={modeName} onChange={e => setModeName(e.target.value)} placeholder="e.g. Credit Card"
              onKeyDown={e => e.key === 'Enter' && modeName.trim() && addMode.mutate(modeName.trim(), { onSuccess: () => setModeName(''), onError: fail })}
              className={inputCls} />
            <Button variant="secondary" className="!px-3" disabled={!modeName.trim()}
              onClick={() => addMode.mutate(modeName.trim(), { onSuccess: () => { setModeName(''); toast({ tone: 'success', title: 'Payment mode added' }) }, onError: fail })}>
              <Plus size={16} />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {catalog?.paymentModes.map(m => (
              <span key={m.id} className="flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1.5 text-xs font-medium text-text-2">
                {m.name}
                <button aria-label={`Delete ${m.name}`} onClick={() => deleteWithReassignFallback('mode', m.id, m.name)} className="tap-none rounded-full p-0.5 text-text-3 hover:text-danger">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>

          {reassignItem?.kind === 'mode' && (
            <div className="mt-2 space-y-2 rounded-card border border-line bg-surface-2 p-3">
              <p className="text-xs text-text-2">
                <span className="font-semibold text-text-1">{reassignItem.name}</span> has expenses paid via it.
                Move them to another payment mode first, then it can be deleted.
              </p>
              <select value={reassignTarget} onChange={e => setReassignTarget(e.target.value)} className={`w-full ${inputCls}`}>
                <option value="">Unassign (no payment mode)</option>
                {catalog?.paymentModes.filter(m => m.id !== reassignItem.id).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setReassignItem(null)}>Cancel</Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  loading={reassign.isPending || delMode.isPending}
                  onClick={confirmReassignAndDelete}
                >
                  Move &amp; delete
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </Sheet>
  )
}