import { useState } from 'react'
import { stubLookup, type AddressLookup } from '../lookup'
import { emptyDraft, type Draft, type Property, type PropsRow } from '../model'
import { parseFile } from '../upload'

let nextId = 1

type Props = {
  row: PropsRow
  onChange: (r: PropsRow) => void
  onEnter: () => void
  /** The address lookup; the stub until ticket 2. */
  lookup?: AddressLookup
}

const Lab = ({ t }: { t: string }) => <span className="lab">{t}</span>

const yearOk = (y: number) => y >= 1800 && y <= 2100

/** C1, one route row (map, C1): one by one with an address lookup, an uploaded list, or counts. */
export default function PropertiesStep({ row, onChange, onEnter, lookup = stubLookup }: Props) {
  const d = row.draft
  const [busy, setBusy] = useState(false)
  const [fileErr, setFileErr] = useState('')
  const setDraft = (p: Partial<Draft>) => onChange({ ...row, draft: { ...row.draft, ...p } })

  const doLookup = () => {
    if (!d.addr.trim()) {
      setDraft({ err: 'Enter an address to look up.' })
      return
    }
    setBusy(true)
    lookup(d.addr)
      .then(g => {
        // The source doesn't always return units and year built, so the buyer confirms or enters both (map, C1).
        if (!g) setDraft({ looked: true, found: false, units: '', year: '', err: '' })
        else setDraft({ looked: true, found: g.units !== null || g.yearBuilt !== null, addr: g.address, units: g.units ? String(g.units) : '', year: g.yearBuilt ? String(g.yearBuilt) : '', err: '' })
      })
      .catch(() => setDraft({ looked: true, found: false, err: 'The lookup didn’t answer. Enter the details yourself.' }))
      .finally(() => setBusy(false))
  }

  const addItem = () => {
    const units = Number(d.units)
    const year = Number(d.year)
    if (!d.name.trim()) return setDraft({ err: 'Add the property name.' })
    if (!(units > 0)) return setDraft({ err: 'Enter the unit count.' })
    if (!yearOk(year)) return setDraft({ err: 'Enter the year built.' })
    onChange({ ...row, items: [...row.items, { id: nextId++, name: d.name.trim(), addr: d.addr.trim(), units, year }], draft: emptyDraft() })
  }

  const remove = (id: number) => onChange({ ...row, items: row.items.filter(p => p.id !== id) })
  const edit = (id: number, p: Partial<Property>) => onChange({ ...row, items: row.items.map(x => (x.id === id ? { ...x, ...p } : x)) })
  const enter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onEnter()
    }
  }

  const onFile = (f: File) => {
    setFileErr('')
    parseFile(f)
      .then(p => {
        const items = p.items.map(x => ({ id: nextId++, ...x }))
        onChange({ ...row, mode: 'upload', file: f.name, blob: f, items, problems: p.problems, count: 0, units: 0 })
      })
      .catch((e: Error) => {
        setFileErr(e.message || 'We couldn’t read that file.')
        onChange({ ...row, mode: 'upload', file: f.name, blob: f, items: [], problems: [] })
      })
  }

  const uploadLink = (
    <label className="link" style={{ cursor: 'pointer' }}>
      + Upload property list
      <input
        type="file"
        accept=".csv,.xlsx,.xlsm"
        hidden
        data-testid="upload"
        onChange={e => {
          const f = e.target.files && e.target.files[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </label>
  )

  const counts = (
    <div className="fields">
      <label className="field">
        <Lab t="Property count" />
        <input className="inp" type="number" min={1} value={row.count || ''} placeholder="0" onChange={e => onChange({ ...row, count: Math.max(0, Math.floor(+e.target.value || 0)) })} onKeyDown={enter} />
      </label>
      <label className="field">
        <Lab t="Units" />
        <input className="inp" type="number" min={1} value={row.units || ''} placeholder="0" onChange={e => onChange({ ...row, units: Math.max(0, Math.floor(+e.target.value || 0)) })} onKeyDown={enter} />
      </label>
    </div>
  )

  return (
    <div className="stack" style={{ gap: 14 }}>
      {row.mode === 'list' ? (
        <div className="stack" style={{ gap: 12 }}>
          {row.items.length > 0 && (
            <div className="items">
              {row.items.map(p => (
                <div key={p.id} className="item">
                  <div className="item-main">
                    <span className="item-name">{p.name}</span>
                    <span className="item-line">
                      {p.addr ? p.addr + ' · ' : ''}
                      {p.units} units · built {p.year}
                    </span>
                  </div>
                  <button type="button" className="link iconbtn" aria-label={'Remove ' + p.name} onClick={() => remove(p.id)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="lookgrid">
            <label className="field">
              <Lab t="Property name" />
              <input className="inp sm" value={d.name} placeholder="e.g. The Grove" onChange={e => setDraft({ name: e.target.value })} />
            </label>
            <label className="field">
              <Lab t="Address" />
              <input
                className="inp sm"
                value={d.addr}
                placeholder="Street, city, state"
                onChange={e => setDraft({ addr: e.target.value, looked: false })}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    doLookup()
                  }
                }}
              />
            </label>
            <button type="button" className="btn sm" onClick={doLookup} disabled={busy}>
              {busy ? 'Looking…' : 'Look up'}
            </button>
          </div>
          {d.looked && (
            <>
              <div className="unitgrid">
                <label className="field">
                  <Lab t="Units" />
                  <input className="inp sm" type="number" min={1} value={d.units} onChange={e => setDraft({ units: e.target.value })} />
                </label>
                <label className="field">
                  <Lab t="Year built" />
                  <input className="inp sm" type="number" min={1800} max={2100} value={d.year} onChange={e => setDraft({ year: e.target.value })} />
                </label>
                <button type="button" className="btn2 outline" onClick={addItem}>
                  + Add this property
                </button>
              </div>
              <span className="hint">
                {d.found ? 'Please confirm units and year built. We use them to match the right property.' : 'Please enter units and year built. We use them to match the right property.'}
              </span>
            </>
          )}
          {d.err && (
            <span role="alert" className="err">
              {d.err}
            </span>
          )}
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {row.mode === 'upload' && row.file && (
            <div className="filebox">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              <span>{row.file}</span>
              <button type="button" className="link" onClick={() => onChange({ ...row, mode: 'count', file: '', blob: null, items: [], problems: [] })}>
                Remove
              </button>
            </div>
          )}
          {row.mode === 'upload' && row.items.length > 0 ? (
            <>
              <span className="hint">
                {row.items.length} properties read from the file. Check the units and year built; fix anything we got wrong.
                {row.problems.length ? ' Skipped ' + row.problems.map(p => 'line ' + p.line + ' (' + p.text + ')').join(', ') + '.' : ''}
              </span>
              <div className="items" style={{ maxHeight: 280 }}>
                {row.items.map(p => (
                  <div key={p.id} className="item">
                    <div className="item-main">
                      <span className="item-name">{p.name}</span>
                      {p.addr && <span className="item-line">{p.addr}</span>}
                    </div>
                    <input className={'inp sm' + (p.units > 0 ? '' : ' bad')} style={{ width: 96 }} type="number" min={1} aria-label={'Units for ' + p.name} placeholder="Units" value={p.units || ''} onChange={e => edit(p.id, { units: Math.max(0, Math.floor(+e.target.value || 0)) })} />
                    <input className="inp sm" style={{ width: 110 }} type="number" min={1800} max={2100} aria-label={'Year built for ' + p.name} placeholder="Year" value={p.year || ''} onChange={e => edit(p.id, { year: Math.floor(+e.target.value || 0) })} />
                    <button type="button" className="link iconbtn" aria-label={'Remove ' + p.name} onClick={() => remove(p.id)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {row.mode === 'upload' && row.file && <span className="hint">{fileErr || 'We couldn’t read properties from that file. Enter the counts instead; we keep the file.'}</span>}
              {counts}
            </>
          )}
        </div>
      )}
      <div className="links">
        {row.mode !== 'list' && (
          <button type="button" className="link" onClick={() => onChange({ ...row, mode: 'list' })}>
            + Add properties one by one
          </button>
        )}
        {uploadLink}
        {row.mode !== 'count' && (
          <button type="button" className="link" onClick={() => onChange({ ...row, mode: 'count', file: '', blob: null, items: [], problems: [] })}>
            + Property and unit count
          </button>
        )}
      </div>
    </div>
  )
}
