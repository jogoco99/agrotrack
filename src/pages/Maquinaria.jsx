import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Modal, toast, Spinner, fmx, fmtFecha } from '../components/UI'
import { RANCHOS, ROLES_VEN_COSTOS } from '../lib/constants'

const EST = { operativo:'✅ Operativo', mantenimiento:'🔧 Mantenimiento', falla:'❌ Con falla' }
const emptyMaq = { nombre:'', tipo:'', rancho:'', area_denom:'', estatus:'operativo', modelo:'', anio:'', ultima_rev:'', notas:'' }
const emptyServ = { tipo_serv:'', descripcion:'', fecha:'', costo:'', proveedor:'', notas_serv:'' }

export default function Maquinaria() {
  const { perfil } = useAuth()
  const verCostos = ROLES_VEN_COSTOS.includes(perfil?.rol)

  const [maq,      setMaq]      = useState([])
  const [servicios,setServicios]= useState([])
  const [loading,  setLoading]  = useState(true)
  const [form,     setForm]     = useState(emptyMaq)
  const [edit,     setEdit]     = useState(null)
  const [historial,setHistorial]= useState(null) // equipo seleccionado para ver historial
  const [servForm, setServForm] = useState(emptyServ)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [{ data: m }, { data: s }] = await Promise.all([
      sb.from('maquinaria').select('*').order('rancho').order('nombre'),
      sb.from('servicios_maquinaria').select('*').order('fecha', { ascending: false }),
    ])
    setMaq(m || []); setServicios(s || [])
    setLoading(false)
  }

  function set(k, v)  { setForm(f => ({ ...f, [k]: v })) }
  function setE(k, v) { setEdit(e => ({ ...e, [k]: v })) }
  function setSF(k, v){ setServForm(f => ({ ...f, [k]: v })) }

  async function saveMaq() {
    if (!form.nombre) { toast('Agrega nombre', false); return }
    setSaving(true)
    const { error } = await sb.from('maquinaria').insert({
      ...form, anio: form.anio ? +form.anio : null, ultima_rev: form.ultima_rev || null
    })
    setSaving(false)
    if (error) { toast('Error', false); return }
    toast('Guardado'); setForm(emptyMaq); load()
  }

  async function updateMaq() {
    if (!edit) return; setSaving(true)
    await sb.from('maquinaria').update({
      nombre: edit.nombre, estatus: edit.estatus,
      ultima_rev: edit.ultima_rev || null, notas: edit.notas || null
    }).eq('id', edit.id)
    setSaving(false); setEdit(null); toast('Actualizado'); load()
  }

  async function delMaq(id) {
    await sb.from('maquinaria').delete().eq('id', id); toast('Eliminado'); load()
  }

  async function saveServicio() {
    if (!historial || !servForm.tipo_serv || !servForm.fecha) {
      toast('Completa tipo y fecha', false); return
    }
    setSaving(true)
    const { error } = await sb.from('servicios_maquinaria').insert({
      maquinaria_id: historial.id,
      tipo: servForm.tipo_serv,
      descripcion: servForm.descripcion || null,
      fecha: servForm.fecha,
      costo: servForm.costo ? parseFloat(servForm.costo) : 0,
      proveedor: servForm.proveedor || null,
      notas: servForm.notas_serv || null,
    })
    setSaving(false)
    if (error) { toast('Error: ' + error.message, false); return }
    toast('Servicio registrado'); setServForm(emptyServ); load()
  }

  async function delServicio(id) {
    await sb.from('servicios_maquinaria').delete().eq('id', id); toast('Eliminado'); load()
  }

  if (loading) return <Spinner />

  const byCls  = est => est === 'operativo' ? 'maq-ok' : est === 'mantenimiento' ? 'maq-warn' : 'maq-bad'
  const byIcon = est => est === 'operativo' ? 'ti-check' : est === 'mantenimiento' ? 'ti-tool' : 'ti-alert-triangle'

  const servHistorial = historial ? servicios.filter(s => s.maquinaria_id === historial.id) : []
  const costoTotal    = servHistorial.reduce((s, x) => s + (+x.costo || 0), 0)

  return (
    <>
      {/* ── Métricas ── */}
      <div className="g3" style={{ marginBottom: 14 }}>
        {Object.entries(EST).map(([k, v]) => {
          const n = maq.filter(m => m.estatus === k).length
          return (
            <div key={k} className={`met ${k==='operativo'?'gr':k==='mantenimiento'?'am':'rd'}`}>
              <div className="ml">{v}</div><div className="mv">{n}</div><div className="ms">equipos</div>
            </div>
          )
        })}
      </div>

      {/* ── Alta de equipo ── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ct"><i className="ti ti-plus"></i>Dar de alta equipo</div>
        <div className="fr c4">
          <div className="fg"><label>Nombre</label>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Pivote P1, Tractor…" /></div>
          <div className="fg"><label>Tipo</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              <option value="">— Tipo —</option>
              {['pivote','cintilla','aspersion','tractor','cosechadora','otro'].map(t => <option key={t}>{t}</option>)}
            </select></div>
          <div className="fg"><label>Rancho</label>
            <select value={form.rancho} onChange={e => set('rancho', e.target.value)}>
              <option value="">— Rancho —</option>
              {Object.entries(RANCHOS).map(([k, r]) => <option key={k} value={k}>{r.nombre}</option>)}
            </select></div>
          <div className="fg"><label>Área asignada</label>
            <input value={form.area_denom} onChange={e => set('area_denom', e.target.value)} placeholder="P1, T3…" /></div>
        </div>
        <div className="fr c4">
          <div className="fg"><label>Estatus</label>
            <select value={form.estatus} onChange={e => set('estatus', e.target.value)}>
              {Object.entries(EST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div className="fg"><label>Marca / Modelo</label>
            <input value={form.modelo} onChange={e => set('modelo', e.target.value)} placeholder="Valley 8000…" /></div>
          <div className="fg"><label>Año</label>
            <input type="number" value={form.anio} onChange={e => set('anio', e.target.value)} min="1990" max="2030" /></div>
          <div className="fg"><label>Última revisión</label>
            <input type="date" value={form.ultima_rev} onChange={e => set('ultima_rev', e.target.value)} /></div>
        </div>
        <div className="fg" style={{ marginBottom: 10 }}><label>Notas</label>
          <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows="2" style={{ resize:'vertical' }}></textarea></div>
        <div className="br-row">
          <button className="btn pr" onClick={saveMaq} disabled={saving}><i className="ti ti-device-floppy"></i> Guardar</button>
        </div>
      </div>

      {/* ── Tarjetas de equipo ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap: 10, marginBottom: 14 }}>
        {!maq.length
          ? <div className="empty" style={{ gridColumn:'1/-1' }}><i className="ti ti-tractor"></i><p>Sin maquinaria</p></div>
          : maq.map(m => (
              <div key={m.id} className="maq-card">
                <div className={`maq-icon ${byCls(m.estatus)}`}><i className={`ti ${byIcon(m.estatus)}`}></i></div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 13, display:'block' }}>{m.nombre}</strong>
                  <span style={{ fontSize: 11, color:'var(--cs)' }}>
                    {m.tipo || ''} · {RANCHOS[m.rancho]?.nombre || m.rancho || '—'} {m.area_denom ? '· ' + m.area_denom : ''}
                  </span>
                  {m.modelo && <span style={{ fontSize: 11, color:'var(--cs)', display:'block' }}>{m.modelo} {m.anio ? '(' + m.anio + ')' : ''}</span>}
                  {m.ultima_rev && <span style={{ fontSize: 10, color:'var(--ct)', display:'block' }}>Última revisión: {fmtFecha(m.ultima_rev)}</span>}
                  {verCostos && (
                    <span style={{ fontSize: 11, color:'var(--cg)', display:'block', marginTop: 2 }}>
                      Servicios: ${fmx(servicios.filter(s => s.maquinaria_id === m.id).reduce((s, x) => s + (+x.costo || 0), 0))}
                    </span>
                  )}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap: 4 }}>
                  <button className="btn sm" onClick={() => setHistorial(m)} title="Ver historial">
                    <i className="ti ti-history"></i>
                  </button>
                  <button className="btn sm" onClick={() => setEdit({ ...m })}><i className="ti ti-edit"></i></button>
                  <button className="btn sm dg" onClick={() => delMaq(m.id)}><i className="ti ti-trash"></i></button>
                </div>
              </div>
            ))}
      </div>

      {/* ── Modal editar ── */}
      {edit && (
        <Modal title={'Editar: ' + edit.nombre} onClose={() => setEdit(null)}>
          <div className="fr c2">
            <div className="fg"><label>Nombre</label><input value={edit.nombre} onChange={e => setE('nombre', e.target.value)} /></div>
            <div className="fg"><label>Estatus</label>
              <select value={edit.estatus} onChange={e => setE('estatus', e.target.value)}>
                {Object.entries(EST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
          </div>
          <div className="fr c2">
            <div className="fg"><label>Última revisión</label>
              <input type="date" value={edit.ultima_rev || ''} onChange={e => setE('ultima_rev', e.target.value)} /></div>
            <div className="fg"><label>Notas</label>
              <textarea value={edit.notas || ''} onChange={e => setE('notas', e.target.value)} rows="2"></textarea></div>
          </div>
          <div className="br-row" style={{ justifyContent:'flex-end' }}>
            <button className="btn" onClick={() => setEdit(null)}>Cancelar</button>
            <button className="btn pr" onClick={updateMaq} disabled={saving}><i className="ti ti-check"></i> Actualizar</button>
          </div>
        </Modal>
      )}

      {/* ── Modal historial de servicios ── */}
      {historial && (
        <Modal title={`Historial: ${historial.nombre}`} onClose={() => setHistorial(null)} wide>
          <div style={{ display:'flex', gap: 8, flexWrap:'wrap', marginBottom: 12 }}>
            <span className={`badge ${historial.estatus==='operativo'?'badge-ok':historial.estatus==='mantenimiento'?'badge-warn':'badge-red'}`}>
              {EST[historial.estatus]}
            </span>
            {historial.modelo && <span className="badge badge-info">{historial.modelo}</span>}
            {verCostos && servHistorial.length > 0 && (
              <span className="badge badge-ok">Total invertido: ${fmx(costoTotal)}</span>
            )}
          </div>

          {/* Formulario nuevo servicio */}
          <div className="sdiv">Registrar servicio / refacción</div>
          <div className="fr c3">
            <div className="fg"><label>Tipo</label>
              <select value={servForm.tipo_serv} onChange={e => setSF('tipo_serv', e.target.value)}>
                <option value="">— Tipo —</option>
                {['cambio_aceite','filtros','refaccion','servicio_mayor','servicio_menor','reparacion','otro'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select></div>
            <div className="fg"><label>Descripción</label>
              <input value={servForm.descripcion} onChange={e => setSF('descripcion', e.target.value)} placeholder="Filtro de aire, banda…" /></div>
            <div className="fg"><label>Fecha</label>
              <input type="date" value={servForm.fecha} onChange={e => setSF('fecha', e.target.value)} /></div>
          </div>
          <div className="fr c3">
            {verCostos && <div className="fg"><label>Costo ($)</label>
              <input type="number" value={servForm.costo} onChange={e => setSF('costo', e.target.value)} step="0.01" /></div>}
            <div className="fg"><label>Taller / Proveedor</label>
              <input value={servForm.proveedor} onChange={e => setSF('proveedor', e.target.value)} /></div>
            <div className="fg"><label>Notas</label>
              <input value={servForm.notas_serv} onChange={e => setSF('notas_serv', e.target.value)} /></div>
          </div>
          <div className="br-row">
            <button className="btn pr" onClick={saveServicio} disabled={saving}>
              <i className="ti ti-plus"></i> Agregar
            </button>
          </div>

          {/* Historial */}
          <div className="sdiv" style={{ marginTop: 16 }}>Historial ({servHistorial.length} registros)</div>
          {!servHistorial.length
            ? <div className="empty"><p>Sin servicios registrados</p></div>
            : <div className="tw"><table><thead><tr>
                <th>Fecha</th><th>Tipo</th><th>Descripción</th>
                {verCostos && <th>Costo</th>}
                <th>Proveedor</th><th>Notas</th><th></th>
              </tr></thead><tbody>
              {servHistorial.map(s => (
                <tr key={s.id}>
                  <td style={{ fontFamily:'IBM Plex Mono', fontSize: 11 }}>{fmtFecha(s.fecha)}</td>
                  <td><span className="badge badge-info">{(s.tipo || '').replace(/_/g,' ')}</span></td>
                  <td>{s.descripcion || '—'}</td>
                  {verCostos && <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(s.costo)}</td>}
                  <td>{s.proveedor || '—'}</td>
                  <td style={{ fontSize: 11, color:'var(--ct)' }}>{s.notas || '—'}</td>
                  <td><button className="btn sm dg" onClick={() => delServicio(s.id)}><i className="ti ti-trash"></i></button></td>
                </tr>
              ))}
              </tbody></table></div>}

          <div className="br-row" style={{ justifyContent:'flex-end', marginTop: 12 }}>
            <button className="btn" onClick={() => setHistorial(null)}>Cerrar</button>
          </div>
        </Modal>
      )}
    </>
  )
}
