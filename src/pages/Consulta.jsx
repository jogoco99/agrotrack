import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { RanchoChip, TipoChip, IvBadge, ActBadge, Spinner, fmx, fmtFecha, today } from '../components/UI'
import { RANCHOS, CULTIVOS, TEMPORADAS, ROLES_VEN_COSTOS } from '../lib/constants'

export default function Consulta() {
  const { perfil } = useAuth()
  const verCostos = ROLES_VEN_COSTOS.includes(perfil?.rol)

  const [areas,   setAreas]   = useState([])
  const [loading, setLoading] = useState(true)
  const [fR,      setFR]      = useState('')
  const [fC,      setFC]      = useState('')   // cultivo
  const [fTm,     setFTm]     = useState('')   // temporada
  const [fA,      setFA]      = useState('')   // año siembra
  const [selId,   setSelId]   = useState('')
  const [ficha,   setFicha]   = useState(null)
  const [fichaLoading, setFichaLoading] = useState(false)

  useEffect(() => {
    sb.from('areas').select('*').eq('activa', true).order('rancho').order('tipo').order('denom')
      .then(({ data }) => { setAreas(data || []); setLoading(false) })
  }, [])

  async function loadFicha(id) {
    if (!id) { setFicha(null); return }
    setFichaLoading(true)
    const [{ data: area }, { data: acts }, { data: riev }, { data: cosechas }] = await Promise.all([
      sb.from('areas').select('*').eq('id', id).single(),
      sb.from('actividades').select('*').eq('area_id', id).order('fecha', { ascending: false }),
      sb.from('v_intervalo_riego').select('*').eq('id', id).maybeSingle(),
      sb.from('cosechas').select('*').eq('area_id', id).order('fecha', { ascending: false }),
    ])
    setFicha({ area, acts: acts || [], interval: riev, cosechas: cosechas || [] })
    setFichaLoading(false)
  }

  if (loading) return <Spinner />

  // Años disponibles de siembra
  const aniosSiembra = [...new Set(areas.map(a => a.siembra?.split('-')[0]).filter(Boolean))].sort((a,b) => b-a)

  // Filtrar áreas
  let areasF = areas
  if (fR)  areasF = areasF.filter(a => a.rancho === fR)
  if (fC)  areasF = areasF.filter(a => a.cultivo === fC)
  if (fTm) areasF = areasF.filter(a => a.temporada === fTm)
  if (fA)  areasF = areasF.filter(a => a.siembra?.startsWith(fA))

  const limpiar = () => { setFR(''); setFC(''); setFTm(''); setFA(''); setSelId(''); setFicha(null) }

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ct"><i className="ti ti-filter"></i>Filtrar áreas</div>
        <div style={{ display:'flex', gap: 10, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div className="fg" style={{ minWidth: 120 }}><label>Cultivo</label>
            <select value={fC} onChange={e => { setFC(e.target.value); setSelId(''); setFicha(null) }}>
              <option value="">Todos</option>
              {CULTIVOS.map(c => <option key={c}>{c}</option>)}
            </select></div>
          <div className="fg" style={{ minWidth: 120 }}><label>Temporada</label>
            <select value={fTm} onChange={e => { setFTm(e.target.value); setSelId(''); setFicha(null) }}>
              <option value="">Todas</option>
              {TEMPORADAS.map(t => <option key={t}>{t}</option>)}
            </select></div>
          <div className="fg" style={{ minWidth: 90 }}><label>Año siembra</label>
            <select value={fA} onChange={e => { setFA(e.target.value); setSelId(''); setFicha(null) }}>
              <option value="">Todos</option>
              {aniosSiembra.map(a => <option key={a}>{a}</option>)}
            </select></div>
          <div className="fg" style={{ minWidth: 120 }}><label>Rancho</label>
            <select value={fR} onChange={e => { setFR(e.target.value); setSelId(''); setFicha(null) }}>
              <option value="">Todos</option>
              {Object.entries(RANCHOS).map(([k,r]) => <option key={k} value={k}>{r.nombre}</option>)}
            </select></div>
          <button className="btn sm" onClick={limpiar}><i className="ti ti-x"></i> Limpiar</button>
        </div>

        {/* Chips de filtros activos */}
        {(fC||fTm||fA||fR) && (
          <div style={{ marginTop: 10, display:'flex', gap: 6, flexWrap:'wrap', alignItems:'center' }}>
            {fC  && <span className="badge badge-ok">🌱 {fC}</span>}
            {fTm && <span className="badge badge-info">📅 {fTm}</span>}
            {fA  && <span className="badge badge-warn">📆 {fA}</span>}
            {fR  && <span className="badge badge-info">{RANCHOS[fR]?.nombre}</span>}
            <span style={{ fontSize: 11, color:'var(--cs)' }}>{areasF.length} área{areasF.length!==1?'s':''}</span>
          </div>
        )}
      </div>

      {/* Selector de área */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ct"><i className="ti ti-id-badge"></i>Seleccionar área ({areasF.length})</div>
        <div className="fg">
          <label>Área</label>
          <select value={selId} onChange={e => { setSelId(e.target.value); loadFicha(e.target.value) }}>
            <option value="">— Selecciona —</option>
            {areasF.map(a => (
              <option key={a.id} value={a.id}>
                {RANCHOS[a.rancho]?.nombre} · {a.tipo} {a.denom}
                {a.variedad   ? ' — ' + a.variedad   : ''}
                {a.cultivo    ? ' | ' + a.cultivo     : ''}
                {a.temporada  ? ' ' + a.temporada     : ''}
                {a.siembra    ? ' (' + a.siembra.split('-')[0] + ')' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {fichaLoading && <Spinner />}
      {ficha && !fichaLoading && <FichaArea ficha={ficha} verCostos={verCostos} />}
      {!selId && !fichaLoading && (
        <div className="empty"><i className="ti ti-id-badge"></i>
          <p>Usa los filtros para encontrar el área y selecciónala</p>
        </div>
      )}
    </>
  )
}

function FichaArea({ ficha, verCostos }) {
  const { area, acts, interval, cosechas } = ficha
  const [tab, setTab] = useState('riegos')

  const riegos  = acts.filter(a => a.tipo === 'riego')
  const fertes  = acts.filter(a => a.tipo === 'fertilizante')
  const herbs   = acts.filter(a => a.tipo === 'herbicida')
  const insect  = acts.filter(a => a.tipo === 'insecticida')
  const costoTotal   = acts.reduce((s,a) => s + (+a.costo||0), 0)
  const diasSiembra  = area.siembra ? Math.round((new Date(today()) - new Date(area.siembra)) / 864e5) : null
  const ingTotalCos  = cosechas.reduce((s,c) => s + (+c.ingresos||0), 0)
  const costTotalCos = cosechas.reduce((s,c) => s + (+c.costo_total||0), 0)

  return (
    <div className="card">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom: 12, flexWrap:'wrap', gap: 8 }}>
        <div>
          <h3 style={{ fontFamily:'Playfair Display,serif', fontSize: 17, marginBottom: 6 }}>
            {RANCHOS[area.rancho]?.nombre} — {area.tipo} {area.denom}
          </h3>
          <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
            <RanchoChip r={area.rancho} />
            <TipoChip t={area.tipo} />
            {area.cultivo   && <span className="badge badge-info">{area.cultivo}</span>}
            {area.temporada && <span className="badge badge-ok">{area.temporada}</span>}
            {area.siembra   && <span className="badge badge-warn">{area.siembra.split('-')[0]}</span>}
            {area.perene    && <span className="badge badge-ok">Perene</span>}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize: 11, color:'var(--cs)' }}>Superficie</div>
          <div style={{ fontSize: 22, fontWeight: 500, fontFamily:'IBM Plex Mono' }}>{area.sup} ha</div>
        </div>
      </div>

      {/* Métricas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginBottom: 12 }}>
        {[
          ['Variedad',      area.variedad  || '—'],
          ['Fecha siembra', fmtFecha(area.siembra)],
          ['Año siembra',   area.siembra?.split('-')[0] || '—'],
          ['Días en campo', diasSiembra != null ? diasSiembra : '—'],
          ['Temporada',     area.temporada || '—'],
          ['Último riego',  interval?.ultimo_riego ? fmtFecha(interval.ultimo_riego) : '—'],
          ...(verCostos ? [
            ['Costo acum.',   '$' + fmx(costoTotal)],
            ['Costo/ha',      '$' + fmx(area.sup > 0 ? costoTotal / area.sup : 0, 0)],
          ] : []),
        ].map(([l,v]) => (
          <div key={l} style={{ background:'var(--cc)', borderRadius:'var(--r)', padding:'8px 10px' }}>
            <div style={{ fontSize: 10, color:'var(--cs)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom: 2 }}>{l}</div>
            <div style={{ fontSize: 14, fontWeight: 500, fontFamily:'IBM Plex Mono' }}>{v}</div>
          </div>
        ))}
        <div style={{ background:'var(--cc)', borderRadius:'var(--r)', padding:'8px 10px' }}>
          <div style={{ fontSize: 10, color:'var(--cs)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom: 4 }}>Estado riego</div>
          <IvBadge n={interval?.dias_sin_riego} />
        </div>
      </div>

      {/* Resumen cosechas/cortes */}
      {cosechas.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="sdiv">
            {area.perene ? `Cortes registrados (${cosechas.length})` : `Cosechas (${cosechas.length})`}
          </div>
          <div className="tw"><table><thead><tr>
            <th>{area.perene ? 'Corte' : 'Cosecha'}</th>
            <th>Fecha</th><th>t/ha</th><th>MS%</th>
            {verCostos && <><th>Ingresos</th><th>Costo</th><th>Utilidad</th><th>$/ha</th><th>$/kg MS</th></>}
          </tr></thead><tbody>
          {cosechas.map((c, i) => (
            <tr key={c.id}>
              <td>{area.perene
                ? <span className="badge badge-info">Corte #{c.num_corte || i+1}</span>
                : <span className="badge badge-ok">#{i+1}</span>}
              </td>
              <td style={{ fontFamily:'IBM Plex Mono', fontSize: 11 }}>{fmtFecha(c.fecha)}</td>
              <td style={{ fontFamily:'IBM Plex Mono' }}>{c.rendimiento}</td>
              <td>{c.ms_pct || '—'}%</td>
              {verCostos && <>
                <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(c.ingresos)}</td>
                <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(c.costo_total)}</td>
                <td style={{ fontFamily:'IBM Plex Mono', color: c.utilidad>=0?'var(--cg)':'var(--cr)' }}>${fmx(c.utilidad)}</td>
                <td style={{ fontFamily:'IBM Plex Mono', fontSize: 11 }}>${fmx(c.costo_ha,0)}</td>
                <td style={{ fontFamily:'IBM Plex Mono', fontSize: 11 }}>${fmx(c.costo_kg_ms,4)}</td>
              </>}
            </tr>
          ))}
          {verCostos && cosechas.length > 1 && (
            <tr style={{ background:'var(--cgx)', fontWeight: 600 }}>
              <td colSpan={4}>TOTAL ACUMULADO</td>
              <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(ingTotalCos)}</td>
              <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(costTotalCos)}</td>
              <td style={{ fontFamily:'IBM Plex Mono', color: ingTotalCos-costTotalCos>=0?'var(--cg)':'var(--cr)' }}>${fmx(ingTotalCos-costTotalCos)}</td>
              <td colSpan={2}></td>
            </tr>
          )}
          </tbody></table></div>
        </div>
      )}

      {/* Tabs historial de actividades */}
      <div className="tabs" style={{ marginTop: 6 }}>
        {[
          ['riegos',  `💧 Riegos (${riegos.length})`],
          ['fert',    `🌱 Fert. (${fertes.length})`],
          ['herb',    `🌿 Herb. (${herbs.length})`],
          ['ins',     `🐛 Insect. (${insect.length})`],
        ].map(([id, lbl]) => (
          <button key={id} className={`tabb ${tab===id?'active':''}`} onClick={() => setTab(id)}>{lbl}</button>
        ))}
      </div>

      {tab === 'riegos' && <TablaRiegos acts={riegos} />}
      {tab === 'fert'   && <TablaActs   acts={fertes}  verCostos={verCostos} />}
      {tab === 'herb'   && <TablaActs   acts={herbs}   verCostos={verCostos} />}
      {tab === 'ins'    && <TablaActs   acts={insect}  verCostos={verCostos} />}
    </div>
  )
}

