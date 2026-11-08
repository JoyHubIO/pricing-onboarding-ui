import { useState } from 'react'
import type { ManagerInfo } from '../data'
import { lookup, personErr, suggest, type Person } from '../model'

type FieldProps = {
  label: string
  value: string
  onChange: (v: string) => void
  /** The validation message, empty when fine. Shown after Continue was tried, or after leaving a filled field. */
  err?: string
  show: boolean
  type?: string
  placeholder?: string
  span?: 2
  hint?: string
  autoFocus?: boolean
  small?: boolean
  min?: number
  max?: number
  onEnter?: () => void
}

export function Field({ label, value, onChange, err, show, type = 'text', placeholder, span, hint, autoFocus, small, min, max, onEnter }: FieldProps) {
  const [touched, setTouched] = useState(false)
  const bad = !!err && (show || (touched && !!value.trim()))
  return (
    <label className={'field' + (span === 2 ? ' span2' : '')}>
      <span className="lab">{label}</span>
      <input
        className={'inp' + (small ? ' sm' : '') + (bad ? ' bad' : '')}
        type={type}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        onKeyDown={e => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault()
            onEnter()
          }
        }}
        aria-invalid={bad}
      />
      {bad ? (
        <span role="alert" className="err">
          {err}
        </span>
      ) : hint ? (
        <span className="hint">{hint}</span>
      ) : null}
    </label>
  )
}

type PersonProps = {
  p: Person
  onChange: (p: Person) => void
  show: boolean
  /** Refuse personal email domains (the buyer's own address, map C3). */
  work?: boolean
  emailLabel?: string
  emailPlaceholder?: string
  onEnter?: () => void
}

/** Every person anywhere in the flow: first name, last name, email (map, C3). */
export function PersonFields({ p, onChange, show, work, emailLabel = 'Email', emailPlaceholder = 'name@company.com', onEnter }: PersonProps) {
  const e = personErr(p, work)
  return (
    <div className="fields">
      <Field label="First name" value={p.first} onChange={v => onChange({ ...p, first: v })} err={e.first} show={show} placeholder="First name" autoFocus onEnter={onEnter} />
      <Field label="Last name" value={p.last} onChange={v => onChange({ ...p, last: v })} err={e.last} show={show} placeholder="Last name" onEnter={onEnter} />
      <Field
        label={emailLabel}
        type="email"
        value={p.email}
        onChange={v => onChange({ ...p, email: v })}
        err={e.email}
        show={show}
        placeholder={emailPlaceholder}
        span={2}
        onEnter={onEnter}
      />
    </div>
  )
}

type CompanyProps = {
  managers: ManagerInfo[]
  name: string
  url: string
  onChange: (name: string, url: string) => void
  show: boolean
  label?: string
  onEnter?: () => void
}

const URL_RE = /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i

/** Company lookup (map, Rule 13): suggestions after 5 characters, a pick fills the website, the website can override. */
export function CompanyFields({ managers, name, url, onChange, show, label = 'Company', onEnter }: CompanyProps) {
  const sugg = suggest(managers, name).filter(m => m.name !== name)
  const hit = lookup(managers, name, url)
  const showUrl = name.trim().length >= 5 || !!url.trim()
  const urlErr = url.trim() && !URL_RE.test(url.trim()) ? 'Enter a website like company.com' : ''
  return (
    <>
      <div className="fields">
        <Field
          label={label}
          value={name}
          onChange={v => onChange(v, url)}
          err={name.trim() ? '' : 'Required'}
          show={show}
          placeholder="Start typing"
          span={2}
          autoFocus
          onEnter={onEnter}
        />
        {showUrl && (
          <Field
            label="Company website"
            value={url}
            onChange={v => onChange(name, v)}
            err={urlErr}
            show={show}
            placeholder="company.com"
            span={2}
            hint={hit ? 'Matched ' + hit.name + '. Not right? Enter the company’s website.' : 'Optional. Add the company’s website for a more precise match.'}
            onEnter={onEnter}
          />
        )}
      </div>
      {sugg.length > 0 && (
        <div className="chips">
          {sugg.map(m => (
            <button type="button" key={m.name} className="btn2" onClick={() => onChange(m.name, m.website || url)}>
              {m.name}
              {m.website ? ' · ' + m.website : ''}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
