import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { Modal, RanchoChip, toast, Spinner, fmx, fmtFecha } from '../components/UI'
import { CULTIVOS, TEMPORADAS } from '../lib/constants'

const CONCEPTOS = [
  'nomina','luz','diesel','reparaciones',
  'flete','materiales_ensilada','maquinaria',
  'sirre','insumos_varios','depreciacion','merma','otro'
]

const empty = { tipo:'', desc:'', monto:'', fecha:'', temporada:'', anio: new Date().getFullYear(), cultivo:'' }

export default function CostosGenerales() {
  const [cg,      setCG]      = useState([])
  const [areas,   setAreas]   = useState([])
  const [loading, setLoading] = useState(true)
  const [form,    setForm]    = useState(empty)
  const [edit,    setEdit]    = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [prTemp,  setPrTemp]  = useState('')
  const [prAnio,  setPrAnio]  = useState(new Date().getFullYear())
  const [prCultivo, setPrCultivo] = useState('')

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [{ data: c }, { data: a }] = await Promise.all([
      sb.from('costos_generales').select('*').order('fecha', { ascending: false }),
      sb.from('areas').select('*').eq('activa', true),
    ])
    setCG(c || []); setAreas(a || [])
    setLoading(false)
  }

  function set(k, v)  { setForm(f => ({ ...f, [k]: v })) }
  function setE(k, v) { setEdit(e => ({ ...e, [k]: v })) }

  const today = new Date().toISOString().split('T')[0]

  async function save() {
    if (!form.tipo || !form.monto) { toast('Completa concepto y monto', false); return }
    setSaving(true)
    const { error } = await sb.from('costos_generales').insert({
      tipo: form.tipo, descripcion: form.desc || null, monto: parseFloat(form.monto),
      fecha: form.fecha || today, temporada: form.temporada || null,
      anio: +form.anio || null, cultivo: form.cultivo || null,
    })
    setSaving(false)
    if (error) { toast('Error', false); return }
    toast('Costo guardado'); setForm(f => ({ ...f, tipo:'', desc:'', monto:'', fecha:'' })); load()
  }

  async function update() {
    if (!edit) return; setSaving(true)
    await sb.from('costos_generales').update({
      tipo: edit.tipo, descripcion: edit.descripcion || null, monto: parseFloat(edit.monto),
      fecha: edit.fecha, temporada: edit.temporada || null, anio: +edit.anio || null, cultivo: edit.cultivo || null,
    }).eq('id', edit.id)
    setSaving(false); setEdit(null); toast('Actualizado'); load()
  }

  async function del(id) { await sb.from('costos_generales').delete().eq('id', id); toast('Eliminado'); load() }

  // Prorrateo
  const cgFil    = cg.filter(c => (!prTemp || c.temporada === prTemp) && (!prAnio || +c.anio === +prAnio) && (!prCultivo || c.cultivo === prCultivo))
  const totalCG  = cgFil.reduce((s, c) => s + (+c.monto || 0), 0)
  const areasM   = areas.filter(a => (!prTemp || a.temporada === prTemp) && (!prCultivo || a.cultivo === prCultivo))
  const totalHa  = areasM.reduce((s, a) => s + (+a.sup || 0), 0)
  const cgPorHa  = totalHa > 0 ? totalCG / totalHa : 0

  // Totales por concepto
  const porConcepto = CONCEPTOS.map(c => ({
    tipo: c, total: cgFil.filter(x => x.tipo === c).reduce((s, x) => s + (+x.monto || 0), 0)
  })).filter(x => x.total > 0)

  if (loading) return <Spinner />

  return (
    <>
      <div className="al info" style={{ marginBottom: 12 }}>
        <i className="ti ti-info-circle"></i>
        El flete y todos los costos generales se prorratean automáticamente entre las áreas de la temporada/cultivo al calcular la rentabilidad de cada cosecha.
      </div>

      {/* ── Nuevo costo ── */}
      <div className="card">
        <div className="ct"><i className="ti ti-plus"></i>Nuevo costo general</div>
        <div className="fr c4">
          <div className="fg"><label>Concepto</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              <option value="">— Concepto —</option>
              {CONCEPTOS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select></div>
          <div className="fg"><label>Descripción</label>
            <input value={form.desc} onChange={e => set('desc', e.target.value)} placeholder="Detalle adicional…" /></div>
          <div className="fg"><label>Monto ($)</label>
            <input type="number" value={form.monto} onChange={e => set('monto', e.target.value)} step="0.01" /></div>
          <div className="fg"><label>Fecha</label>
            <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} /></div>
        </div>
        <div className="fr c3">
          <div className="fg"><label>Temporada</label>
            <select value={form.temporada} onChange={e => set('temporada', e.target.value)}>
              <option value="">— Temporada —</option>
              {TEMPORADAS.map(t => <option key={t}>{t}</option>)}
            </select></div>
          <div className="fg"><label>Año</label>
            <input type="number" value={form.anio} onChange={e => set('anio', e.target.value)} min="2020" max="2040" /></div>
          <div className="fg"><label>Cultivo</label>
            <select value={form.cultivo} onChange={e => set('cultivo', e.target.value)}>
              <option value="">— Cultivo —</option>
              {CULTIVOS.map(c => <option key={c}>{c}</option>)}
            </select></div>
        </div>
        <div className="br-row">
          <button className="btn pr" onClick={save} disabled={saving}>
            <i className="ti ti-device-floppy"></i> Guardar
          </button>
        </div>
      </div>

      {/* ── Prorrateo ── */}
      <div className="card">
        <div className="ct"><i className="ti ti-calculator"></i>Prorrateo por temporada / cultivo</div>
        <div className="fr c3">
          <div className="fg"><label>Temporada</label>
            <select value={prTemp} onChange={e => setPrTemp(e.target.value)}>
              <option value="">Todas</option>{TEMPORADAS.map(t => <option key={t}>{t}</option>)}
            </select></div>
          <div className="fg"><label>Año</label>
            <input type="number" value={prAnio} onChange={e => setPrAnio(e.target.value)} min="2020" max="2040" /></div>
          <div className="fg"><label>Cultivo</label>
            <select value={prCultivo} onChange={e => setPrCultivo(e.target.value)}>
              <option value="">Todos</option>{CULTIVOS.map(c => <option key={c}>{c}</option>)}
            </select></div>
        </div>

        {totalCG > 0 && <>
          {/* Resumen por concepto */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap: 8, margin:'12px 0' }}>
            {porConcepto.map(({ tipo, total }) => (
              <div key={tipo} style={{ background:'var(--cc)', border:'1px solid var(--cn)', borderRadius:'var(--r)', padding:'8px 10px' }}>
                <div style={{ fontSize: 10, color:'var(--cs)', textTransform:'uppercase', marginBottom: 2 }}>{tipo.replace(/_/g,' ')}</div>
                <div style={{ fontSize: 14, fontWeight: 500, fontFamily:'IBM Plex Mono' }}>${fmx(total)}</div>
              </div>
            ))}
          </div>

          <div className="g3" style={{ margin:'10px 0' }}>
            <div className="met"><div className="ml">Total costos gral.</div><div className="mv">${fmx(totalCG)}</div></div>
            <div className="met"><div className="ml">Áreas aplicables</div><div className="mv">{areasM.length}</div><div className="ms">{fmx(totalHa, 1)} ha</div></div>
            <div className="met am"><div className="ml">Costo general / ha</div><div className="mv">${fmx(cgPorHa, 2)}</div></div>
          </div>

          <div className="tw"><table><thead><tr>
            <th>Rancho</th><th>Área</th><th>Ha</th><th>%</th><th>Costo asignado</th>
          </tr></thead><tbody>
          {areasM.map(a => {
            const pct  = (+a.sup || 0) / totalHa * 100
            const asig = ((+a.sup || 0) / totalHa) * totalCG
            return (
              <tr key={a.id}>
                <td><RanchoChip r={a.rancho} /></td>
                <td>{a.tipo} {a.denom}</td>
                <td style={{ fontFamily:'IBM Plex Mono' }}>{a.sup}</td>
                <td style={{ fontFamily:'IBM Plex Mono' }}>{pct.toFixed(1)}%</td>
                <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(asig, 2)}</td>
              </tr>
            )
          })}
          </tbody></table></div>
        </>}
      </div>

      {/* ── Listado ── */}
      <div className="card">
        <div className="ct"><i className="ti ti-list"></i>Costos registrados ({cg.length})</div>
        {!cg.length
          ? <div className="empty"><p>Sin costos</p></div>
          : <div className="tw"><table><thead><tr>
              <th>Fecha</th><th>Concepto</th><th>Descripción</th><th>Monto</th><th>Temporada</th><th>Año</th><th>Cultivo</th><th></th>
            </tr></thead><tbody>
            {cg.map(c => (
              <tr key={c.id}>
                <td style={{ fontSize: 11, fontFamily:'IBM Plex Mono' }}>{fmtFecha(c.fecha)}</td>
                <td><span className="badge badge-info">{(c.tipo || '').replace(/_/g,' ')}</span></td>
                <td>{c.descripcion || '—'}</td>
                <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(c.monto)}</td>
                <td>{c.temporada || '—'}</td>
                <td>{c.anio || '—'}</td>
                <td>{c.cultivo || '—'}</td>
                <td style={{ display:'flex', gap: 4 }}>
                  <button className="btn sm" onClick={() => setEdit({ ...c })}><i className="ti ti-edit"></i></button>
                  <button className="btn sm dg" onClick={() => del(c.id)}><i className="ti ti-trash"></i></button>
                </td>
              </tr>
            ))}
            </tbody></table></div>}
      </div>

      {/* ── Modal editar ── */}
      {edit && (
        <Modal title="Editar costo" onClose={() => setEdit(null)}>
          <div className="fr c2">
            <div className="fg"><label>Concepto</label>
              <select value={edit.tipo} onChange={e => setE('tipo', e.target.value)}>
                {CONCEPTOS.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select></div>
            <div className="fg"><label>Descripción</label>
              <input value={edit.descripcion || ''} onChange={e => setE('descripcion', e.target.value)} /></div>
          </div>
          <div className="fr c3">
            <div className="fg"><label>Monto ($)</label>
              <input type="number" value={edit.monto} onChange={e => setE('monto', e.target.value)} step="0.01" /></div>
            <div className="fg"><label>Fecha</label>
              <input type="date" value={edit.fecha || ''} onChange={e => setE('fecha', e.target.value)} /></div>
            <div className="fg"><label>Temporada</label>
              <select value={edit.temporada || ''} onChange={e => setE('temporada', e.target.value)}>
                <option value="">—</option>
                {TEMPORADAS.map(t => <option key={t}>{t}</option>)}
              </select></div>
          </div>
          <div className="fr c2">
            <div className="fg"><label>Año</label>
              <input type="number" value={edit.anio || ''} onChange={e => setE('anio', e.target.value)} /></div>
            <div className="fg"><label>Cultivo</label>
              <select value={edit.cultivo || ''} onChange={e => setE('cultivo', e.target.value)}>
                <option value="">—</option>
                {CULTIVOS.map(c => <option key={c}>{c}</option>)}
              </select></div>
          </div>
          <div className="br-row" style={{ justifyContent:'flex-end' }}>
            <button className="btn" onClick={() => setEdit(null)}>Cancelar</button>
            <button className="btn pr" onClick={update} disabled={saving}><i className="ti ti-check"></i> Actualizar</button>
          </div>
        </Modal>
      )}
    </>
  )
}
