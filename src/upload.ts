/** Uploaded property lists (map, C1 option 2; W15): a CSV or XLSX is parsed in the browser into rows the buyer
 * corrects on screen. No library: CSV by hand, XLSX as a zip of XML with the two parts we need. */

export type UploadedProperty = { name: string; addr: string; units: number; year: number }
export type Problem = { line: number; text: string }
export type Parsed = { items: UploadedProperty[]; problems: Problem[] }

/* ---------- CSV ---------- */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += c
      continue
    }
    if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

/* ---------- XLSX: zip, then two XML parts ---------- */

type Entry = { method: number; size: number; offset: number }

function readZip(buf: ArrayBuffer): Map<string, Entry> {
  const b = new DataView(buf)
  const bytes = new Uint8Array(buf)
  let eocd = -1
  for (let i = buf.byteLength - 22; i >= 0 && i >= buf.byteLength - 65557; i--) {
    if (b.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('not a zip file')
  const count = b.getUint16(eocd + 10, true)
  let p = b.getUint32(eocd + 16, true)
  const out = new Map<string, Entry>()
  for (let n = 0; n < count; n++) {
    if (b.getUint32(p, true) !== 0x02014b50) throw new Error('bad zip directory')
    const method = b.getUint16(p + 10, true)
    const size = b.getUint32(p + 20, true)
    const nameLen = b.getUint16(p + 28, true)
    const extraLen = b.getUint16(p + 30, true)
    const commentLen = b.getUint16(p + 32, true)
    const local = b.getUint32(p + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen))
    // the data follows the local header, whose extra field can differ from the directory's
    const dataAt = local + 30 + b.getUint16(local + 26, true) + b.getUint16(local + 28, true)
    out.set(name, { method, size, offset: dataAt })
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

async function inflate(buf: ArrayBuffer, e: Entry): Promise<string> {
  const raw = new Uint8Array(buf, e.offset, e.size)
  if (e.method === 0) return new TextDecoder().decode(raw)
  if (e.method !== 8) throw new Error('unsupported zip compression ' + e.method)
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(stream).text()
}

function unescapeXml(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos|#x?[0-9a-f]+);/gi, (_, e: string) => {
    switch (e.toLowerCase()) {
      case 'amp':
        return '&'
      case 'lt':
        return '<'
      case 'gt':
        return '>'
      case 'quot':
        return '"'
      case 'apos':
        return "'"
    }
    return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
  })
}

/** Every <t> inside a fragment, joined: rich text splits one string over several runs. */
function textOf(xml: string): string {
  let out = ''
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += m[1]
  return unescapeXml(out)
}

function colIndex(ref: string): number {
  let n = 0
  for (const ch of ref) {
    if (ch < 'A' || ch > 'Z') break
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n - 1
}

/** The first worksheet as a grid of strings. Shared strings and inline strings resolved; numbers as typed. */
export async function parseXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const zip = readZip(buf)
  const sheetName =
    zip.has('xl/worksheets/sheet1.xml') ? 'xl/worksheets/sheet1.xml'
    : [...zip.keys()].filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0]
  if (!sheetName) throw new Error('no worksheet')
  const shared: string[] = []
  const ss = zip.get('xl/sharedStrings.xml')
  if (ss) for (const m of (await inflate(buf, ss)).matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textOf(m[1]))
  const sheet = await inflate(buf, zip.get(sheetName)!)
  const rows: string[][] = []
  for (const r of sheet.matchAll(/<row\b[^>]*?(?:\sr="(\d+)")?[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = []
    for (const c of r[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1]
      const inner = c[2] ?? ''
      const ref = /\sr="([A-Z]+)\d*"/.exec(attrs)?.[1]
      const type = /\st="(\w+)"/.exec(attrs)?.[1]
      const col = ref ? colIndex(ref) : cells.length
      let v = ''
      if (type === 's') v = shared[Number(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? -1)] ?? ''
      else if (type === 'inlineStr') v = textOf(inner)
      else v = unescapeXml(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '')
      while (cells.length < col) cells.push('')
      cells[col] = v
    }
    rows.push(cells)
  }
  return rows
}

/* ---------- rows → properties ---------- */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

type Cols = { name: number; addr: number; units: number; year: number }

/** Column positions from a header row; null when the row names neither a property nor a unit column. */
function header(row: string[]): Cols | null {
  const c: Cols = { name: -1, addr: -1, units: -1, year: -1 }
  row.forEach((h, i) => {
    const k = norm(h)
    if (c.name < 0 && (/^(property|propertyname|name|community|asset|site)$/.test(k) || (k.includes('name') && !k.includes('contact')))) c.name = i
    else if (c.addr < 0 && (k.includes('address') || k.includes('street'))) c.addr = i
    else if (c.units < 0 && k.includes('unit')) c.units = i
    else if (c.year < 0 && (k.includes('year') || k.includes('built') || k === 'yr')) c.year = i
  })
  return c.name >= 0 || c.units >= 0 ? c : null
}

const int = (s: string | undefined): number => {
  const n = Number((s ?? '').replace(/[,\s]/g, ''))
  return Number.isInteger(n) && n > 0 ? n : 0
}

/** Properties out of a grid. A recognised header row names the columns; without one the columns are taken as
 * name, address, units, year built. Rows with no name are reported, not kept; a bad unit count or year is
 * kept as 0 for the buyer to fix on screen. Blank rows are skipped. */
export function toProperties(rows: string[][]): Parsed {
  const items: UploadedProperty[] = []
  const problems: Problem[] = []
  const first = rows.find(r => r.some(x => x.trim()))
  const cols = first ? header(first) : null
  const c: Cols = cols ?? { name: 0, addr: 1, units: 2, year: 3 }
  const startAt = cols && first ? rows.indexOf(first) + 1 : 0
  rows.forEach((r, i) => {
    if (i < startAt || !r.some(x => x.trim())) return
    const name = (c.name >= 0 ? r[c.name] : '')?.trim() ?? ''
    if (!name) {
      problems.push({ line: i + 1, text: 'no property name' })
      return
    }
    const year = c.year >= 0 ? int(r[c.year]) : 0
    items.push({
      name,
      addr: (c.addr >= 0 ? r[c.addr] : '')?.trim() ?? '',
      units: c.units >= 0 ? int(r[c.units]) : 0,
      year: year >= 1800 && year <= 2100 ? year : 0,
    })
  })
  return { items, problems }
}

/** The file picker's file, by extension. */
export async function parseFile(file: File): Promise<Parsed> {
  const ext = file.name.toLowerCase().split('.').pop()
  if (ext === 'xlsx' || ext === 'xlsm') return toProperties(await parseXlsx(await file.arrayBuffer()))
  if (ext === 'xls') throw new Error('Please save the file as .xlsx or .csv first.')
  return toProperties(parseCsv(await file.text()))
}
