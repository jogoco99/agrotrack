import { useState, useEffect } from 'react'
import { RANCHOS, TIPOS_ACT } from '../lib/constants'

/* ── Toast ── */
let _setToast = null
export function Toast() {
  const [msg, setMsg] = useState(null)
  _setToast = setMsg
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 2800); return () => clearTimeout(t) } }, [msg])
  if (!msg) return null
  return (
    <div className="toast" style={{ background: msg.ok === false ? '#922B21' : undefined }}>
      <i className={`ti ${msg.ok === false ? 'ti-x' : 'ti-check'}`}></i> {msg.text}
    </div>
  )
}
export function toast(text, ok = true) { _setToast?.({ text, ok }) }

/* ── Modal ── */
export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={wide ? { maxWidth: 900 } : {}}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn sm" onClick={onClose}><i className="ti ti-x"></i></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

/* ── Rancho / Tipo chips ── */
export function RanchoChip({ r }) {
  const rc = RANCHOS[r]
  return <span className={`rc ${rc?.cls || ''}`}>{rc?.nombre || r}</span>
}
export function TipoChip({ t }) {
  return <span className="tc">{t}</span>
}

/* ── Interval badge ── */
export function IvBadge({ n, critico = 16, alerta = 10 }) {
  if (n == null) return <span className="badge" style={{ background: '#eee', color: '#888' }}>—</span>
  if (n < alerta)   return <span className="iv-g">{n} días</span>
  if (n <= critico) return <span className="iv-y">{n} días</span>
  return <span className="iv-r">{n} días</span>
}

/* ── Act badge ── */
export function ActBadge({ tipo }) {
  const t = TIPOS_ACT[tipo]
  return <span className={`badge ${t?.badge || 'badge-info'}`}>{t?.label || tipo}</span>
}

/* ── Spinner ── */
export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
      <i className="ti ti-loader" style={{ fontSize: 28, color: 'var(--ct)', animation: 'spin 1s linear infinite' }}></i>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

/* ── Tabs ── */
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button key={t.id} className={`tabb ${active === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

/* ── fmx number formatter ── */
export function fmx(n, d = 0) {
  return (parseFloat(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: d, minimumFractionDigits: d })
}

/* ── today string yyyy-mm-dd ── */
export function today() { return new Date().toISOString().split('T')[0] }

/* ── Format date to dd-mm-yyyy for display ── */
export function fmtFecha(d) {
  if (!d) return '—'
  const parts = String(d).split('T')[0].split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}-${parts[1]}-${parts[0]}`
}

/* ── days from today ── */
export function daysFrom(d) {
  return Math.round((new Date(d + ' 12:00') - new Date(today() + ' 12:00')) / 864e5)
}

/* ── Metric big card ── */
export function MetBig({ label, value, sub, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--cn)', borderRadius: 'var(--rl)', padding: '18px 20px', borderLeft: `4px solid ${color || 'var(--cgm)'}` }}>
      <div style={{ fontSize: 11, color: 'var(--cs)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, fontFamily: 'IBM Plex Mono', color: color || 'var(--ce)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ct)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}