function TablaRiegos({ acts }) {
  if (!acts.length) return <div className="empty"><p>Sin riegos registrados</p></div>
  return (
    <div className="tw"><table><thead><tr>
      <th>Fecha</th><th>Hrs regadas</th><th>Hrs prog.</th><th>Cumplimiento</th>
      <th>Lámina</th><th>Método</th><th>Vel. pivote</th><th>P.ini</th><th>P.fin</th>
    </tr></thead><tbody>
    {acts.map(a => (
      <tr key={a.id}>
        <td style={{ fontFamily:'IBM Plex Mono', fontSize: 11 }}>{fmtFecha(a.fecha)}</td>
        <td style={{ fontFamily:'IBM Plex Mono' }}>{a.horas_regadas || '—'}</td>
        <td style={{ fontFamily:'IBM Plex Mono' }}>{a.horas_prog    || '—'}</td>
        <td>{a.cumplimiento != null
          ? <span className={`badge ${a.cumplimiento<80?'badge-red':a.cumplimiento<95?'badge-warn':'badge-ok'}`}>{a.cumplimiento}%</span>
          : '—'}</td>
        <td>{a.lamina            || '—'}</td>
        <td>{a.metodo            || '—'}</td>
        <td>{a.velocidad_pivote  != null ? a.velocidad_pivote + '%' : '—'}</td>
        <td>{a.presion_inicial   || '—'}</td>
        <td>{a.presion_final     || '—'}</td>
      </tr>
    ))}
    </tbody></table></div>
  )
}

function TablaActs({ acts, verCostos }) {
  if (!acts.length) return <div className="empty"><p>Sin registros</p></div>
  return (
    <div className="tw"><table><thead><tr>
      <th>Fecha</th><th>Producto</th><th>Dosis</th><th>Método</th>
      {verCostos && <th>Costo</th>}
      <th>Notas</th>
    </tr></thead><tbody>
    {acts.map(a => (
      <tr key={a.id}>
        <td style={{ fontFamily:'IBM Plex Mono', fontSize: 11 }}>{fmtFecha(a.fecha)}</td>
        <td>{a.detalle || '—'}</td>
        <td>{a.dosis   || '—'}</td>
        <td>{a.metodo  || '—'}</td>
        {verCostos && <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(a.costo)}</td>}
        <td style={{ fontSize: 11, color:'var(--ct)' }}>{a.notas || '—'}</td>
      </tr>
    ))}
    </tbody></table></div>
  )
}
