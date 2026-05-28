import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { RanchoChip, TipoChip, Spinner, fmx, fmtFecha, MetBig } from '../components/UI'
import { RANCHOS, CULTIVOS, TEMPORADAS, ROLES_VEN_COSTOS } from '../lib/constants'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Legend, Tooltip } from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, Tooltip)

const TABS_CULTIVO = ['Maíz', 'Triticale', 'Alfalfa']

export default function Rentabilidad() {
  const { perfil } = useAuth()
  const verCostos = ROLES_VEN_COSTOS.includes(perfil?.rol)

  const [cosechas, setCosechas] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [cultivo,  setCultivo]  = useState('Maíz')
  const [fR,  setFR]  = useState('')
  const [fT,  setFT]  = useState('')
  const [fV,  setFV]  = useState('')
  const [fTm, setFTm] = useState('')
  const [fA,  setFA]  = useState('')
  // Para alfalfa: ver por corte o acumulado
  const [alfalfaVista, setAlfalfaVista] = useState('corte') // 'corte' | 'acumulado'

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data } = await sb.from('cosechas')
      .select('*, areas(rancho,tipo,denom,variedad,sup,cultivo,temporada,siembra)')
      .order('fecha', { ascending: false })
    setCosechas(data || [])
    setLoading(false)
  }

  if (loading) return <Spinner />

  // Filtrar por cultivo activo primero
  let base = cosechas.filter(c => c.areas?.cultivo === cultivo)

  const vars  = [...new Set(base.map(c => c.areas?.variedad || '').filter(Boolean))]
  const tipos = [...new Set(base.map(c => c.areas?.tipo     || '').filter(Boolean))]
  const anios = [...new Set(base.map(c => c.fecha?.split('-')[0] || '').filter(Boolean))].sort((a,b) => b-a)

  let fil = base
  if (fR)  fil = fil.filter(c => c.areas?.rancho    === fR)
  if (fT)  fil = fil.filter(c => c.areas?.tipo      === fT)
  if (fV)  fil = fil.filter(c => c.areas?.variedad  === fV)
  if (fTm) fil = fil.filter(c => c.areas?.temporada === fTm)
  if (fA)  fil = fil.filter(c => c.fecha?.startsWith(fA))

  // Ordenar de más rentable (menor $/kg húmedo) a menos rentable
  fil = [...fil].sort((a, b) => (+a.costo_kg_humedo || 0) - (+b.costo_kg_humedo || 0))

  const totI   = fil.reduce((s,c) => s + (+c.ingresos    || 0), 0)
  const totC   = fil.reduce((s,c) => s + (+c.costo_total || 0), 0)
  const totU   = totI - totC
  const roi    = totC > 0 ? totU / totC * 100 : 0
  const avgKH  = fil.length ? fil.reduce((s,c) => s + (+c.costo_kg_humedo || 0), 0) / fil.length : 0
  const avgKMS = fil.length ? fil.reduce((s,c) => s + (+c.costo_kg_ms     || 0), 0) / fil.length : 0
  const avgHA  = fil.length ? fil.reduce((s,c) => s + (+c.costo_ha        || 0), 0) / fil.length : 0

  // Comparativa por año/temporada
  const grupos = {}
  fil.forEach(c => {
    const anio = c.fecha?.split('-')[0] || '?'
    const temp = c.areas?.temporada || 'Sin temporada'
    const key  = `${anio} — ${temp}`
    if (!grupos[key]) grupos[key] = { anio, temp, cosechas:[], totI:0, totC:0, totU:0, rends:[] }
    grupos[key].cosechas.push(c)
    grupos[key].totI  += +c.ingresos    || 0
    grupos[key].totC  += +c.costo_total || 0
    grupos[key].totU  += (+c.ingresos || 0) - (+c.costo_total || 0)
    grupos[key].rends.push(+c.rendimiento || 0)
  })
  const gruposArr = Object.entries(grupos).sort((a,b) => b[0].localeCompare(a[0]))

  // Para alfalfa: agrupar por área
  const areasAlfalfa = [...new Set(fil.map(c => c.area_id))]
  const alfalfaAreas = areasAlfalfa.map(aid => {
    const cortes = fil.filter(c => c.area_id === aid).sort((a,b) => a.fecha.localeCompare(b.fecha))
    const area   = cortes[0]?.areas
    return { aid, area, cortes,
      totIng:  cortes.reduce((s,c) => s + (+c.ingresos    || 0), 0),
      totCost: cortes.reduce((s,c) => s + (+c.costo_total || 0), 0),
      totKg:   cortes.reduce((s,c) => s + (+c.kilos_totales || 0), 0),
    }
  })

  const limpiar = () => { setFR(''); setFT(''); setFV(''); setFTm(''); setFA('') }

  return (
    <>
      {/* ── Tabs por cultivo ── */}
      <div className="tabs" style={{ marginBottom: 4 }}>
        {TABS_CULTIVO.map(c => (
          <button key={c} className={`tabb ${cultivo === c ? 'active' : ''}`}
            onClick={() => { setCultivo(c); limpiar() }}>
            {c === 'Maíz' ? '🌽' : c === 'Triticale' ? '🌾' : '🌿'} {c}
            <span style={{ marginLeft: 6, fontSize: 10, opacity: .7 }}>
              ({cosechas.filter(x => x.areas?.cultivo === c).length})
            </span>
          </button>
        ))}
      </div>

      {/* ── Filtros ── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div className="fg" style={{ minWidth:100 }}><label>Temporada</label>
            <select value={fTm} onChange={e => setFTm(e.target.value)}>
              <option value="">Todas</option>
              {TEMPORADAS.map(t => <option key={t}>{t}</option>)}
            </select></div>
          <div className="fg" style={{ minWidth:80 }}><label>Año</label>
            <select value={fA} onChange={e => setFA(e.target.value)}>
              <option value="">Todos</option>
              {anios.map(a => <option key={a}>{a}</option>)}
            </select></div>
          <div className="fg" style={{ minWidth:110 }}><label>Rancho</label>
            <select value={fR} onChange={e => setFR(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(RANCHOS).map(([k,r]) => <option key={k} value={k}>{r.nombre}</option>)}
            </select></div>
          <div className="fg" style={{ minWidth:100 }}><label>Tipo área</label>
            <select value={fT} onChange={e => setFT(e.target.value)}>
              <option value="">Todos</option>
              {tipos.map(t => <option key={t}>{t}</option>)}
            </select></div>
          <div className="fg" style={{ minWidth:110 }}><label>Variedad</label>
            <select value={fV} onChange={e => setFV(e.target.value)}>
              <option value="">Todas</option>
              {vars.map(v => <option key={v}>{v}</option>)}
            </select></div>
          <button className="btn sm" onClick={limpiar}><i className="ti ti-x"></i> Limpiar</button>
        </div>
        {(fTm||fA||fR||fT||fV) && (
          <div style={{ marginTop:10, display:'flex', gap:6, flexWrap:'wrap' }}>
            {fTm && <span className="badge badge-info">📅 {fTm}</span>}
            {fA  && <span className="badge badge-warn">📆 {fA}</span>}
            {fR  && <span className="badge badge-info">{RANCHOS[fR]?.nombre}</span>}
            {fT  && <span className="badge badge-ok">{fT}</span>}
            {fV  && <span className="badge badge-warn">{fV}</span>}
            <span style={{ fontSize:11, color:'var(--cs)', alignSelf:'center' }}>{fil.length} registro{fil.length!==1?'s':''}</span>
          </div>
        )}
      </div>

      {fil.length === 0
        ? <div className="card"><div className="empty"><i className="ti ti-basket-off"></i><p>Sin registros para {cultivo} con los filtros seleccionados</p></div></div>
        : <>
          {/* ── Métricas grandes ── */}
          <div className="g3" style={{ marginBottom: 14 }}>
            <MetBig label="Costo promedio / ha"  value={'$'+fmx(avgHA,0)}  sub={`${fil.length} registros`} color="var(--cb)"  />
            <MetBig label="Costo / kg húmedo"    value={'$'+fmx(avgKH,4)}  sub="promedio"                 color="var(--ca)"  />
            <MetBig label="Costo / kg MS"        value={'$'+fmx(avgKMS,4)} sub="promedio"                 color="var(--cgm)" />
          </div>

          {verCostos && (
            <div className="g4" style={{ marginBottom: 14 }}>
              <div className="met gr"><div className="ml">Ingresos</div><div className="mv">${fmx(totI)}</div></div>
              <div className="met"><div className="ml">Costos</div><div className="mv" style={{ color:'var(--cr)' }}>${fmx(totC)}</div></div>
              <div className={`met ${totU>=0?'gr':'rd'}`}><div className="ml">Utilidad</div><div className="mv">${fmx(totU)}</div></div>
              <div className={`met ${roi>=0?'gr':'rd'}`}><div className="ml">ROI</div><div className="mv">{roi.toFixed(1)}%</div></div>
            </div>
          )}

          {/* ── Vista especial Alfalfa ── */}
          {cultivo === 'Alfalfa' && (
            <>
              <div className="tabs" style={{ marginBottom: 12 }}>
                <button className={`tabb ${alfalfaVista==='corte'?'active':''}`} onClick={()=>setAlfalfaVista('corte')}>Por corte individual</button>
                <button className={`tabb ${alfalfaVista==='acumulado'?'active':''}`} onClick={()=>setAlfalfaVista('acumulado')}>Acumulado por área</button>
              </div>

              {alfalfaVista === 'acumulado' && alfalfaAreas.map(({ aid, area, cortes, totIng, totCost, totKg }) => (
                <div key={aid} className="card" style={{ marginBottom: 12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
                    {area && <RanchoChip r={area.rancho} />}
                    {area && <TipoChip t={area.tipo} />}
                    <strong>{area?.denom}</strong>
                    {area?.variedad && <span className="badge badge-ok">{area.variedad}</span>}
                    <span className="badge badge-info">{cortes.length} cortes</span>
                    <span style={{ fontSize:11, color:'var(--ct)' }}>Siembra: {fmtFecha(area?.siembra)}</span>
                  </div>
                  <div className="g4" style={{ marginBottom:10 }}>
                    <MetBig label="Kg totales" value={fmx(totKg)} color="var(--cb)" />
                    {verCostos && <>
                      <MetBig label="Ingresos" value={'$'+fmx(totIng)} color="var(--cgm)" />
                      <MetBig label="Costo total" value={'$'+fmx(totCost)} color="var(--cr)" />
                      <MetBig label="Utilidad" value={'$'+fmx(totIng-totCost)} color={totIng-totCost>=0?'var(--cgm)':'var(--cr)'} />
                    </>}
                  </div>
                  <div className="tw"><table><thead><tr>
                    <th>Corte</th><th>Fecha</th><th>Kg totales</th><th>t/ha</th><th>MS%</th>
                    {verCostos && <><th>$/ha</th><th>$/kg húmedo</th><th>$/kg MS</th></>}
                  </tr></thead><tbody>
                  {cortes.map((c,i) => (
                    <tr key={c.id}>
                      <td><span className="badge badge-info">#{c.num_corte||i+1}</span></td>
                      <td style={{ fontFamily:'IBM Plex Mono', fontSize:11 }}>{fmtFecha(c.fecha)}</td>
                      <td style={{ fontFamily:'IBM Plex Mono' }}>{fmx(c.kilos_totales||0)}</td>
                      <td style={{ fontFamily:'IBM Plex Mono' }}>{c.rendimiento}</td>
                      <td>{c.ms_pct||'—'}%</td>
                      {verCostos && <>
                        <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(c.costo_ha,0)}</td>
                        <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(c.costo_kg_humedo,4)}</td>
                        <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(c.costo_kg_ms,4)}</td>
                      </>}
                    </tr>
                  ))}
                  {verCostos && <tr style={{ background:'var(--cgx)', fontWeight:600 }}>
                    <td colSpan={5}>Total acumulado</td>
                    <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(cortes.reduce((s,c)=>s+(+c.costo_ha||0),0)/cortes.length,0)} prom.</td>
                    <td colSpan={2}></td>
                  </tr>}
                  </tbody></table></div>
                </div>
              ))}
            </>
          )}

          {/* ── Detalle individual (maíz / triticale / alfalfa por corte) ── */}
          {(cultivo !== 'Alfalfa' || alfalfaVista === 'corte') && fil.map(c => {
            const pos = c.utilidad >= 0
            return (
              <div key={c.id} className={`rent-card ${pos?'pos':'neg'}`}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, flexWrap:'wrap', gap:7 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <i className={`ti ti-${pos?'trending-up':'trending-down'}`} style={{ fontSize:17 }}></i>
                    <strong>{RANCHOS[c.areas?.rancho]?.nombre||'—'} · {c.areas?.tipo} {c.areas?.denom}</strong>
                    {c.areas?.variedad  && <span className="badge badge-ok">{c.areas.variedad}</span>}
                    {c.areas?.temporada && <span className="badge badge-warn">{c.areas.temporada}</span>}
                    {c.num_corte        && <span className="badge badge-info">Corte #{c.num_corte}</span>}
                    <span style={{ fontSize:11, opacity:.7 }}>{fmtFecha(c.fecha)} · {c.fecha?.split('-')[0]}</span>
                  </div>
                  {verCostos && <span className={`badge ${pos?'badge-ok':'badge-red'}`}>{pos?'✓ Rentable':'✗ No rentable'}</span>}
                </div>

                {/* Métricas clave */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:10 }}>
                  {[['$/ha','$'+fmx(c.costo_ha,0),'var(--cb)'],['$/kg húmedo','$'+fmx(c.costo_kg_humedo,4),'var(--ca)'],['$/kg MS','$'+fmx(c.costo_kg_ms,4),'var(--cgm)']].map(([l,v,col]) => (
                    <div key={l} style={{ background:'rgba(255,255,255,.6)', borderRadius:8, padding:'10px 12px', borderLeft:`3px solid ${col}` }}>
                      <div style={{ fontSize:10, color:'var(--cs)', textTransform:'uppercase', marginBottom:3 }}>{l}</div>
                      <div style={{ fontSize:20, fontWeight:600, fontFamily:'IBM Plex Mono', color:col }}>{v}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(85px,1fr))', gap:5 }}>
                  {[
                    ['Ha', c.areas?.sup||0],
                    ['Kg totales', fmx(c.kilos_totales||0)],
                    ['t/ha', c.rendimiento||0],
                    ['MS%', (c.ms_pct||0)+'%'],
                    ...(verCostos ? [
                      ['Precio/ton','$'+fmx(c.precio,2)],
                      ['Ingresos','$'+fmx(c.ingresos)],
                      ['Costo acts.','$'+fmx(c.costo_actividades)],
                      ['Semilla','$'+fmx(c.costo_semilla||0)],
                      ['Cosecha','$'+fmx(c.costo_cosecha)],
                      ['CG prorr.','$'+fmx(c.costos_cg_prorr||0)],
                      ['Costo total','$'+fmx(c.costo_total)],
                      ['Utilidad','$'+fmx(c.utilidad)],
                      ['ROI',(c.roi||0).toFixed(1)+'%'],
                    ] : []),
                  ].map(([l,v]) => (
                    <div key={l} style={{ textAlign:'center', background:'rgba(255,255,255,.5)', borderRadius:6, padding:'5px 3px' }}>
                      <div style={{ fontSize:9, color:pos?'var(--cg)':'var(--cr)', textTransform:'uppercase', marginBottom:2 }}>{l}</div>
                      <div style={{ fontSize:12, fontWeight:500, fontFamily:'IBM Plex Mono', color:pos?'var(--cg)':'var(--cr)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* ── Comparativa año vs año ── */}
          {verCostos && gruposArr.length > 1 && (
            <div className="card" style={{ marginTop:14 }}>
              <div className="ct"><i className="ti ti-calendar-stats"></i>Comparativa año / temporada — {cultivo}</div>
              <div className="tw"><table><thead><tr>
                <th>Año</th><th>Temporada</th><th>Registros</th><th>Rend. prom.</th>
                <th>Ingresos</th><th>Costos</th><th>Utilidad</th><th>$/ha prom.</th>
              </tr></thead><tbody>
              {gruposArr.map(([key, g]) => {
                const avgRend = g.rends.length ? (g.rends.reduce((a,b)=>a+b,0)/g.rends.length).toFixed(2) : '—'
                const avgHaG  = g.cosechas.length ? g.cosechas.reduce((s,c)=>s+(+c.costo_ha||0),0)/g.cosechas.length : 0
                return (
                  <tr key={key}>
                    <td><strong>{g.anio}</strong></td>
                    <td><span className="badge badge-info">{g.temp}</span></td>
                    <td style={{ textAlign:'center' }}>{g.cosechas.length}</td>
                    <td style={{ fontFamily:'IBM Plex Mono' }}>{avgRend} t/ha</td>
                    <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(g.totI)}</td>
                    <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(g.totC)}</td>
                    <td style={{ fontFamily:'IBM Plex Mono', color:g.totU>=0?'var(--cg)':'var(--cr)' }}>${fmx(g.totU)}</td>
                    <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(avgHaG,0)}</td>
                  </tr>
                )
              })}
              </tbody></table></div>
              <div style={{ marginTop:14 }}>
                <Bar data={{
                  labels: gruposArr.map(([key]) => key),
                  datasets: [
                    { label:'Ingresos', data:gruposArr.map(([,g])=>Math.round(g.totI)), backgroundColor:'#4A8C3F' },
                    { label:'Costos',   data:gruposArr.map(([,g])=>Math.round(g.totC)), backgroundColor:'#C0392B' },
                    { label:'Utilidad', data:gruposArr.map(([,g])=>Math.round(g.totU)), backgroundColor:'#1A5276' },
                  ]
                }} options={{ responsive:true, plugins:{ legend:{ position:'top' } }, scales:{ y:{ ticks:{ callback:v=>'$'+v.toLocaleString('es-MX',{maximumFractionDigits:0}) } } } }} />
              </div>
            </div>
          )}
        </>}
    </>
  )
}
