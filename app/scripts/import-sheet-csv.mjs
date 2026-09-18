#!/usr/bin/env node
/**
 * import-sheet-csv.mjs — One-time migration: Google Sheets Expenses tab → Supabase.
 *
 * Usage:
 *   node scripts/import-sheet-csv.mjs \
 *     --csv  ~/Downloads/RupiBook-Expenses.csv \
 *     --url  https://YOURPROJECT.supabase.co \
 *     --key  $SUPABASE_SERVICE_ROLE_KEY \
 *     --book "Personal" [--user <auth-user-uuid>] [--dry-run]
 *
 * Expected CSV header (File → Download → CSV from the Sheets UI):
 *   Timestamp, Amount, Category, Category, Source, Payment Mode, Tags, Comments
 *   (exact order per the legacy appscript setupSheets(); extra columns ignored)
 *
 * Creates the book if needed, creates categories/sources/modes on first sight,
 * then inserts expenses in batches. Idempotent-ish: re-running creates a NEW book
 * unless --book matches an existing one for the user (then it appends).
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

// ── args ──
const args = process.argv.slice(2)
function arg(name) {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? undefined : args[i + 1]
}
const csvPath = arg('csv')
const url = arg('url') ?? process.env.SUPABASE_URL
const key = arg('key') ?? process.env.SUPABASE_SERVICE_ROLE_KEY
const bookName = arg('book') ?? 'Personal'
const userId = arg('user')
const dry = args.includes('--dry-run')

if (!args.includes('--selftest') && (!csvPath || !url || !key || !userId)) {
  console.error('Required: --csv <file> --url <supabase-url> --key <service-role-key> --user <uuid> [--book Personal] [--dry-run]')
  process.exit(1)
}

// ── RFC4180 CSV parser (stdlib only) ──
function parseCsv(text) {
  const rows = []
  let row = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQ = false
      } else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(f => f !== '')) rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

// ── timestamp parse ──
// The source sheet mixes two locales, so the separator decides the format:
//   dashes "01-06-2026" = Indian dd-mm-yyyy
//   slashes "8/23/2026" = US m/d/yyyy
// (verified against the file's own chronological ordering). ISO strings and
// "23-Aug-2026" forms also work. Everything lands as IST.
function toIso(ts) {
  const s = String(ts).trim()
  const dmy = s.match(/^(\d{1,2})([-/])(\d{1,2})\2(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*([AaPp][Mm])?$/)
  if (dmy) {
    let dd, mm
    if (dmy[2] === '/') { mm = Number(dmy[1]); dd = Number(dmy[3]) } // m/d/yyyy
    else { dd = Number(dmy[1]); mm = Number(dmy[3]) }                // dd-mm-yyyy
    if (mm > 12) [dd, mm] = [mm, dd]
    let h = Number(dmy[5] ?? 0)
    const ap = dmy[8]?.toLowerCase()
    if (ap === 'pm' && h < 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    const pad = n => String(n).padStart(2, '0')
    return new Date(
      `${dmy[4]}-${pad(mm)}-${pad(dd)}T${pad(h)}:${pad(Number(dmy[6] ?? 0))}:${pad(Number(dmy[7] ?? 0))}+05:30`,
    ).toISOString()
  }
  const d = new Date(s) // ISO strings are unambiguous
  if (!isNaN(d)) return d.toISOString()
  const m = s.match(/(\d{1,2})[-\s]?([A-Za-z]{3})[-\s]?(\d{4})/)
  if (m) return new Date(`${m[3]}-${months[m[2].toLowerCase()]}-${m[1].padStart(2,'0')}T12:00:00+05:30`).toISOString()
  throw new Error(`Unparseable timestamp: "${ts}"`)
}
const months = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' }

/** "₹8,500.00" | "8500" | "" → number | NaN */
function toAmount(raw) {
  return parseFloat(String(raw ?? '').replace(/[₹,\s]/g, ''))
}

// ── self-test: node import-sheet-csv.mjs --selftest ──
if (args.includes('--selftest')) {
  const sample = [
    'Timestamp,Amount,Category,Source,Payment Mode,Tags,Comments',
    '"8/23/2026 9:30:00",250.50,Food,Swiggy,UPI,"#food #swiggy","lunch order, quick"',
    '"23-Aug-2026",0,Groceries,Blinkit,Cash,,free coupon',
    '"01-06-2026 09:55:22","₹8,500.00",Bills,,,,rent',
    '"13-06-2026 21:10:00",120,Transport,,,,"dinner, out"',
  ].join('\n')
  const rows = parseCsv(sample)
  console.assert(rows.length === 5, 'row count')
  console.assert(rows[1][1] === '250.50' && rows[1][4] === 'UPI', 'quoted fields')
  console.assert(toIso(rows[1][0]).startsWith(new Date('8/23/2026 09:30').getFullYear() + '-08-23'), 'us timestamp')
  console.assert(!isNaN(new Date(toIso(rows[2][0]))), 'dd-Mon-yyyy fallback')
  console.assert(toIso(rows[3][0]).startsWith('2026-06-01'), 'dd-mm-yyyy is day-first (Jun 1, not Jan 6)')
  console.assert(toIso('7/5/2026 16:56:17').endsWith('Z')
    && new Date(toIso('7/5/2026')).toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' }).startsWith('2026-07-05'),
    'm/d/yyyy is month-first (Jul 5 IST, not May 7)')
  console.assert(toAmount(rows[3][1]) === 8500, 'rupee+comma amount')
  console.assert(!isNaN(new Date(toIso(rows[4][0]))), 'day > 12 does not crash')
  console.assert(toIso('2026-06-01T04:25:00Z').startsWith('2026-06-01'), 'iso passthrough')
  console.log('selftest OK')
  process.exit(0)
}

