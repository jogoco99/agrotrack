import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { toast, Spinner } from '../components/UI'

const DEFAULTS = { intervalo_critico: 16, intervalo_alerta: 10 }

export default function Configuracion() {
  const [config,   setConfig]  = useState(DEFAULTS)
  const [loading,  setLoading] = useState(true)
  const [saving,   setSaving]  = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data } = await sb.from('configuracion').select('*').limit(1).maybeSingle()
    if (data) setConfig({ ...DEFAULTS, ...data })
    setLoading(false)
  }
  function set(k, v) { setConfig(c => ({ ...c, [k]: v })) }

  async function save() {
    setSaving(true)
    const { data: existing } = await sb.from('configuracion').select('id').limit(1).maybeSingle()
    const payload = {
      intervalo_critico: parseInt(config.intervalo_critico) || 16,
      intervalo_alerta:  parseInt(config.intervalo_alerta)  || 10,
    }
    const { error } = existing
      ? await sb.from('configuracion').update(payload).eq('id', existing.id)
      : await sb.from('configuracion').insert(payload)
    setSaving(false)
    if (error) { toast('Error: ' + error.message, false); return }
    toast('Configuración guardada')
    load()
  }

  if (loading) return <Spinner />

  return (
    <>
      <div className="card">
        <div className="ct"><i className="ti ti-droplet"></i>Intervalos de riego</div>
        <p style={{ fontSize: 13, color:'var(--cs)', marginBottom: 14 }}>
          Define cuántos días sin riego se considera alerta o crítico. Se aplica en el Dashboard y en la tabla de Riegos.
        </p>
        <div className="fr c2">
          <div className="fg">
            <label>Días para alerta (amarillo)</label>
            <input type="number" value={config.intervalo_alerta} onChange={e => set('intervalo_alerta', e.target.value)} min="1" max="30" />
            <span style={{ fontSize: 11, color:'var(--ct)', marginTop: 3 }}>Actualmente: {config.intervalo_alerta} días</span>
          </div>
          <div className="fg">
            <label>Días para crítico (rojo)</label>
            <input type="number" value={config.intervalo_critico} onChange={e => set('intervalo_critico', e.target.value)} min="1" max="60" />
            <span style={{ fontSize: 11, color:'var(--ct)', marginTop: 3 }}>Actualmente: {config.intervalo_critico} días</span>
          </div>
        </div>

        {/* Preview */}
        <div style={{ display:'flex', gap: 10, marginTop: 12, flexWrap:'wrap' }}>
          <span className="iv-g">0 – {config.intervalo_alerta - 1} días ✓ Al corriente</span>
          <span className="iv-y">{config.intervalo_alerta} – {config.intervalo_critico} días ⚠ Atención</span>
          <span className="iv-r">&gt;{config.intervalo_critico} días ✗ Crítico</span>
        </div>

        <div className="br-row" style={{ marginTop: 16 }}>
          <button className="btn pr" onClick={save} disabled={saving}>
            {saving ? <><i className="ti ti-loader"></i> Guardando…</> : <><i className="ti ti-device-floppy"></i> Guardar configuración</>}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="ct"><i className="ti ti-info-circle"></i>Información del sistema</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
          {[
            ['Versión', 'AgroTrack v4'],
            ['Base de datos', 'Supabase PostgreSQL'],
            ['Frontend', 'React 18 + Vite'],
          ].map(([l, v]) => (
            <div key={l} style={{ background:'var(--cc)', borderRadius:'var(--r)', padding:'10px 12px' }}>
              <div style={{ fontSize: 10, color:'var(--cs)', textTransform:'uppercase', marginBottom: 3 }}>{l}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
