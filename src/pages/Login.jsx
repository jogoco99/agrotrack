import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { signIn } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try { await signIn(email, password) }
    catch (err) { setError('Email o contraseña incorrectos') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--ce)' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '36px 32px', width: 360, boxShadow: '0 8px 32px rgba(0,0,0,.3)' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--ce)', marginBottom: 4 }}>AgroTrack</h1>
          <p style={{ fontSize: 11, color: 'var(--ct)', letterSpacing: '1px', textTransform: 'uppercase' }}>Gestión de Cultivos — v4</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="fg" style={{ marginBottom: 12 }}>
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@ejemplo.com" required autoFocus />
          </div>
          <div className="fg" style={{ marginBottom: 16 }}>
            <label>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <div className="al red" style={{ marginBottom: 12 }}><i className="ti ti-alert-triangle"></i>{error}</div>}
          <button className="btn pr full" type="submit" disabled={loading}>
            {loading ? <><i className="ti ti-loader"></i> Entrando…</> : <><i className="ti ti-login"></i> Entrar</>}
          </button>
        </form>
        <p style={{ marginTop: 20, fontSize: 11, color: 'var(--ct)', textAlign: 'center' }}>
          Solicita tu acceso al administrador del sistema
        </p>
      </div>
    </div>
  )
}
