import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useGoogleLogin } from '@react-oauth/google'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import DrugAutocomplete from './components/DrugAutocomplete'
import PayerAutocomplete from './components/PayerAutocomplete'
import { TextScramble } from './components/TextScramble'

import './App.css'

const API = '/api'

// ── helpers ────────────────────────────────────────────────────────────────
const bool = (v) => {
  if (v === true)  return <span className="badge badge-yes"><span className="badge-dot"/>Yes</span>
  if (v === false) return <span className="badge badge-no"><span className="badge-dot"/>No</span>
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
  const showDot = cls !== 'badge-na'
  return <span className={`badge ${cls}`}>{showDot && <span className="badge-dot"/>}{v}</span>
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
    { label: 'Quantity Limits',    key: 'quantity_limits',      render: (v) => v ? <span style={{whiteSpace:'pre-wrap'}}>{v}</span> : <span className="muted">—</span> },
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
        <div className="ac-wrapper">
          <DrugAutocomplete value={input} onChange={setInput} placeholder="Drug name (e.g. Bevacizumab)" />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? <TextScramble duration={1.5} speed={0.05}>Analyzing...</TextScramble> : 'Compare'}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {payers && (
        <>
          <div className="result-meta">
            <span className="drug-badge">{drug}</span>
            <span className="muted">{payers.length} payer{payers.length !== 1 ? 's' : ''} loaded</span>
          </div>

          {payers.length > 0 && (() => {
            const priorAuth   = payers.filter((p) => p.prior_auth_required === true).length
            const stepTherapy = payers.filter((p) => p.step_therapy_required === true).length
            return (
              <div className="stat-cards">
                <div className="stat-card">
                  <div className="stat-value">{payers.length}</div>
                  <div className="stat-label">Payers Analyzed</div>
                </div>
                <div className="stat-card stat-card-warn">
                  <div className="stat-value">{priorAuth}<span className="stat-denom">/{payers.length}</span></div>
                  <div className="stat-label">Require Prior Auth</div>
                </div>
                <div className="stat-card stat-card-alert">
                  <div className="stat-value">{stepTherapy}<span className="stat-denom">/{payers.length}</span></div>
                  <div className="stat-label">Require Step Therapy</div>
                </div>
              </div>
            )
          })()}

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
        <p className="subtitle">Get plain-language answers from policy data using AI</p>
      </div>

      <form className="ask-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="form-label">Drug Name</label>
          <DrugAutocomplete value={drug} onChange={setDrug} />
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
          {loading ? <TextScramble duration={2} speed={0.04}>Processing query...</TextScramble> : 'Ask'}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className="answer-card">
          <div className="answer-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div className="answer-body">
            <div className="answer-text">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.answer}</ReactMarkdown>
            </div>
            {result.sources?.length > 0 && (
              <div className="sources">
                <span className="sources-label">Sources:</span>
                {result.sources.map((s, i) => (
                  <span key={i} className="source-chip">
                    {s.payer}{s.policy_date ? ` · ${s.policy_date}` : ''}
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
        <p className="subtitle">Extract structured coverage data from a health plan document using AI</p>
      </div>

      <form className="upload-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="form-label">Drug Name (optional hint)</label>
          <DrugAutocomplete value={drugHint} onChange={setDrugHint} placeholder="e.g. Bevacizumab — helps Claude focus" />
        </div>
        <div className="form-row">
          <label className="form-label">Policy PDF</label>
          <div
            className={`file-drop ${file ? 'file-drop-active' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setFile(e.dataTransfer.files[0]) }}
          >
            {file
              ? <span className="file-name">{file.name}</span>
              : <span className="muted">Drag & drop a PDF here, or</span>
            }
            <label className="btn btn-outline file-btn">
              Browse
              <input type="file" accept=".pdf" hidden onChange={(e) => setFile(e.target.files[0])} />
            </label>
          </div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={loading || !file}>
          {loading ? <TextScramble duration={1.5} speed={0.05}>Extracting data...</TextScramble> : 'Extract Policy'}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {loading && (
        <div className="loading-card">
          <div className="spinner" />
          <p>Reading the policy document — this may take a minute for large PDFs…</p>
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
                  <span className="policy-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
                  </span>
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

// ── CHANGES TAB ──────────────────────────────────────────────────────────────
function ChangesTab() {
  const [drug, setDrug]   = useState('')
  const [payer, setPayer] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoad]  = useState(false)
  const [error, setError]   = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!drug || !payer) return
    setLoad(true); setError(null); setResult(null)
    try {
      const res = await axios.get(`${API}/changes`, { params: { drug, payer } })
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoad(false)
    }
  }

  const significant = result?.changes?.filter((c) => c.type === 'significant') || []
  const cosmetic     = result?.changes?.filter((c) => c.type === 'cosmetic')     || []

  return (
    <div className="tab-panel">
      <div className="panel-header">
        <h2>Policy Changes</h2>
        <p className="subtitle">Diff two policy snapshots and see what changed between versions</p>
      </div>

      <form className="search-bar" onSubmit={handleSubmit}>
        <div className="drug-ac" style={{flex: 1}}>
          <DrugAutocomplete value={drug} onChange={setDrug} placeholder="Drug (e.g. Bevacizumab)" />
        </div>
        <div className="drug-ac" style={{flex: 1}}>
          <PayerAutocomplete value={payer} onChange={setPayer} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading || !drug || !payer}>
          {loading ? <TextScramble duration={1.5} speed={0.05}>Comparing...</TextScramble> : 'Check Changes'}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {loading && (
        <div className="loading-card">
          <div className="spinner" />
          <p>Analyzing policy differences…</p>
        </div>
      )}

      {result && (
        <div className="changes-wrap">
          <div className="changes-meta">
            <div className="changes-snapshot">
              <span className="changes-label">Old</span>
              <span className="changes-file">{result.old_snapshot}</span>
            </div>
            <div className="changes-arrow">→</div>
            <div className="changes-snapshot">
              <span className="changes-label">New</span>
              <span className="changes-file">{result.new_snapshot}</span>
            </div>
          </div>

          {result.changes.length === 0 && (
            <div className="empty-state"><p>No differences found between the two snapshots.</p></div>
          )}

          {significant.length > 0 && (
            <div className="changes-section">
              <div className="changes-section-header changes-significant-header">
                ⚠️ Significant Changes <span className="changes-count">{significant.length}</span>
              </div>
              {significant.map((c, i) => (
                <div key={i} className="change-card change-significant">
                  <div className="change-field">{c.field}</div>
                  <div className="change-reason">{c.reason}</div>
                  <div className="change-values">
                    <div className="change-old">
                      <span className="change-val-label">Before</span>
                      <span className="change-val">{JSON.stringify(c.old_value)}</span>
                    </div>
                    <div className="change-arrow-inline">→</div>
                    <div className="change-new">
                      <span className="change-val-label">After</span>
                      <span className="change-val">{JSON.stringify(c.new_value)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cosmetic.length > 0 && (
            <div className="changes-section">
              <div className="changes-section-header changes-cosmetic-header">
                ℹ️ Cosmetic Changes <span className="changes-count">{cosmetic.length}</span>
              </div>
              {cosmetic.map((c, i) => (
                <div key={i} className="change-card change-cosmetic">
                  <div className="change-field">{c.field}</div>
                  <div className="change-reason">{c.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── SCROLL HOOK ───────────────────────────────────────────────────────────────
function useScrolled(threshold = 10) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])
  return scrolled
}

// ── SVG ICONS ────────────────────────────────────────────────────────────────
const GoogleSVG = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
  </svg>
)
const GitHubSVG = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
  </svg>
)

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || ''

// Separate component so useGoogleLogin hook is only called inside GoogleOAuthProvider
function GoogleLoginButton({ onSuccess, onError, loading }) {
  const login = useGoogleLogin({ onSuccess, onError })
  return (
    <button className="auth-btn auth-btn-google" onClick={() => login()} disabled={!!loading}>
      {loading === 'Google' ? <span className="auth-spinner"/> : <GoogleSVG/>}
      Continue with Google
    </button>
  )
}

// ── LANDING PAGE ─────────────────────────────────────────────────────────────
function LandingPage({ onLogin }) {
  const [loading, setLoading]   = useState(null)
  const [authError, setAuthError] = useState('')
  const [mobileOpen, setMobile] = useState(false)
  const scrolled = useScrolled(20)

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const handleGoogleSuccess = async (tokenResponse) => {
    setLoading('Google')
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      })
      const profile = await res.json()
      onLogin({ name: profile.name, email: profile.email, avatar: profile.picture, provider: 'Google' })
    } catch {
      setAuthError('Failed to fetch Google profile.')
      setLoading(null)
    }
  }
  const handleGoogleError = () => { setAuthError('Google sign-in was cancelled or failed.'); setLoading(null) }

  // ── Real GitHub OAuth ──
  const githubLogin = () => {
    if (!GITHUB_CLIENT_ID) {
      setAuthError('GitHub OAuth not configured. Add VITE_GITHUB_CLIENT_ID to frontend/.env')
      return
    }
    setLoading('GitHub')
    window.location.href = 'http://localhost:8000/auth/github'
  }

  const stagger = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
  }
  const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  }

  const FEATURES = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.39 0 4.56.93 6.16 2.44"/><path d="M21 3v4h-4"/></svg>
      ),
      title: 'Instant Comparison',
      desc: 'Compare drug coverage across every payer side-by-side. Prior auth, step therapy, preferred status — all in one view.',
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
      ),
      title: 'AI-Powered Answers',
      desc: 'Ask plain-English questions about any policy. Claude reads the source documents and cites exactly where the answer comes from.',
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
      ),
      title: 'PDF Extraction',
      desc: 'Upload any payer policy PDF. Claude extracts every structured field automatically — no manual data entry required.',
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>
      ),
      title: 'Change Tracking',
      desc: 'Detect when policies change between versions. Every update classified as significant or cosmetic — never miss a formulary shift.',
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      ),
      title: 'Multi-Payer',
      desc: 'BCBS, Cigna, UHC, Florida Blue and more — all in one platform. Add new payers by uploading their PDF in seconds.',
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      ),
      title: 'Structured Data',
      desc: 'Every policy stored as clean JSON — prior auth criteria, quantity limits, covered indications, site of care, and more.',
    },
  ]

  return (
    <div className="landing">

      {/* ── NAV ── */}
      <header className={`lnav ${scrolled && !mobileOpen ? 'lnav-scrolled' : ''}`}>
        <div className="lnav-inner">
          <img src="/logo.png" alt="AntonRx" className="lnav-logo" />
          <nav className="lnav-links">
            {['About','Features','Services'].map((l) => (
              <a key={l} className="lnav-link" href={`#${l.toLowerCase()}`}>{l}</a>
            ))}
          </nav>
          <div className="lnav-actions">
            <button className="lnav-btn lnav-btn-ghost" onClick={() => document.getElementById('hero-auth')?.scrollIntoView({behavior:'smooth'})} disabled={!!loading}>
              Sign In
            </button>
            <button className="lnav-btn lnav-btn-cta" onClick={() => document.getElementById('hero-auth')?.scrollIntoView({ behavior:'smooth' })}>
              Get Started →
            </button>
          </div>
          <button className="lnav-hamburger" onClick={() => setMobile(o => !o)} aria-label="Menu">
            <span className={`hb-line ${mobileOpen ? 'hb-open-1' : ''}`}/>
            <span className={`hb-line ${mobileOpen ? 'hb-open-2' : ''}`}/>
            <span className={`hb-line ${mobileOpen ? 'hb-open-3' : ''}`}/>
          </button>
        </div>
        {mobileOpen && (
          <div className="lnav-mobile">
            {['About','Features','Services'].map((l) => (
              <a key={l} className="lnav-mobile-link" href={`#${l.toLowerCase()}`} onClick={() => setMobile(false)}>{l}</a>
            ))}
            <div className="lnav-mobile-divider"/>
            <button className="auth-btn auth-btn-google w-full" onClick={() => { setMobile(false); document.getElementById('hero-auth')?.scrollIntoView({behavior:'smooth'}) }}>
              <GoogleSVG/> Sign in with Google
            </button>
            <button className="auth-btn auth-btn-github w-full" onClick={() => { setMobile(false); githubLogin() }}>
              <GitHubSVG/> Sign in with GitHub
            </button>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section className="l-hero">
        {/* background blobs */}
        <div className="l-hero-blob l-hero-blob-1"/>
        <div className="l-hero-blob l-hero-blob-2"/>
        <div className="l-hero-blob l-hero-blob-3"/>
        {/* noise overlay */}
        <div className="l-hero-noise"/>

        <motion.div className="l-hero-body" variants={stagger} initial="hidden" animate="visible">
          <motion.div variants={fadeUp}>
            <span className="l-pill">
              <span className="l-pill-dot"/>
              Built at ASU Innovation Hacks 2026
            </span>
          </motion.div>

          <motion.h1 className="l-hero-h1" variants={fadeUp}>
            Lowest Net Cost<br/>
            <span className="l-hero-shine">on Drug Spend.</span>
          </motion.h1>

          <motion.p className="l-hero-sub" variants={fadeUp}>
            Partnering with key pharmacy stakeholders to analyze, compare,<br className="l-br"/>
            and track payer policies — in seconds.
          </motion.p>

          <motion.div className="l-auth-card" id="hero-auth" variants={fadeUp}>
            <p className="l-auth-label">Sign in to continue</p>
            <div className="l-auth-btns">
              {import.meta.env.VITE_GOOGLE_CLIENT_ID
                ? <GoogleLoginButton onSuccess={handleGoogleSuccess} onError={handleGoogleError} loading={loading} />
                : <button className="auth-btn auth-btn-google" onClick={() => setAuthError('Add VITE_GOOGLE_CLIENT_ID to frontend/.env to enable Google login')} disabled={!!loading}>
                    <GoogleSVG/> Continue with Google
                  </button>
              }
              <button className="auth-btn auth-btn-github" onClick={() => githubLogin()} disabled={!!loading}>
                {loading === 'GitHub' ? <span className="auth-spinner auth-spinner-white"/> : <GitHubSVG/>}
                Continue with GitHub
              </button>
              <div className="l-auth-divider"><span>or</span></div>
              <button
                className="auth-btn auth-btn-demo"
                onClick={() => onLogin({ name: 'Demo User', email: 'demo@antonrx.com', avatar: '', provider: 'Demo' })}
                disabled={!!loading}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Continue as Demo
              </button>
            </div>
            {authError && (
              <p style={{fontSize:'12px',color:'#f87171',margin:0,textAlign:'center'}}>{authError}</p>
            )}
            <p className="l-auth-note">No credit card required · Free for Innovation Hacks</p>
          </motion.div>

          <motion.div className="l-stats" variants={fadeUp}>
            {[['680+','Pharmacy contracts'],['95+','Medical contracts'],['100%','Value to clients']].map(([n,l],i,a) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:0}}>
                <div className="l-stat">
                  <span className="l-stat-n">{n}</span>
                  <span className="l-stat-l">{l}</span>
                </div>
                {i < a.length-1 && <div className="l-stat-sep"/>}
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── FEATURES ── */}
      <section className="l-features" id="features">
        <div className="l-section-inner">
          <div className="l-section-label">Features</div>
          <h2 className="l-section-h2">Everything you need to<br/>master drug policy</h2>
          <p className="l-section-sub">From PDF upload to AI-powered comparison — the full workflow in one platform.</p>
          <div className="l-feat-grid">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                className="l-feat-card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: (i % 3) * 0.08, ease: [0.22,1,0.36,1] }}
              >
                <div className="l-feat-icon">{f.icon}</div>
                <h3 className="l-feat-title">{f.title}</h3>
                <p className="l-feat-desc">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section className="l-about" id="about">
        <div className="l-section-inner l-about-inner">
          <motion.div
            className="l-about-text"
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22,1,0.36,1] }}
          >
            <div className="l-section-label">About</div>
            <h2 className="l-section-h2" style={{textAlign:'left'}}>Welcome to<br/>Anton Rx</h2>
            <p className="l-about-p">Seasoned pharmacy innovators with unparalleled rebate management experience. Anton Rx excels at lowering the costs of both pharmacy and medical benefit drugs via a proprietary matrix of formulary designs and custom contracts.</p>
            <p className="l-about-p">Because Anton Rx is truly independent, we are not beholden to any PBMs, GPO's, health plans, or private investors. Our independence means we never <em>compete</em> against our clients.</p>
          </motion.div>
          <motion.div
            className="l-about-cards"
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22,1,0.36,1] }}
          >
            {[
              { n: '680+', l: 'Pharmacy rebate contracts' },
              { n: '95+',  l: 'Medical rebate contracts'  },
              { n: '100%', l: 'Value to clients'           },
              { n: '15+',  l: 'Years of experience'        },
            ].map((s) => (
              <div key={s.l} className="l-about-stat">
                <span className="l-about-stat-n">{s.n}</span>
                <span className="l-about-stat-l">{s.l}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section className="l-services" id="services">
        <div className="l-section-inner">
          <div className="l-section-label l-section-label-white">Services</div>
          <h2 className="l-section-h2" style={{color:'#fff'}}>Core service offerings</h2>
          <div className="l-svc-grid">
            {[
              { icon:'📋', title:'Clinical Policies',        desc:'Comprehensive analysis and management of medical benefit drug policies.' },
              { icon:'💰', title:'Rebating Processing',       desc:'Flawless rebate administration and contract negotiation across all payers.' },
              { icon:'💊', title:'Formulary Optimization',   desc:'Medical and specialty pharmacy formulary design and management.' },
              { icon:'📊', title:'Strategic Analytics',       desc:'Data-driven insights to maximize preferred product market shares.' },
              { icon:'👩‍⚕️', title:'Expert Clinical Support', desc:'Seasoned clinical experts supporting every formulary decision.' },
            ].map((s,i) => (
              <motion.div
                key={i}
                className="l-svc-card"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
              >
                <span className="l-svc-icon">{s.icon}</span>
                <h3 className="l-svc-title">{s.title}</h3>
                <p className="l-svc-desc">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="l-footer">
        <div className="l-footer-inner">
          <div className="l-footer-brand">
            <img src="/logo.png" alt="AntonRx" className="l-footer-logo"/>
            <p className="l-footer-tagline">Partnering with key pharmacy stakeholders to deliver the lowest net cost on drug spend.</p>
          </div>
          <div className="l-footer-contact">
            <span>📞 (407) 554-1556</span>
            <span>✉️ service@antonrx.com</span>
            <span>📍 113 S Boyd Street, Winter Garden, FL 34787</span>
            <span>📍 301 Church St, Nashville, TN 37201</span>
          </div>
        </div>
        <div className="l-footer-bottom">
          <span>© 2026 Anton Rx. Built at ASU Innovation Hacks 2.0.</span>
          <span style={{color:'rgba(255,255,255,0.3)'}}>© Anton Rx 2026</span>
        </div>
      </footer>
    </div>
  )
}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
const IconCompare = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
)
const IconAsk = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)
const IconChanges = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
  </svg>
)
const IconUpload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
)

