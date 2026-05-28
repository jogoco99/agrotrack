import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { RanchoChip, TipoChip, ActBadge, Modal, toast, Spinner, fmx, fmtFecha, today } from '../components/UI'
import { RANCHOS, TIPOS_ACT, ROLES_VEN_COSTOS } from '../lib/constants'

export default function Actividades() {
  const { perfil } = useAuth()
  const verCostos = ROLES_VEN_COSTOS.includes(perfil?.rol)

  const [acts,    setActs]    = useState([])
  const [areas,   setAreas]   = useState([])
  const [prods,   setProds]   = useState([])
  const [loading, setLoading] = useState(true)
  const [fR,      setFR]      = useState('')
  const [fT,      setFT]      = useState('')
  const [edit,    setEdit]    = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [form,    setForm]    = useState({
    rancho:'', areaId:'', tipo:'', fecha: today(),
    hi:'08:00', hf:'20:00', fecha_fin:'',
    lamina:'', metodo:'', vel:'', pi:'', pf:'',
    prodId:'', dosis:'', obs:''
  })

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [{ data: a }, { data: ac }, { data: p }] = await Promise.all([
      sb.from('areas').select('*').eq('activa', true),
      sb.from('actividades').select('*, areas(rancho,tipo,denom,variedad)').order('fecha', { ascending: false }).limit(150),
      sb.from('productos').select('*').eq('activo', true),
    ])
    setAreas(a || []); setActs(ac || []); setProds(p || [])
    setLoading(false)
  }

  function set(k, v)  { setForm(f => ({ ...f, [k]: v })) }
  function setE(k, v) { setEdit(e => ({ ...e, [k]: v })) }

  const areasR  = areas.filter(a => a.rancho === form.rancho)
  const selArea = areas.find(a => a.id === form.areaId)
  const esPC    = selArea?.tipo === 'Pivote' || selArea?.tipo === 'Cintilla'
  const prodsT  = prods.filter(p => p.categoria === form.tipo)

  function calcHoras(fi, ff, hi, hf) {
    if (!hi || !hf) return null
    const d1 = new Date((fi || today()) + 'T' + hi)
    const d2 = new Date((ff || fi || today()) + 'T' + hf)
    let mins = (d2 - d1) / 60000
    if (mins < 0) mins += 1440
    return parseFloat((mins / 60).toFixed(2))
  }

  function calcCosto() {
    const p = prods.find(x => x.id === form.prodId)
    if (!p || !form.dosis || !selArea?.sup) return ''
    return (p.precio * parseFloat(form.dosis) * selArea.sup).toFixed(2)
  }

  async function save() {
    if (!form.areaId || !form.tipo || !form.fecha) { toast('Completa área, tipo y fecha', false); return }
    setSaving(true)
    const costo = form.tipo === 'riego' ? 0 : parseFloat(calcCosto() || form.costo) || 0
    const hrs   = calcHoras(form.fecha, form.fecha_fin, form.hi, form.hf)
    const prod  = prods.find(p => p.id === form.prodId)
    const actData = {
      area_id: form.areaId, tipo: form.tipo, fecha: form.fecha, costo,
      ...(form.tipo === 'riego' ? {
        hora_inicio: form.hi, hora_fin: form.hf,
        fecha_fin_riego: form.fecha_fin || null,
        horas_regadas: hrs,
        lamina: form.lamina, metodo: form.metodo,
        velocidad_pivote: form.vel ? parseFloat(form.vel) : null,
        presion_inicial:  form.pi  ? parseFloat(form.pi)  : null,
        presion_final:    form.pf  ? parseFloat(form.pf)  : null,
        notas: form.obs, detalle: form.lamina || 'Riego',
      } : {
        producto_id: form.prodId || null,
        detalle: prod?.nombre || form.obs || '',
        dosis:   form.dosis ? form.dosis + '/ha' : '',
        metodo:  form.metodo, notas: form.obs,
      })
    }
    const { error } = await sb.from('actividades').insert(actData)
    setSaving(false)
    if (error) { toast('Error: ' + error.message, false); return }
    toast('Actividad guardada')
    setForm(f => ({ ...f, lamina:'', metodo:'', vel:'', pi:'', pf:'', prodId:'', dosis:'', obs:'', fecha_fin:'' }))
    load()
  }

  async function update() {
    if (!edit) return; setSaving(true)
    const hrs = calcHoras(edit.fecha, edit.fecha_fin_riego, edit.hora_inicio, edit.hora_fin)
    await sb.from('actividades').update({
      fecha:   edit.fecha,
      detalle: edit.detalle || null,
      dosis:   edit.dosis   || null,
      metodo:  edit.metodo  || null,
      notas:   edit.notas   || null,
      ...(edit.tipo === 'riego' ? {
        hora_inicio:     edit.hora_inicio || null,
        hora_fin:        edit.hora_fin    || null,
        fecha_fin_riego: edit.fecha_fin_riego || null,
        horas_regadas:   hrs,
        lamina:          edit.lamina || null,
        velocidad_pivote: edit.velocidad_pivote ? parseFloat(edit.velocidad_pivote) : null,
        presion_inicial:  edit.presion_inicial  ? parseFloat(edit.presion_inicial)  : null,
        presion_final:    edit.presion_final    ? parseFloat(edit.presion_final)    : null,
      } : {
        costo: parseFloat(edit.costo) || 0,
      })
    }).eq('id', edit.id)
    setSaving(false); setEdit(null); toast('Actualizado'); load()
  }

  async function del(id) { await sb.from('actividades').delete().eq('id', id); toast('Eliminado'); load() }

  if (loading) return <Spinner />

  const fil = acts.filter(a => (!fR || a.areas?.rancho === fR) && (!fT || a.tipo === fT))

  return (
    <>
      {/* ── Formulario ── */}
      <div className="card">
        <div className="ct"><i className="ti ti-plus"></i>Registrar Actividad</div>
        <div className="fr c3">
          <div className="fg"><label>Rancho</label>
            <select value={form.rancho} onChange={e => { set('rancho', e.target.value); set('areaId', '') }}>
              <option value="">— Rancho —</option>
              {Object.entries(RANCHOS).map(([k, r]) => <option key={k} value={k}>{r.nombre}</option>)}
            </select></div>
          <div className="fg"><label>Área</label>
            <select value={form.areaId} onChange={e => set('areaId', e.target.value)}>
              <option value="">— Área —</option>
              {areasR.map(a => <option key={a.id} value={a.id}>{a.tipo} {a.denom}{a.variedad ? ' — ' + a.variedad : ''}</option>)}
            </select></div>
          <div className="fg"><label>Tipo</label>
            <select value={form.tipo} onChange={e => { set('tipo', e.target.value); set('prodId', '') }}>
              <option value="">— Tipo —</option>
              {Object.entries(TIPOS_ACT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select></div>
        </div>
        <div className="fg" style={{ marginBottom: 10 }}><label>Fecha</label>
          <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} style={{ maxWidth: 180 }} /></div>

        {form.tipo === 'riego' && (
          <>
            <div className="sdiv">Datos del riego</div>
            <div className="fr c4">
              <div className="fg"><label>Fecha inicio</label><input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} /></div>
              <div className="fg"><label>Hora inicio</label><input type="time" value={form.hi} onChange={e => set('hi', e.target.value)} /></div>
              <div className="fg"><label>Fecha fin</label><input type="date" value={form.fecha_fin} onChange={e => set('fecha_fin', e.target.value)} /></div>
              <div className="fg"><label>Hora fin</label><input type="time" value={form.hf} onChange={e => set('hf', e.target.value)} /></div>
            </div>
            <div className="fr c3">
              <div className="fg"><label>Horas calculadas</label>
                <input readOnly value={calcHoras(form.fecha, form.fecha_fin, form.hi, form.hf) != null ? calcHoras(form.fecha, form.fecha_fin, form.hi, form.hf) + ' h' : ''} /></div>
              <div className="fg"><label>Lámina / Volumen</label><input value={form.lamina} onChange={e => set('lamina', e.target.value)} placeholder="mm o m³/ha" /></div>
              <div className="fg"><label>Método</label><input value={form.metodo} onChange={e => set('metodo', e.target.value)} /></div>
            </div>
            {esPC && (
              <div className="fr c3">
                <div className="fg"><label>Velocidad pivote (%)</label><input type="number" value={form.vel} onChange={e => set('vel', e.target.value)} /></div>
                <div className="fg"><label>Presión inicial</label><input type="number" value={form.pi} onChange={e => set('pi', e.target.value)} step="0.01" /></div>
                <div className="fg"><label>Presión final</label><input type="number" value={form.pf} onChange={e => set('pf', e.target.value)} step="0.01" /></div>
              </div>
            )}
          </>
        )}

        {(form.tipo === 'fertilizante' || form.tipo === 'herbicida' || form.tipo === 'insecticida') && (
          <>
            <div className="sdiv">Datos de la aplicación</div>
            <div className="fr c3">
              <div className="fg"><label>Producto</label>
                <select value={form.prodId} onChange={e => set('prodId', e.target.value)}>
                  <option value="">— Selecciona —</option>
                  {prodsT.map(p => <option key={p.id} value={p.id}>{p.nombre} (${fmx(p.precio, 2)}/{p.unidad})</option>)}
                </select></div>
              <div className="fg"><label>Dosis (por ha)</label><input type="number" value={form.dosis} onChange={e => set('dosis', e.target.value)} step="0.01" /></div>
              {verCostos && <div className="fg"><label>Costo calculado ($)</label><input readOnly value={calcCosto() || ''} placeholder="Automático" /></div>}
            </div>
          </>
        )}

        {form.tipo && (
          <div className="fr c2">
            <div className="fg"><label>Método</label><input value={form.metodo} onChange={e => set('metodo', e.target.value)} /></div>
            <div className="fg"><label>Notas</label><input value={form.obs} onChange={e => set('obs', e.target.value)} /></div>
          </div>
        )}
        <div className="br-row">
          <button className="btn pr" onClick={save} disabled={saving}>
            {saving ? <><i className="ti ti-loader"></i> Guardando…</> : <><i className="ti ti-device-floppy"></i> Guardar</>}
          </button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="card">
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div className="fg" style={{ minWidth:140 }}><label>Rancho</label>
            <select value={fR} onChange={e => setFR(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(RANCHOS).map(([k, r]) => <option key={k} value={k}>{r.nombre}</option>)}
            </select></div>
          <div className="fg" style={{ minWidth:140 }}><label>Tipo</label>
            <select value={fT} onChange={e => setFT(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(TIPOS_ACT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select></div>
          <button className="btn sm" onClick={() => { setFR(''); setFT('') }}><i className="ti ti-x"></i> Limpiar</button>
        </div>
      </div>

      {/* ── Historial ── */}
      <div className="card">
        <div className="ct"><i className="ti ti-list"></i>Historial ({fil.length})</div>
        {!fil.length
          ? <div className="empty"><i className="ti ti-clipboard"></i><p>Sin actividades</p></div>
          : <div className="tw"><table><thead><tr>
              <th>Fecha</th><th>Rancho</th><th>Área</th><th>Tipo</th><th>Detalle</th><th>Hrs/Dosis</th>
              {verCostos && <th>Costo</th>}
              <th></th>
            </tr></thead><tbody>
            {fil.map(a => (
              <tr key={a.id}>
                <td style={{ fontFamily:'IBM Plex Mono', fontSize:11 }}>{fmtFecha(a.fecha)}</td>
                <td>{a.areas ? <RanchoChip r={a.areas.rancho} /> : '—'}</td>
                <td>{a.areas ? <TipoChip t={a.areas.tipo} /> : null} {a.areas?.denom || ''}</td>
                <td><ActBadge tipo={a.tipo} /></td>
                <td>{a.detalle || '—'}</td>
                <td style={{ fontSize:11 }}>{a.tipo==='riego' ? (a.horas_regadas!=null ? a.horas_regadas+'h' : '—') : (a.dosis||'—')}</td>
                {verCostos && <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(a.costo)}</td>}
                <td style={{ display:'flex', gap:3 }}>
                  <button className="btn sm" onClick={() => setEdit({ ...a })}><i className="ti ti-edit"></i></button>
                  <button className="btn sm dg" onClick={() => del(a.id)}><i className="ti ti-trash"></i></button>
                </td>
              </tr>
            ))}
            </tbody></table></div>}
      </div>

      {/* ── Modal editar ── */}
      {edit && (
        <Modal title={`Editar: ${TIPOS_ACT[edit.tipo]?.label} — ${fmtFecha(edit.fecha)}`} onClose={() => setEdit(null)} wide>
          <div className="fr c2">
            <div className="fg"><label>Fecha</label>
              <input type="date" value={edit.fecha || ''} onChange={e => setE('fecha', e.target.value)} /></div>
            <div className="fg"><label>Detalle / Producto</label>
              <input value={edit.detalle || ''} onChange={e => setE('detalle', e.target.value)} /></div>
          </div>

          {edit.tipo === 'riego' ? (
            <>
              <div className="fr c4">
                <div className="fg"><label>Fecha inicio</label><input type="date" value={edit.fecha||''} onChange={e=>setE('fecha',e.target.value)}/></div>
                <div className="fg"><label>Hora inicio</label><input type="time" value={edit.hora_inicio||''} onChange={e=>setE('hora_inicio',e.target.value)}/></div>
                <div className="fg"><label>Fecha fin</label><input type="date" value={edit.fecha_fin_riego||''} onChange={e=>setE('fecha_fin_riego',e.target.value)}/></div>
                <div className="fg"><label>Hora fin</label><input type="time" value={edit.hora_fin||''} onChange={e=>setE('hora_fin',e.target.value)}/></div>
              </div>
              <div className="fr c3">
                <div className="fg"><label>Horas calculadas</label>
                  <input readOnly value={calcHoras(edit.fecha, edit.fecha_fin_riego, edit.hora_inicio, edit.hora_fin) != null ? calcHoras(edit.fecha, edit.fecha_fin_riego, edit.hora_inicio, edit.hora_fin) + ' h' : ''} /></div>
                <div className="fg"><label>Lámina</label><input value={edit.lamina||''} onChange={e=>setE('lamina',e.target.value)}/></div>
                <div className="fg"><label>Método</label><input value={edit.metodo||''} onChange={e=>setE('metodo',e.target.value)}/></div>
              </div>
              <div className="fr c3">
                <div className="fg"><label>Vel. pivote (%)</label><input type="number" value={edit.velocidad_pivote||''} onChange={e=>setE('velocidad_pivote',e.target.value)}/></div>
                <div className="fg"><label>Presión inicial</label><input type="number" value={edit.presion_inicial||''} onChange={e=>setE('presion_inicial',e.target.value)} step="0.01"/></div>
                <div className="fg"><label>Presión final</label><input type="number" value={edit.presion_final||''} onChange={e=>setE('presion_final',e.target.value)} step="0.01"/></div>
              </div>
            </>
          ) : (
            <div className="fr c3">
              <div className="fg"><label>Dosis</label><input value={edit.dosis||''} onChange={e=>setE('dosis',e.target.value)}/></div>
              <div className="fg"><label>Método</label><input value={edit.metodo||''} onChange={e=>setE('metodo',e.target.value)}/></div>
              {verCostos && <div className="fg"><label>Costo ($)</label><input type="number" value={edit.costo||''} onChange={e=>setE('costo',e.target.value)} step="0.01"/></div>}
            </div>
          )}
          <div className="fg" style={{ marginTop:8 }}><label>Notas</label>
            <input value={edit.notas||''} onChange={e=>setE('notas',e.target.value)}/></div>
          <div className="br-row" style={{ justifyContent:'flex-end' }}>
            <button className="btn" onClick={() => setEdit(null)}>Cancelar</button>
            <button className="btn pr" onClick={update} disabled={saving}><i className="ti ti-check"></i> Actualizar</button>
          </div>
        </Modal>
      )}
    </>
  )
}