// No client in dry-run: lets you validate a CSV without touching credentials.
const sb = dry ? null : createClient(url, key, { auth: { persistSession: false } })

// ── book ──
let book
if (!dry) {
  const { data } = await sb.from('books').select('id').eq('user_id', userId).eq('name', bookName).maybeSingle()
  book = data
}
if (!book) {
  if (dry) {
    console.log(`[dry] would create book "${bookName}"`)
    book = { id: 'dry-book' }
  } else {
    const { data, error } = await sb.from('books').insert({ user_id: userId, name: bookName }).select('id').single()
    if (error) throw error
    book = data
  }
}
console.log(`Book: ${bookName} (${book.id})`)

// caches name → id
const cats = new Map(), srcs = new Map(), modes = new Map()

async function ensureCat(name) {
  if (!name) return null
  if (cats.has(name)) return cats.get(name)
  // The book may already contain defaults (signup seeds Food, Transport…),
  // so reuse by name before creating.
  const { data: existing, error: lookupErr } = await sb
    .from('categories').select('id').eq('book_id', book.id).eq('name', name).maybeSingle()
  if (lookupErr) throw lookupErr
  let id = existing?.id
  if (!id) {
    id = crypto.randomUUID()
    const { error } = await sb.from('categories').insert({ id, book_id: book.id, name })
    if (error) throw error
  }
  cats.set(name, id)
  return id
}
async function ensureSrc(catId, name) {
  if (!name) return null
  const k = `${catId}|${name}`
  if (srcs.has(k)) return srcs.get(k)
  const { data: existing, error: lookupErr } = await sb
    .from('sources').select('id').eq('book_id', book.id).eq('name', name).maybeSingle()
  if (lookupErr) throw lookupErr
  let id = existing?.id
  if (!id) {
    id = crypto.randomUUID()
    const { error } = await sb.from('sources').insert({ id, book_id: book.id, category_id: catId, name })
    if (error) throw error
  }
  srcs.set(k, id)
  return id
}
async function ensureMode(name) {
  if (!name) return null
  if (modes.has(name)) return modes.get(name)
  const { data: existing, error: lookupErr } = await sb
    .from('payment_modes').select('id').eq('book_id', book.id).eq('name', name).maybeSingle()
  if (lookupErr) throw lookupErr
  let id = existing?.id
  if (!id) {
    id = crypto.randomUUID()
    const { error } = await sb.from('payment_modes').insert({ id, book_id: book.id, name })
    if (error) throw error
  }
  modes.set(name, id)
  return id
}

// ── rows → expenses ──
const [header, ...lines] = parseCsv(readFileSync(csvPath, 'utf8'))
const col = n => header.findIndex(h => h.trim().toLowerCase() === n)

const cTs = col('timestamp'), cAmt = col('amount'), cCat = col('category'),
      cSrc = col('source'), cMode = col(/payment/.test(header.join()) ? 'payment mode' : 'payment_mode'),
      cTags = col('tags'), cNotes = col('comments')

let ok = 0, skipped = 0, batch = []
for (const line of lines) {
  const amount = toAmount(line[cAmt])
  const category = (line[cCat] || '').trim()
  const tsRaw = (line[cTs] || '').trim()
  if (!amount || Number.isNaN(amount) || !category || !tsRaw) {
    skipped++
    console.warn(`[skip] amount="${line[cAmt]}" category="${category}" timestamp="${tsRaw}"`)
    continue
  }

  let spent_at
  try {
    spent_at = toIso(tsRaw)
  } catch (e) {
    skipped++
    console.warn(`[skip] ${e.message}`)
    continue
  }
  const tags = (line[cTags] || '').split(/\s+/).map(t => t.replace(/^#/, '').toLowerCase()).filter(Boolean)

  if (dry) { ok++; continue }

  batch.push({
    book_id: book.id,
    amount,
    category_id: await ensureCat(category),
    source_id: await ensureSrc(await ensureCat(category), (line[cSrc] || '').trim() || null),
    payment_mode_id: await ensureMode((line[cMode] || '').trim() || null),
    notes: (line[cNotes] || '').trim(),
    tags,
    spent_at,
  })

  if (batch.length >= 500) {
    const { error } = await sb.from('expenses').insert(batch)
    if (error) throw error
    ok += batch.length; batch = []
    process.stdout.write(`\r${ok} imported…`)
  }
}
if (batch.length) {
  const { error } = await sb.from('expenses').insert(batch)
  if (error) throw error
  ok += batch.length
}

console.log(`\nDone. ${ok} expenses imported, ${skipped} rows skipped (blank/invalid).`)
console.log(`Categories: ${cats.size}, Sources: ${srcs.size}, Modes: ${modes.size}`)

// sanity checksum
const hashOf = n => createHash('sha256').update(String(n)).digest('hex').slice(0, 8)
console.log(`Checksum hint: total-rows ${hashOf(ok)} (compare with your Sheet row count manually)`)
