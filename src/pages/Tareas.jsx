import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { RanchoChip, ActBadge, Modal, toast, Spinner, fmx, fmtFecha, today, daysFrom } from '../components/UI'
import { RANCHOS, TIPOS_ACT } from '../lib/constants'

export default function Tareas() {
  const [progs,   setProgs]   = useState([])
  const [areas,   setAreas]   = useState([])
  const [prods,   setProds]   = useState([])
  const [loading, setLoading] = useState(true)
  const [marcar,  setMarcar]  = useState(null)
  const [form,    setForm]    = useState({})
  const [tab,     setTab]     = useState('pend')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: a }, { data: pr }] = await Promise.all([
      sb.from('programas').select('*, areas(id,rancho,tipo,denom,sup,variedad,cultivo)').order('fecha'),
      sb.from('areas').select('*').eq('activa', true),
      sb.from('productos').select('*').eq('activo', true),
    ])
    setProgs(p || []); setAreas(a || []); setProds(pr || [])
    setLoading(false)
  }

  const hoy   = today()
  const en10  = new Date(hoy); en10.setDate(en10.getDate() + 10)
  const en10s = en10.toISOString().split('T')[0]
  const pend  = progs.filter(p => !p.completado && p.fecha <= en10s).sort((a, b) => a.fecha.localeCompare(b.fecha))
  const hechas= progs.filter(p => p.completado).sort((a, b) => b.fecha.localeCompare(a.fecha))

  async function eliminar(id) {
    await sb.from('programas').delete().eq('id', id)
    toast('Eliminado'); load()
  }

  // Cálculo automático de costo
  function calcCostoAuto() {
    if (!marcar) return 0
    const area = areas.find(a => a.id === marcar.area_id)
    if (!area) return 0

    // Si viene de programación con producto ya definido
    const prodNombre = form.producto || marcar.producto
    const prod = prods.find(p => p.nombre === prodNombre || p.id === form.prodId)
    if (!prod || !form.dosis) return 0

    return parseFloat((prod.precio * parseFloat(form.dosis) * area.sup).toFixed(2))
  }

  function calcHoras() {
    if (!form.hi || !form.hf) return null
    const fi = new Date((form.fecha_ef || marcar?.fecha || hoy) + 'T' + form.hi)
    const ff = new Date((form.fecha_fin || form.fecha_ef || marcar?.fecha || hoy) + 'T' + form.hf)
    let mins = (ff - fi) / 60000
    if (mins < 0) mins += 1440
    return parseFloat((mins / 60).toFixed(2))
  }

  async function confirmarTarea() {
    const p = marcar; if (!p) return
    const area = areas.find(a => a.id === p.area_id) || p.areas || {}
    const tipo = p.tipo
    const horasRegadas = tipo === 'riego' ? calcHoras() : null
    const costoAuto    = tipo !== 'riego' ? calcCostoAuto() : 0
    let cumplimiento   = null
    if (tipo === 'riego' && p.horas_prog && horasRegadas) {
      cumplimiento = parseFloat(((horasRegadas / p.horas_prog) * 100).toFixed(1))
    }

    const actData = {
      area_id: p.area_id,
      tipo,
      fecha: form.fecha_ef || p.fecha,
      from_prog: p.id,
      costo: costoAuto,
    }

    if (tipo === 'riego') {
      Object.assign(actData, {
        hora_inicio: form.hi, hora_fin: form.hf,
        fecha_fin_riego: form.fecha_fin || null,
        horas_regadas: horasRegadas, horas_prog: p.horas_prog,
        cumplimiento, lamina: form.lamina, metodo: form.metodo,
        velocidad_pivote: form.vel ? parseFloat(form.vel) : null,
        presion_inicial:  form.pi  ? parseFloat(form.pi)  : null,
        presion_final:    form.pf  ? parseFloat(form.pf)  : null,
        notas: form.obs, detalle: form.lamina || 'Riego',
      })
    } else {
      const prod = prods.find(pr => pr.nombre === (form.producto || p.producto) || pr.id === form.prodId)
      actData.detalle     = prod?.nombre || form.producto || p.producto || ''
      actData.dosis       = form.dosis ? form.dosis + '/ha' : (p.dosis || '')
      actData.metodo      = form.metodo
      actData.notas       = form.obs
      actData.producto_id = prod?.id || null
    }

    const { data: act, error } = await sb.from('actividades').insert(actData).select().single()
    if (error) { toast('Error al guardar', false); return }

    await sb.from('programas').update({
      completado: true, fecha_hecho: actData.fecha, actividad_id: act.id
    }).eq('id', p.id)

    setMarcar(null); setForm({})
    toast('Actividad guardada'); load()
  }

  function abrirMarcar(p) {
    // Pre-llenar producto y dosis del programa si existen
    const prod = prods.find(pr => pr.nombre === p.producto)
    setMarcar(p)
    setForm({
      fecha_ef: p.fecha,
      hi: '08:00', hf: '20:00',
      fecha_fin: '',
      producto: p.producto || '',
      prodId: prod?.id || '',
      dosis: p.dosis ? parseFloat(p.dosis) : '',
    })
  }

  if (loading) return <Spinner />

  const esPC = marcar && (marcar.areas?.tipo === 'Pivote' || marcar.areas?.tipo === 'Cintilla')
  const costoAuto = marcar?.tipo !== 'riego' ? calcCostoAuto() : 0
  const horasCalc = marcar?.tipo === 'riego'  ? calcHoras()    : null

  let horaAlert = null
  if (marcar?.tipo === 'riego' && marcar.horas_prog && horasCalc != null) {
    const diff = horasCalc - marcar.horas_prog
    if (Math.abs(diff) > 0.5) horaAlert = { hrs: horasCalc, diff }
  }

  return (
    <>
      <div className="al info" style={{ marginBottom: 12 }}>
        <i className="ti ti-info-circle"></i>Solo se muestran tareas de los próximos 10 días.
      </div>

      <div className="tabs">
        {[['pend', `Pendientes (${pend.length})`], ['done', `Completadas (${hechas.length})`]].map(([id, lbl]) => (
          <button key={id} className={`tabb ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{lbl}</button>
        ))}
      </div>

      {tab === 'pend' && (
        !pend.length
          ? <div className="empty"><i className="ti ti-calendar-check"></i><p>Sin tareas en los próximos 10 días</p></div>
          : pend.map(p => {
              const d = daysFrom(p.fecha)
              const cls = d < 0 ? 'urg' : d === 0 ? 'hoy' : 'fut'
              return (
                <div className={`pi ${cls}`} key={p.id}>
                  <div className="pi-date">{fmtFecha(p.fecha)}</div>
                  <div className="pi-info">
                    <strong>
                      {TIPOS_ACT[p.tipo]?.label}
                      {p.num_aplicacion ? ` — Aplic. #${p.num_aplicacion}` : ''}
                      {p.producto ? ' — ' + p.producto : ''}
                    </strong>
                    <span>{p.areas ? <RanchoChip r={p.areas.rancho} /> : null} {p.areas?.denom} {p.dosis ? '· ' + p.dosis : ''}</span>
                  </div>
                  <span className={`badge ${d < 0 ? 'badge-red' : d === 0 ? 'badge-warn' : 'badge-info'}`} style={{ marginRight: 6 }}>
                    {d < 0 ? `Atraso ${Math.abs(d)}d` : d === 0 ? 'Hoy' : d + 'd'}
                  </span>
                  <button className="btn sm" style={{ background: 'var(--cgx)', color: 'var(--cg)', borderColor: 'var(--cgl)' }}
                    onClick={() => abrirMarcar(p)}>
                    <i className="ti ti-check"></i> Marcar hecha
                  </button>
                  <button className="btn sm dg" style={{ marginLeft: 4 }} onClick={() => eliminar(p.id)}>
                    <i className="ti ti-trash"></i>
                  </button>
                </div>
              )
            })
      )}

      {tab === 'done' && (
        !hechas.length
          ? <div className="empty"><i className="ti ti-check"></i><p>Sin completadas</p></div>
          : hechas.map(p => (
              <div className="pi fut" key={p.id} style={{ opacity: .7 }}>
                <div className="pi-date">{fmtFecha(p.fecha)}</div>
                <div className="pi-info">
                  <strong>{TIPOS_ACT[p.tipo]?.label}{p.num_aplicacion ? ` #${p.num_aplicacion}` : ''}{p.producto ? ' — ' + p.producto : ''}</strong>
                  <span>{p.areas?.denom}</span>
                </div>
                <span className="badge badge-ok">Completada</span>
                <button className="btn sm dg" style={{ marginLeft: 8 }} onClick={() => eliminar(p.id)}>
                  <i className="ti ti-trash"></i>
                </button>
              </div>
            ))
      )}

      {marcar && (
        <Modal title={`Completar: ${TIPOS_ACT[marcar.tipo]?.label}${marcar.num_aplicacion ? ' #' + marcar.num_aplicacion : ''}`} onClose={() => setMarcar(null)}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
            {marcar.areas && <RanchoChip r={marcar.areas.rancho} />}
            <span className="badge badge-info">{fmtFecha(marcar.fecha)}</span>
            {marcar.areas && <span className="badge badge-ok">{marcar.areas.sup} ha</span>}
          </div>

          {marcar.tipo === 'riego' ? (
            <>
              <div className="sdiv">Datos del riego</div>
              <div className="fr c4">
                <div className="fg"><label>Fecha inicio</label>
                  <input type="date" value={form.fecha_ef || ''} onChange={e => setForm({ ...form, fecha_ef: e.target.value })} /></div>
                <div className="fg"><label>Hora inicio</label>
                  <input type="time" value={form.hi || ''} onChange={e => setForm({ ...form, hi: e.target.value })} /></div>
                <div className="fg"><label>Fecha fin</label>
                  <input type="date" value={form.fecha_fin || ''} onChange={e => setForm({ ...form, fecha_fin: e.target.value })} /></div>
                <div className="fg"><label>Hora fin</label>
                  <input type="time" value={form.hf || ''} onChange={e => setForm({ ...form, hf: e.target.value })} /></div>
              </div>
              <div className="fr c3">
                <div className="fg"><label>Horas calculadas</label>
                  <input readOnly value={horasCalc != null ? horasCalc + ' h' : ''} /></div>
                <div className="fg"><label>Lámina / Volumen</label>
                  <input type="text" value={form.lamina || ''} onChange={e => setForm({ ...form, lamina: e.target.value })} placeholder="mm o m³/ha" /></div>
                <div className="fg"><label>Método</label>
                  <input type="text" value={form.metodo || ''} onChange={e => setForm({ ...form, metodo: e.target.value })} /></div>
              </div>
              {esPC && (
                <div className="fr c3">
                  <div className="fg"><label>Velocidad pivote (%)</label>
                    <input type="number" value={form.vel || ''} onChange={e => setForm({ ...form, vel: e.target.value })} /></div>
                  <div className="fg"><label>Presión inicial</label>
                    <input type="number" value={form.pi || ''} onChange={e => setForm({ ...form, pi: e.target.value })} step="0.01" /></div>
                  <div className="fg"><label>Presión final</label>
                    <input type="number" value={form.pf || ''} onChange={e => setForm({ ...form, pf: e.target.value })} step="0.01" /></div>
                </div>
              )}
              {horaAlert && (
                <div className={`al ${horaAlert.diff < 0 ? 'red' : 'info'}`}>
                  <i className="ti ti-alert-triangle"></i>
                  Programadas: {marcar.horas_prog}h — Regadas: {horaAlert.hrs}h — Diferencia: {horaAlert.diff > 0 ? '+' : ''}{horaAlert.diff.toFixed(1)}h
                  {horaAlert.diff < 0 ? ' ⚠ Riego incompleto' : ''}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="sdiv">Datos de la aplicación</div>
              <div className="fr c3">
                <div className="fg"><label>Producto</label>
                  <select value={form.prodId || ''} onChange={e => {
                    const prod = prods.find(p => p.id === e.target.value)
                    setForm({ ...form, prodId: e.target.value, producto: prod?.nombre || '' })
                  }}>
                    <option value="">— Selecciona —</option>
                    {prods.filter(p => p.categoria === marcar.tipo).map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} (${fmx(p.precio, 2)}/{p.unidad})</option>
                    ))}
                  </select>
                </div>
                <div className="fg"><label>Dosis (por ha)</label>
                  <input type="number" value={form.dosis || ''} onChange={e => setForm({ ...form, dosis: e.target.value })} step="0.01" /></div>
                <div className="fg"><label>Costo calculado ($)</label>
                  <input readOnly value={costoAuto > 0 ? '$' + fmx(costoAuto, 2) : ''} placeholder="Selecciona producto y dosis"
                    style={{ background: costoAuto > 0 ? 'var(--cgx)' : undefined, fontWeight: costoAuto > 0 ? 600 : undefined }} /></div>
              </div>
              {costoAuto > 0 && marcar.areas && (
                <div className="al ok"><i className="ti ti-calculator"></i>
                  Costo calculado: precio × {form.dosis}/ha × {marcar.areas.sup} ha = <strong>${fmx(costoAuto, 2)}</strong>
                </div>
              )}
            </>
          )}

          <div className="fr c2" style={{ marginTop: 8 }}>
            <div className="fg"><label>Método</label>
              <input type="text" value={form.metodo || ''} onChange={e => setForm({ ...form, metodo: e.target.value })} /></div>
            <div className="fg"><label>Notas</label>
              <input type="text" value={form.obs || ''} onChange={e => setForm({ ...form, obs: e.target.value })} /></div>
          </div>
          <div className="fg" style={{ marginTop: 8 }}><label>Fecha efectiva</label>
            <input type="date" value={form.fecha_ef || ''} onChange={e => setForm({ ...form, fecha_ef: e.target.value })} /></div>

          <div className="br-row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setMarcar(null)}>Cancelar</button>
            <button className="btn pr" onClick={confirmarTarea}><i className="ti ti-check"></i> Confirmar y guardar</button>
          </div>
        </Modal>
      )}
    </>
  )
}
