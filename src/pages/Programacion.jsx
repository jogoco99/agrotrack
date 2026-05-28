import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { RanchoChip, ActBadge, toast, Spinner, fmx, fmtFecha, today, daysFrom } from '../components/UI'
import { RANCHOS, TIPOS_ACT } from '../lib/constants'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function Programacion() {
  const [progs,  setProgs]  = useState([])
  const [areas,  setAreas]  = useState([])
  const [prods,  setProds]  = useState([])
  const [loading,setLoading]= useState(true)
  const [tab,    setTab]    = useState('cal')
  const [calY,   setCalY]   = useState(new Date().getFullYear())
  const [calM,   setCalM]   = useState(new Date().getMonth())
  // Multi-producto
  const [productos, setProductos] = useState([{ prodId:'', dosis:'', nombre:'' }])
  const [form, setForm] = useState({
    rancho:'', areaId:'', tipo:'', horasProg:'', notas:'',
    fi: today(), cada:'0', n:'1', numAplicacion:''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [{ data: p }, { data: a }, { data: pr }] = await Promise.all([
      sb.from('programas').select('*, areas(rancho,tipo,denom)').eq('completado', false).order('fecha'),
      sb.from('areas').select('*').eq('activa', true),
      sb.from('productos').select('*').eq('activo', true),
    ])
    setProgs(p || []); setAreas(a || []); setProds(pr || [])
    setLoading(false)
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  const areasR = areas.filter(a => a.rancho === form.rancho)
  const selArea = areas.find(a => a.id === form.areaId)

  // Calcular cantidad total necesaria
  function calcNecesario(idx) {
    const p = productos[idx]
    if (!p.dosis || !selArea?.sup) return null
    const total = parseFloat(p.dosis) * selArea.sup
    const prod = prods.find(x => x.id === p.prodId)
    if (!prod) return `${fmx(total, 1)} (dosis × ha)`
    if (prod.semillas_saco && prod.categoria === 'semilla') {
      const sacos = Math.ceil(total / prod.semillas_saco)
      return `${fmx(total, 0)} semillas → ${sacos} saco${sacos !== 1 ? 's' : ''}`
    }
    return `${fmx(total, 2)} ${prod.unidad}`
  }

  function addProducto() { setProductos(p => [...p, { prodId:'', dosis:'', nombre:'' }]) }
  function remProducto(i) { setProductos(p => p.filter((_, idx) => idx !== i)) }
  function setP(i, k, v) { setProductos(p => p.map((x, idx) => idx === i ? { ...x, [k]: v } : x)) }

  async function saveMasa() {
    if (!form.areaId || !form.tipo || !form.fi) { toast('Completa área, tipo y fecha', false); return }
    setSaving(true)
    const cada = parseInt(form.cada) || 0
    const n    = parseInt(form.n) || 1
    const total = cada > 0 ? n : 1
    const rows = []
    for (let i = 0; i < total; i++) {
      const d = new Date(form.fi); d.setDate(d.getDate() + i * cada)
      const numApp = form.numAplicacion ? parseInt(form.numAplicacion) + i : (i + 1)
      // one row per producto
      if (form.tipo !== 'riego' && productos.some(p => p.dosis)) {
        for (const prod of productos) {
          if (!prod.dosis) continue
          const prodObj = prods.find(x => x.id === prod.prodId)
          rows.push({
            area_id: form.areaId, tipo: form.tipo,
            fecha: d.toISOString().split('T')[0],
            producto: prodObj?.nombre || prod.nombre || null,
            dosis: prod.dosis || null,
            num_aplicacion: numApp,
            horas_prog: form.horasProg ? parseFloat(form.horasProg) : null,
            notas: form.notas || null,
          })
        }
      } else {
        rows.push({
          area_id: form.areaId, tipo: form.tipo,
          fecha: d.toISOString().split('T')[0],
          producto: null, dosis: null,
          num_aplicacion: numApp,
          horas_prog: form.horasProg ? parseFloat(form.horasProg) : null,
          notas: form.notas || null,
        })
      }
    }
    const { error } = await sb.from('programas').insert(rows)
    setSaving(false)
    if (error) { toast('Error: ' + error.message, false); return }
    toast(`${rows.length} evento${rows.length > 1 ? 's' : ''} programado${rows.length > 1 ? 's' : ''}`)
    setProductos([{ prodId:'', dosis:'', nombre:'' }])
    load()
  }

  async function del(id) { await sb.from('programas').delete().eq('id', id); load() }

  if (loading) return <Spinner />

  const firstDay = new Date(calY, calM, 1).getDay()
  const lastDay  = new Date(calY, calM + 1, 0).getDate()
  const cells = []; for (let i = 0; i < firstDay; i++) cells.push(null); for (let d = 1; d <= lastDay; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <>
      <div className="tabs">
        {[['cal','Calendario'],['masa','Programar'],['lista','Lista']].map(([id, lbl]) => (
          <button key={id} className={`tabb ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{lbl}</button>
        ))}
      </div>

      {tab === 'cal' && (
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12, flexWrap:'wrap', gap: 8 }}>
            <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
              <button className="btn sm" onClick={() => { let m=calM-1,y=calY; if(m<0){m=11;y--} setCalM(m);setCalY(y) }}><i className="ti ti-chevron-left"></i></button>
              <strong style={{ fontFamily:'Playfair Display,serif', fontSize: 15 }}>{MESES[calM]} {calY}</strong>
              <button className="btn sm" onClick={() => { let m=calM+1,y=calY; if(m>11){m=0;y++} setCalM(m);setCalY(y) }}><i className="ti ti-chevron-right"></i></button>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap: 3, marginBottom: 4 }}>
            {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => <div key={d} className="cal-dh">{d}</div>)}
          </div>
          {Array.from({ length: Math.ceil(cells.length/7) }, (_, w) => (
            <div key={w} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap: 3, marginBottom: 3 }}>
              {cells.slice(w*7, w*7+7).map((day, i) => {
                if (!day) return <div key={i} className="cal-day other-month"></div>
                const ds = `${calY}-${String(calM+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                const evs = progs.filter(p => p.fecha === ds)
                return (
                  <div key={i} className={`cal-day ${ds === today() ? 'today' : ''}`}>
                    <div className="cal-dn">{day}</div>
                    {evs.map(e => (
                      <div key={e.id} className={`cal-ev ${e.tipo}`} title={`${TIPOS_ACT[e.tipo]?.label}${e.num_aplicacion ? ' #'+e.num_aplicacion : ''} · ${e.areas?.denom||''}`}>
                        {e.tipo==='riego'?'💧':e.tipo==='fertilizante'?'🌱':e.tipo==='herbicida'?'🌿':'🐛'}
                        {e.num_aplicacion ? ` #${e.num_aplicacion}` : ''} {e.areas?.denom||''}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {tab === 'masa' && (
        <div className="card">
          <div className="ct"><i className="ti ti-calendar-plus"></i>Programar actividad</div>
          <div className="fr c3">
            <div className="fg"><label>Rancho</label>
              <select value={form.rancho} onChange={e => { set('rancho', e.target.value); set('areaId', '') }}>
                <option value="">— Rancho —</option>
                {Object.entries(RANCHOS).map(([k,r]) => <option key={k} value={k}>{r.nombre}</option>)}
              </select></div>
            <div className="fg"><label>Área</label>
              <select value={form.areaId} onChange={e => set('areaId', e.target.value)}>
                <option value="">— Área —</option>
                {areasR.map(a => <option key={a.id} value={a.id}>{a.tipo} {a.denom}{a.variedad?' — '+a.variedad:''}</option>)}
              </select></div>
            <div className="fg"><label>Tipo</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                <option value="">— Tipo —</option>
                {Object.entries(TIPOS_ACT).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select></div>
          </div>

          {/* Productos múltiples */}
          {form.tipo && form.tipo !== 'riego' && (
            <>
              <div className="sdiv">Productos a aplicar</div>
              {productos.map((p, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems:'flex-end' }}>
                  <div className="fg"><label>Producto {i+1}</label>
                    <select value={p.prodId} onChange={e => setP(i, 'prodId', e.target.value)}>
                      <option value="">— Producto —</option>
                      {prods.filter(x => x.categoria === form.tipo).map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                    </select></div>
                  <div className="fg"><label>Dosis (por ha)</label>
                    <input type="number" value={p.dosis} onChange={e => setP(i, 'dosis', e.target.value)} step="0.01" /></div>
                  <div className="fg"><label>Necesario total</label>
                    <input readOnly value={calcNecesario(i) || ''} placeholder="Selecciona producto y dosis" /></div>
                  {i > 0 && <button className="btn sm dg" onClick={() => remProducto(i)} style={{ marginBottom: 2 }}><i className="ti ti-trash"></i></button>}
                </div>
              ))}
              <button className="btn sm" onClick={addProducto}><i className="ti ti-plus"></i> Agregar otro producto</button>
            </>
          )}

          {form.tipo === 'riego' && (
            <div className="fg" style={{ maxWidth: 200, marginTop: 8 }}><label>Horas programadas</label>
              <input type="number" value={form.horasProg} onChange={e => set('horasProg', e.target.value)} placeholder="10" step="0.5" /></div>
          )}

          <div className="sdiv">Calendario</div>
          <div className="fr c4">
            <div className="fg"><label>Fecha inicio</label>
              <input type="date" value={form.fi} onChange={e => set('fi', e.target.value)} /></div>
            <div className="fg"><label>Repetir cada (días)</label>
              <input type="number" value={form.cada} onChange={e => set('cada', e.target.value)} min="0" max="365" placeholder="0 = sin repetición" /></div>
            <div className="fg"><label>Número de eventos</label>
              <input type="number" value={form.n} onChange={e => set('n', e.target.value)} min="1" max="60" /></div>
            <div className="fg"><label>Núm. aplicación inicio</label>
              <input type="number" value={form.numAplicacion} onChange={e => set('numAplicacion', e.target.value)} placeholder="1" min="1" /></div>
          </div>
          <div className="fg" style={{ marginBottom: 10 }}><label>Notas</label>
            <input value={form.notas} onChange={e => set('notas', e.target.value)} /></div>

          {/* Preview */}
          {form.fi && parseInt(form.n) > 0 && (
            <div className="al info"><i className="ti ti-calendar"></i>
              Se generarán <strong>{form.cada > 0 ? form.n : 1}</strong> evento{parseInt(form.n)>1?'s':''},
              {form.cada > 0 ? ` cada ${form.cada} días a partir del ` : ' el '}
              <strong>{fmtFecha(form.fi)}</strong>
              {selArea && <>, área <strong>{selArea.tipo} {selArea.denom}</strong> ({selArea.sup} ha)</>}
            </div>
          )}

          <div className="br-row">
            <button className="btn pr" onClick={saveMasa} disabled={saving}>
              {saving ? <><i className="ti ti-loader"></i> Guardando…</> : <><i className="ti ti-calendar-plus"></i> Agregar al calendario</>}
            </button>
          </div>
        </div>
      )}

      {tab === 'lista' && (
        <div className="card">
          <div className="ct"><i className="ti ti-list-check"></i>Eventos pendientes ({progs.length})</div>
          {!progs.length
            ? <div className="empty"><i className="ti ti-calendar"></i><p>Sin eventos</p></div>
            : <div className="tw"><table><thead><tr>
                <th>Fecha</th><th>Rancho</th><th>Área</th><th>Tipo</th><th># Aplic.</th><th>Producto</th><th>Dosis</th><th>Necesario</th><th>Estado</th><th></th>
              </tr></thead><tbody>
              {progs.map(p => {
                const d = daysFrom(p.fecha)
                return (
                  <tr key={p.id}>
                    <td style={{ fontFamily:'IBM Plex Mono', fontSize: 11 }}>{fmtFecha(p.fecha)}</td>
                    <td>{p.areas ? <RanchoChip r={p.areas.rancho} /> : '—'}</td>
                    <td>{p.areas?.denom || '—'}</td>
                    <td><ActBadge tipo={p.tipo} /></td>
                    <td style={{ textAlign:'center', fontWeight: 600 }}>{p.num_aplicacion || '—'}</td>
                    <td>{p.producto || '—'}</td>
                    <td style={{ fontSize: 11 }}>{p.dosis || '—'}</td>
                    <td style={{ fontSize: 11, color:'var(--cg)' }}>
                      {p.dosis && p.areas ? (() => {
                        const area = areas.find(a => a.id === p.area_id)
                        if (!area) return '—'
                        return fmx(parseFloat(p.dosis) * area.sup, 2)
                      })() : '—'}
                    </td>
                    <td><span className={`badge ${d<0?'badge-red':d===0?'badge-warn':'badge-info'}`}>{d<0?'Atraso':d===0?'Hoy':d+'d'}</span></td>
                    <td><button className="btn sm dg" onClick={() => del(p.id)}><i className="ti ti-trash"></i></button></td>
                  </tr>
                )
              })}
              </tbody></table></div>}
        </div>
      )}
    </>
  )
}