const PAGES = [
  { id: 'compare',  icon: <IconCompare />, label: 'Compare'          },
  { id: 'ask',      icon: <IconAsk />,     label: 'Ask'               },
  { id: 'changes',  icon: <IconChanges />, label: 'Changes'           },
  { id: 'manage',   icon: <IconUpload />,  label: 'Upload & Policies' },
]

export default function App() {
  const [page, setPage] = useState('compare')
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('antonrx_user')) } catch { return null }
  })

  // Handle GitHub OAuth callback: ?auth=<base64 user JSON>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authParam = params.get('auth')
    if (authParam) {
      try {
        const userData = JSON.parse(atob(authParam))
        localStorage.setItem('antonrx_user', JSON.stringify(userData))
        setUser(userData)
        // Clean the URL
        window.history.replaceState({}, '', window.location.pathname)
      } catch { /* ignore malformed param */ }
    }
  }, [])

  const login = (userData) => {
    localStorage.setItem('antonrx_user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('antonrx_user')
    setUser(null)
  }

  if (!user) return <LandingPage onLogin={login} />

  const currentPage = PAGES.find((p) => p.id === page)

  return (
    <div className="app-shell">

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/logo.png" alt="AntonRx" className="sidebar-logo-img" />
          <span className="sidebar-tagline">Policy Intelligence</span>
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-section-label">Analytics</span>
          {PAGES.filter(p => ['compare','ask','changes'].includes(p.id)).map((p) => (
            <button
              key={p.id}
              className={`sidebar-btn ${page === p.id ? 'sidebar-active' : ''}`}
              onClick={() => setPage(p.id)}
            >
              <span className="sidebar-icon">{p.icon}</span>
              {p.label}
            </button>
          ))}
          <span className="sidebar-section-label" style={{marginTop:8}}>Data</span>
          {PAGES.filter(p => p.id === 'manage').map((p) => (
            <button
              key={p.id}
              className={`sidebar-btn ${page === p.id ? 'sidebar-active' : ''}`}
              onClick={() => setPage(p.id)}
            >
              <span className="sidebar-icon">{p.icon}</span>
              {p.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            {user.avatar
              ? <img src={user.avatar} alt="" className="sidebar-user-avatar sidebar-user-avatar-img" />
              : <div className="sidebar-user-avatar">{(user.name || 'U').charAt(0).toUpperCase()}</div>
            }
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.name}</span>
              <span className="sidebar-user-provider">via {user.provider}</span>
            </div>
          </div>
          <button className="sidebar-logout" onClick={logout}>Sign out</button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="app-body">

        {/* Top bar */}
        <div className="app-topbar">
          <span className="app-topbar-title">
            {currentPage?.icon} {currentPage?.label}
          </span>
          <div className="app-topbar-right">
            <span className="app-topbar-badge">
              <span className="app-topbar-dot"/>
              Anton Rx
            </span>
            <span className="app-topbar-badge">Innovation Hacks 2.0 · ASU</span>
          </div>
        </div>

        <main className="app-main">
          {page === 'compare' && <div className="centered-page"><CompareTab /></div>}
          {page === 'ask'     && <div className="centered-page"><AskTab /></div>}
          {page === 'changes' && <div className="centered-page"><ChangesTab /></div>}
          {page === 'manage'  && (
            <div className="split-page">
              <div className="split-primary"><UploadTab /></div>
              <div className="split-secondary"><PoliciesTab /></div>
            </div>
          )}
        </main>

      </div>

    </div>
  )
}
