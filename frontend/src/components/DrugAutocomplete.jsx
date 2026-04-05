import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

const API = '/api'

export default function DrugAutocomplete({ value, onChange, placeholder = 'e.g. Bevacizumab' }) {
  const [drugs, setDrugs]       = useState([])
  const [query, setQuery]       = useState(value || '')
  const [open, setOpen]         = useState(false)
  const [highlighted, setHigh]  = useState(-1)
  const containerRef            = useRef(null)

  // Fetch drug list once
  useEffect(() => {
    axios.get(`${API}/drugs`).then((r) => setDrugs(r.data)).catch(() => {})
  }, [])

  // Keep query in sync if parent resets value to ''
  useEffect(() => {
    if (value === '') setQuery('')
  }, [value])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.trim()
    ? drugs.filter((d) => d.toLowerCase().includes(query.toLowerCase()))
    : drugs

  const handleInput = (e) => {
    const v = e.target.value
    setQuery(v)
    onChange(v)
    setOpen(true)
    setHigh(-1)
  }

  const select = (drug) => {
    setQuery(drug)
    onChange(drug)
    setOpen(false)
    setHigh(-1)
  }

  const handleKeyDown = (e) => {
    if (!open) { if (e.key === 'ArrowDown') setOpen(true); return }
    if (e.key === 'ArrowDown')  { e.preventDefault(); setHigh((h) => Math.min(h + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setHigh((h) => Math.max(h - 1, 0)) }
    if (e.key === 'Enter' && highlighted >= 0) { e.preventDefault(); select(filtered[highlighted]) }
    if (e.key === 'Escape')     { setOpen(false) }
  }

  const clear = (e) => {
    e.stopPropagation()
    setQuery('')
    onChange('')
    setOpen(false)
  }

  return (
    <div className="drug-ac" ref={containerRef}>
      <div className="drug-ac-input-wrap">
        <input
          className="drug-ac-input"
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
        />
        {query && (
          <button type="button" className="drug-ac-clear" onClick={clear} tabIndex={-1}>✕</button>
        )}
        <button
          type="button"
          className="drug-ac-chevron"
          onClick={() => setOpen((o) => !o)}
          tabIndex={-1}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {open && filtered.length > 0 && (
        <ul className="drug-ac-dropdown">
          {filtered.map((drug, i) => (
            <li
              key={drug}
              className={`drug-ac-item ${i === highlighted ? 'drug-ac-item-active' : ''}`}
              onMouseDown={() => select(drug)}
              onMouseEnter={() => setHigh(i)}
            >
              {drug}
            </li>
          ))}
        </ul>
      )}

      {open && filtered.length === 0 && query && (
        <div className="drug-ac-empty">No drugs found — you can still type a custom name</div>
      )}
    </div>
  )
}
