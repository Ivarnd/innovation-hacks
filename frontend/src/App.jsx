import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import './App.css'

const API = '/api'

// ── helpers ────────────────────────────────────────────────────────────────
const bool = (v) => {
  if (v === true)  return <span className="badge badge-yes">Yes</span>
  if (v === false) return <span className="badge badge-no">No</span>
  return <span className="badge badge-na">—</span>
}

// Renders either a string or an array of strings
const listOrString = (v) => {
  if (!v) return <span className="muted">—</span>
  if (Array.isArray(v)) {
    return v.length
      ? <ul className="cell-list">{v.map((s, i) => <li key={i}>{s}</li>)}</ul>
      : <span className="muted">—</span>
  }
  // Long strings get truncated with a title tooltip
  return <span title={v}>{v.length > 120 ? v.slice(0, 120) + '…' : v}</span>
}

const preferredBadge = (v) => {
  if (!v) return <span className="muted">—</span>
  const cls = v === 'preferred' ? 'badge-preferred'
            : v === 'non-preferred' ? 'badge-nonpreferred'
            : v === 'not covered' ? 'badge-notcovered'
            : 'badge-na'
  return <span className={`badge ${cls}`}>{v}</span>
}

// ── COMPARE TAB ─────────────────────────────────────────────────────────────
function CompareTab() {
  const [input, setInput]  = useState('')
  const [drug, setDrug]    = useState('')
  const [payers, setPayers] = useState(null)
  const [loading, setLoad] = useState(false)
  const [error, setError]  = useState(null)

  const fetchCompare = useCallback(async (drugName) => {
    setLoad(true); setError(null)
    try {
      // Backend returns a plain array
      const res = await axios.get(`${API}/compare`, { params: { drug: drugName } })
      setPayers(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoad(false)
    }
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    setDrug(input)
    fetchCompare(input)
  }

  const ROWS = [
    { label: 'Drug (Generic)',     key: 'drug_name',            render: (v) => v || <span className="muted">—</span> },
    { label: 'Brand Name',         key: 'brand_name',           render: (v) => v || <span className="muted">—</span> },
    { label: 'Preferred Status',   key: 'preferred_status',     render: preferredBadge },
    { label: 'Access Status',      key: 'access_status',        render: listOrString },
    { label: 'Prior Auth',         key: 'prior_auth_required',  render: bool },
    { label: 'PA Criteria',        key: 'prior_auth_criteria',  render: listOrString },
    { label: 'Step Therapy',       key: 'step_therapy_required',render: bool },
    { label: 'Step Therapy Drugs', key: 'step_therapy_drugs',   render: listOrString },
    { label: 'Indications',        key: 'covered_indications',  render: listOrString },
    { label: 'Site of Care',       key: 'site_of_care',         render: listOrString },
    { label: 'Quantity Limits',    key: 'quantity_limits',      render: listOrString },
    { label: 'Notes',              key: 'notes',                render: listOrString },
    { label: 'Effective Date',     key: 'effective_date',       render: (v) => v || <span className="muted">—</span> },
  ]

  return (
    <div className="tab-panel">
      <div className="panel-header">
        <h2>Payer Comparison</h2>
        <p className="subtitle">Compare coverage policies across health plans for a specific drug</p>
      </div>

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          className="text-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Drug name (e.g. Bevacizumab)"
        />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'Compare'}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {payers && (
        <>
          <div className="result-meta">
            <span className="drug-badge">{drug}</span>
            <span className="muted">{payers.length} payer{payers.length !== 1 ? 's' : ''} loaded</span>
          </div>

          {payers.length === 0 ? (
            <div className="empty-state">
              <p>No policies found for <strong>{drug}</strong>.</p>
              <p className="muted">Upload a policy PDF in the Upload tab to get started.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th className="row-label-col">Field</th>
                    {payers.map((p, i) => (
                      <th key={i}>
                        <div className="payer-name">{p.payer}</div>
                        <div className="payer-category">{p._source_file}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.key}>
                      <td className="row-label">{row.label}</td>
                      {payers.map((p, i) => (
                        <td key={i}>{row.render(p[row.key])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── ASK TAB ──────────────────────────────────────────────────────────────────
const SAMPLE_QUESTIONS = [
  'Does Florida Blue require step therapy for Bevacizumab?',
  'Which payers require prior authorization?',
  'What indications are covered across all payers?',
  'Are there biosimilar restrictions in any policy?',
]

function AskTab() {
  const [drug, setDrug]         = useState('')
  const [question, setQuestion] = useState('')
  const [result, setResult]     = useState(null)
  const [loading, setLoad]      = useState(false)
  const [error, setError]       = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!question.trim()) return
    setLoad(true); setError(null); setResult(null)
    try {
      // Backend expects { question, drug }
      const res = await axios.post(`${API}/ask`, { question, drug })
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoad(false)
    }
  }

  return (
    <div className="tab-panel">
      <div className="panel-header">
        <h2>Ask a Question</h2>
        <p className="subtitle">Get plain-language answers from policy data, powered by Claude</p>
      </div>

      <form className="ask-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="form-label">Drug Name</label>
          <input
            className="text-input"
            value={drug}
            onChange={(e) => setDrug(e.target.value)}
            placeholder="e.g. Bevacizumab"
          />
        </div>
        <div className="form-row">
          <label className="form-label">Your Question</label>
          <textarea
            className="text-input textarea"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything about coverage, prior auth, step therapy…"
            rows={3}
          />
        </div>

        <div className="sample-questions">
          <span className="muted sample-label">Try:</span>
          {SAMPLE_QUESTIONS.map((q, i) => (
            <button key={i} type="button" className="chip" onClick={() => setQuestion(q)}>
              {q}
            </button>
          ))}
        </div>

        <button className="btn btn-primary" type="submit" disabled={loading || !question.trim()}>
          {loading ? 'Asking Claude…' : 'Ask'}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className="answer-card">
          <div className="answer-icon">💬</div>
          <div className="answer-body">
            <div className="answer-text">
              <ReactMarkdown>{result.answer}</ReactMarkdown>
            </div>
            {result.sources?.length > 0 && (
              <div className="sources">
                <span className="sources-label">Sources:</span>
                {result.sources.map((s, i) => (
                  <span key={i} className="source-chip">
                    📋 {s.payer}{s.policy_date ? ` · ${s.policy_date}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── UPLOAD TAB ───────────────────────────────────────────────────────────────
function UploadTab() {
  const [drugHint, setDrugHint] = useState('')
  const [file, setFile]         = useState(null)
  const [result, setResult]     = useState(null)
  const [loading, setLoad]      = useState(false)
  const [error, setError]       = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return
    setLoad(true); setError(null); setResult(null)
    const form = new FormData()
    form.append('file', file)
    try {
      // Backend: POST /extract?drug_hint=... — returns { filename, chunks_processed, policy }
      const params = drugHint ? `?drug_hint=${encodeURIComponent(drugHint)}` : ''
      const res = await axios.post(`${API}/extract${params}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoad(false)
    }
  }

  const FIELD_ORDER = [
    'drug_name', 'brand_name', 'payer', 'effective_date',
    'preferred_status', 'access_status',
    'prior_auth_required', 'prior_auth_criteria',
    'step_therapy_required', 'step_therapy_drugs',
    'covered_indications', 'site_of_care', 'quantity_limits', 'notes',
  ]

  const renderValue = (v) => {
    if (v === null || v === undefined) return <span className="muted">null</span>
    if (typeof v === 'boolean') return bool(v)
    if (Array.isArray(v)) return v.length ? listOrString(v) : <span className="muted">[]</span>
    const s = String(v)
    return <span title={s}>{s.length > 200 ? s.slice(0, 200) + '…' : s}</span>
  }

  const policy = result?.policy

  return (
    <div className="tab-panel">
      <div className="panel-header">
        <h2>Upload Policy PDF</h2>
        <p className="subtitle">Extract structured coverage data from a health plan document using Claude</p>
      </div>

      <form className="upload-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="form-label">Drug Name (optional hint)</label>
          <input
            className="text-input"
            value={drugHint}
            onChange={(e) => setDrugHint(e.target.value)}
            placeholder="e.g. Bevacizumab — helps Claude focus on the right drug"
          />
        </div>
        <div className="form-row">
          <label className="form-label">Policy PDF</label>
          <div
            className={`file-drop ${file ? 'file-drop-active' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setFile(e.dataTransfer.files[0]) }}
          >
            {file
              ? <span className="file-name">📄 {file.name}</span>
              : <span className="muted">Drag & drop a PDF here, or</span>
            }
            <label className="btn btn-outline file-btn">
              Browse
              <input type="file" accept=".pdf" hidden onChange={(e) => setFile(e.target.files[0])} />
            </label>
          </div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={loading || !file}>
          {loading ? 'Extracting…' : 'Extract with Claude'}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {loading && (
        <div className="loading-card">
          <div className="spinner" />
          <p>Claude is reading the policy document — this may take a minute for large PDFs…</p>
        </div>
      )}

      {result && policy && (
        <div className="result-card">
          <div className="result-card-header">
            <span className="badge badge-yes">Extracted</span>
            <span className="muted">{result.filename}</span>
            {result.chunks_processed > 1 && (
              <span className="muted">· {result.chunks_processed} chunks processed</span>
            )}
          </div>
          <table className="extract-table">
            <tbody>
              {FIELD_ORDER.map((key) => (
                <tr key={key}>
                  <td className="row-label">{key}</td>
                  <td>{renderValue(policy[key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── POLICIES TAB ─────────────────────────────────────────────────────────────
function PoliciesTab() {
  const [data, setData]     = useState(null)
  const [loading, setLoad]  = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    axios.get(`${API}/policies`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoad(false))
  }, [])

  return (
    <div className="tab-panel">
      <div className="panel-header">
        <h2>Loaded Policies</h2>
        <p className="subtitle">All extracted policy JSON files currently in the data store</p>
      </div>

      {loading && <div className="muted">Loading…</div>}
      {error   && <div className="alert alert-error">{error}</div>}

      {data && (
        data.count === 0 ? (
          <div className="empty-state">
            <p>No policies extracted yet.</p>
            <p className="muted">Upload a PDF in the Upload tab to get started.</p>
          </div>
        ) : (
          <>
            <div className="result-meta">
              <span className="drug-badge">{data.count} file{data.count !== 1 ? 's' : ''}</span>
            </div>
            <ul className="policy-list">
              {data.files.map((f, i) => (
                <li key={i} className="policy-item">
                  <span className="policy-icon">📋</span>
                  <span className="policy-name">{f}</span>
                </li>
              ))}
            </ul>
          </>
        )
      )}
    </div>
  )
}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'compare',  label: '⚖️ Compare' },
  { id: 'ask',      label: '💬 Ask' },
  { id: 'upload',   label: '📤 Upload' },
  { id: 'policies', label: '📋 Policies' },
]

export default function App() {
  const [tab, setTab] = useState('compare')

  return (
    <div className="app-shell">
      <header className="app-header">
        <img src="/logo.png" alt="AntonRx" className="header-logo-img" />
        <p className="header-tagline">Medical Benefit Drug Policy Tracker</p>
      </header>

      <nav className="tab-nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {tab === 'compare'  && <CompareTab />}
        {tab === 'ask'      && <AskTab />}
        {tab === 'upload'   && <UploadTab />}
        {tab === 'policies' && <PoliciesTab />}
      </main>

      <footer className="app-footer">
        <span>AntonRx · Innovation Hacks 2.0 · ASU 2026</span>
        <span className="muted">Powered by Claude</span>
      </footer>
    </div>
  )
}
