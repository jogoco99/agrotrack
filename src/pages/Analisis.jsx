import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { RanchoChip, TipoChip, Spinner, fmx } from '../components/UI'
import { RANCHOS, TIPOS_ACT, CULTIVOS, ROLES_VEN_COSTOS } from '../lib/constants'
import { Bar, Scatter } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Legend, Tooltip } from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Legend, Tooltip)

export default function Analisis() {
  const { perfil } = useAuth()
  const verCostos = ROLES_VEN_COSTOS.includes(perfil?.rol)

  const [cosechas, setCosechas] = useState([])
  const [acts,     setActs]     = useState([])
  const [areas,    setAreas]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('rendimiento')
  const [fCultivo, setFCultivo] = useState('')

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [{ data: c }, { data: a }, { data: ar }] = await Promise.all([
      sb.from('cosechas').select('*, areas(rancho,tipo,denom,variedad,sup,cultivo,temporada)'),
      sb.from('actividades').select('tipo,costo,area_id,dosis,areas(rancho,tipo,denom,cultivo)'),
      sb.from('areas').select('*').eq('activa', true),
    ])
    setCosechas(c || []); setActs(a || []); setAreas(ar || [])
    setLoading(false)
  }

  if (loading) return <Spinner />

  const rk    = Object.keys(RANCHOS)
  const rcols = ['#D4A830','#1A5276','#2D6A2D','#922B21']
  const vars  = [...new Set(cosechas.map(c => c.areas?.variedad || '').filter(Boolean))]
  const vcols = ['#2D6A2D','#1A5276','#B7770D','#6C3483','#922B21']

  const avgRend = arr => arr.length ? +(arr.reduce((s,c) => s + (+c.rendimiento||0), 0) / arr.length).toFixed(2) : 0

  // Filtrar cosechas por cultivo si se seleccionó
  const cosFil = fCultivo ? cosechas.filter(c => c.areas?.cultivo === fCultivo) : cosechas
  const areasFil = fCultivo ? areas.filter(a => a.cultivo === fCultivo) : areas

  // ── Datos para comparativa enriquecida ──
  const areaStats = areasFil.map(area => {
    const cosA = cosFil.filter(c => c.area_id === area.id)
    const actsA = acts.filter(a => a.area_id === area.id)
    const riegos     = actsA.filter(a => a.tipo === 'riego')
    const fertes     = actsA.filter(a => a.tipo === 'fertilizante')
    const herbs      = actsA.filter(a => a.tipo === 'herbicida')
    const insect     = actsA.filter(a => a.tipo === 'insecticida')
    const rendProm   = avgRend(cosA)
    const kgFerte    = fertes.reduce((s, a) => {
      const d = parseFloat((a.dosis || '').replace(/[^0-9.]/g,'')) || 0
      return s + d * area.sup
    }, 0)
    return {
      area, rendProm,
      nRiegos:   riegos.length,
      nFertes:   fertes.length,
      nHerbs:    herbs.length,
      nInsect:   insect.length,
      kgFerte:   parseFloat(kgFerte.toFixed(1)),
      costoActs: verCostos ? actsA.reduce((s,a) => s+(+a.costo||0), 0) : null,
    }
  }).filter(x => x.rendProm > 0 || x.nRiegos > 0)

  const tipos = Object.entries(TIPOS_ACT)
  const pdata = tipos.map(([k]) => acts.filter(a => a.tipo === k).reduce((s,a) => s+(+a.costo||0), 0))

  return (
    <>
      {/* ── Filtro cultivo ── */}
      <div style={{ display:'flex', gap:10, alignItems:'flex-end', marginBottom:14, flexWrap:'wrap' }}>
        <div className="fg" style={{ minWidth:140 }}><label>Filtrar por cultivo</label>
          <select value={fCultivo} onChange={e => setFCultivo(e.target.value)}>
            <option value="">Todos los cultivos</option>
            {CULTIVOS.map(c => <option key={c}>{c}</option>)}
          </select></div>
        {fCultivo && <button className="btn sm" onClick={() => setFCultivo('')}><i className="ti ti-x"></i> Limpiar</button>}
      </div>

      <div className="tabs">
        {[
          ['rendimiento', 'Rendimiento vs insumos'],
          ['rancho',      'Por rancho'],
          ['variedad',    'Por variedad'],
          ['tipo',        'Por tipo área'],
          ['acts',        'Actividades'],
          ...(verCostos ? [['costos','Costos']] : []),
        ].map(([id, lbl]) => (
          <button key={id} className={`tabb ${tab===id?'active':''}`} onClick={() => setTab(id)}>{lbl}</button>
        ))}
      </div>

      {/* ═══ TAB: Rendimiento vs insumos ═══ */}
      {tab === 'rendimiento' && (
        <>
          {!areaStats.length
            ? <div className="card"><div className="empty"><p>Sin datos suficientes. Registra cosechas y actividades primero.</p></div></div>
            : <>
              {/* Tabla principal */}
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="ct"><i className="ti ti-chart-dots"></i>Rendimiento vs insumos por área</div>
                <div className="tw"><table><thead><tr>
                  <th>Rancho</th><th>Tipo</th><th>Área</th><th>Cultivo</th><th>Variedad</th>
                  <th>Rend. prom. (t/ha)</th>
                  <th>💧 # Riegos</th>
                  <th>🌱 # Fert.</th>
                  <th>Kg fert./ha</th>
                  <th>🌿 # Herb.</th>
                  <th>🐛 # Insect.</th>
                  {verCostos && <th>Costo campo</th>}
                </tr></thead><tbody>
                {areaStats.sort((a,b) => b.rendProm - a.rendProm).map(({ area, rendProm, nRiegos, nFertes, nHerbs, nInsect, kgFerte, costoActs }) => (
                  <tr key={area.id}>
                    <td><RanchoChip r={area.rancho} /></td>
                    <td><TipoChip t={area.tipo} /></td>
                    <td><strong>{area.denom}</strong></td>
                    <td>{area.cultivo || '—'}</td>
                    <td>{area.variedad || '—'}</td>
                    <td>
                      <span style={{ fontFamily:'IBM Plex Mono', fontWeight:600, color: rendProm > 0 ? 'var(--cg)' : 'var(--cs)' }}>
                        {rendProm > 0 ? rendProm : '—'}
                      </span>
                    </td>
                    <td style={{ textAlign:'center', fontFamily:'IBM Plex Mono' }}>{nRiegos}</td>
                    <td style={{ textAlign:'center', fontFamily:'IBM Plex Mono' }}>{nFertes}</td>
                    <td style={{ fontFamily:'IBM Plex Mono', fontSize:11 }}>{kgFerte > 0 ? fmx(kgFerte/area.sup, 1) : '—'}</td>
                    <td style={{ textAlign:'center', fontFamily:'IBM Plex Mono' }}>{nHerbs}</td>
                    <td style={{ textAlign:'center', fontFamily:'IBM Plex Mono' }}>{nInsect}</td>
                    {verCostos && <td style={{ fontFamily:'IBM Plex Mono' }}>{costoActs != null ? '$'+fmx(costoActs) : '—'}</td>}
                  </tr>
                ))}
                </tbody></table></div>
              </div>

              {/* Gráfica: rendimiento vs riegos */}
              {areaStats.filter(x => x.rendProm > 0).length > 1 && (
                <div className="g2" style={{ marginBottom: 14 }}>
                  <div className="card">
                    <div className="ct"><i className="ti ti-chart-bar"></i>Rendimiento (t/ha) por área</div>
                    <Bar data={{
                      labels: areaStats.filter(x=>x.rendProm>0).map(x => `${RANCHOS[x.area.rancho]?.nombre} ${x.area.denom}`),
                      datasets: [{ label:'t/ha', data: areaStats.filter(x=>x.rendProm>0).map(x=>x.rendProm), backgroundColor:'#4A8C3F', borderWidth:0 }]
                    }} options={{ responsive:true, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true, title:{display:true,text:'t/ha'}}, x:{grid:{display:false}} } }} />
                  </div>
                  <div className="card">
                    <div className="ct"><i className="ti ti-droplet"></i>Número de riegos por área</div>
                    <Bar data={{
                      labels: areaStats.map(x => `${RANCHOS[x.area.rancho]?.nombre} ${x.area.denom}`),
                      datasets: [{ label:'Riegos', data: areaStats.map(x=>x.nRiegos), backgroundColor:'#1A5276', borderWidth:0 }]
                    }} options={{ responsive:true, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true, ticks:{stepSize:1}}, x:{grid:{display:false}} } }} />
                  </div>
                </div>
              )}

              {/* Gráfica: aplicaciones de fertilizante */}
              {areaStats.filter(x=>x.nFertes>0).length > 0 && (
                <div className="g2">
                  <div className="card">
                    <div className="ct"><i className="ti ti-plant"></i># Aplicaciones de fertilizante</div>
                    <Bar data={{
                      labels: areaStats.map(x => `${RANCHOS[x.area.rancho]?.nombre} ${x.area.denom}`),
                      datasets: [{ label:'Aplic.', data: areaStats.map(x=>x.nFertes), backgroundColor:'#D4A830', borderWidth:0 }]
                    }} options={{ responsive:true, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true, ticks:{stepSize:1}}, x:{grid:{display:false}} } }} />
                  </div>
                  <div className="card">
                    <div className="ct"><i className="ti ti-plant"></i>Kg fertilizante / ha</div>
                    <Bar data={{
                      labels: areaStats.filter(x=>x.kgFerte>0).map(x => `${RANCHOS[x.area.rancho]?.nombre} ${x.area.denom}`),
                      datasets: [{ label:'kg/ha', data: areaStats.filter(x=>x.kgFerte>0).map(x => parseFloat((x.kgFerte/x.area.sup).toFixed(1))), backgroundColor:'#2D6A2D', borderWidth:0 }]
                    }} options={{ responsive:true, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true, title:{display:true,text:'kg/ha'}}, x:{grid:{display:false}} } }} />
                  </div>
                </div>
              )}
            </>}
        </>
      )}

      {/* ═══ TAB: Por rancho ═══ */}
      {tab === 'rancho' && (
        <>
          <div className="card" style={{ marginBottom:12 }}>
            <div className="ct"><i className="ti ti-chart-bar"></i>Rendimiento promedio por rancho</div>
            <Bar data={{
              labels: rk.map(k => RANCHOS[k].nombre),
              datasets: [{ label:'t/ha', data: rk.map(k => avgRend(cosFil.filter(c => c.areas?.rancho === k))), backgroundColor: rcols, borderWidth:0 }]
            }} options={{ responsive:true, plugins:{legend:{display:false}}, scales:{ y:{title:{display:true,text:'t/ha'},beginAtZero:true}, x:{grid:{display:false}} } }} />
          </div>
          <div className="card">
            <div className="tw"><table><thead><tr>
              <th>Rancho</th><th>Cosechas</th><th>Rend. prom.</th>
              {verCostos && <><th>Ingresos</th><th>Utilidad</th></>}
            </tr></thead><tbody>
            {rk.map(k => {
              const ar = cosFil.filter(c => c.areas?.rancho === k); if (!ar.length) return null
              const totU = ar.reduce((s,c) => s+(+c.utilidad||0), 0)
              return (
                <tr key={k}>
                  <td><RanchoChip r={k} /></td>
                  <td>{ar.length}</td>
                  <td style={{ fontFamily:'IBM Plex Mono' }}>{avgRend(ar)} t/ha</td>
                  {verCostos && <>
                    <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(ar.reduce((s,c)=>s+(+c.ingresos||0),0))}</td>
                    <td style={{ fontFamily:'IBM Plex Mono', color:totU>=0?'var(--cg)':'var(--cr)' }}>${fmx(totU)}</td>
                  </>}
                </tr>
              )
            })}
            </tbody></table></div>
          </div>
        </>
      )}

      {/* ═══ TAB: Por variedad ═══ */}
      {tab === 'variedad' && (
        <>
          <div className="card" style={{ marginBottom:12 }}>
            <div className="ct"><i className="ti ti-chart-bar"></i>Rendimiento promedio por variedad</div>
            <Bar data={{
              labels: vars,
              datasets: [{ label:'t/ha', data: vars.map(v => avgRend(cosFil.filter(c => (c.areas?.variedad||'Sin variedad')===v))), backgroundColor:vcols, borderWidth:0 }]
            }} options={{ responsive:true, plugins:{legend:{display:false}}, scales:{ y:{title:{display:true,text:'t/ha'},beginAtZero:true}, x:{grid:{display:false}} } }} />
          </div>
          <div className="card">
            <div className="tw"><table><thead><tr>
              <th>Variedad</th><th>Registros</th><th>Rend.</th>
              {verCostos && <><th>$/kg húmedo</th><th>$/kg MS</th><th>Utilidad</th></>}
            </tr></thead><tbody>
            {vars.map(v => {
              const ar = cosFil.filter(c => (c.areas?.variedad||'Sin variedad')===v)
              const totU = ar.reduce((s,c)=>s+(+c.utilidad||0),0)
              const avKH = ar.length ? ar.reduce((s,c)=>s+(+c.costo_kg_humedo||0),0)/ar.length : 0
              const avKMS= ar.length ? ar.reduce((s,c)=>s+(+c.costo_kg_ms||0),0)/ar.length : 0
              return (
                <tr key={v}>
                  <td><strong>{v}</strong></td>
                  <td>{ar.length}</td>
                  <td style={{ fontFamily:'IBM Plex Mono' }}>{avgRend(ar)} t/ha</td>
                  {verCostos && <>
                    <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(avKH,4)}</td>
                    <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(avKMS,4)}</td>
                    <td style={{ fontFamily:'IBM Plex Mono', color:totU>=0?'var(--cg)':'var(--cr)' }}>${fmx(totU)}</td>
                  </>}
                </tr>
              )
            })}
            </tbody></table></div>
          </div>
        </>
      )}

      {/* ═══ TAB: Por tipo área ═══ */}
      {tab === 'tipo' && (
        <div className="card">
          <div className="ct"><i className="ti ti-layout-grid"></i>Pivote vs Tabla vs Cintilla</div>
          <div className="tw"><table><thead><tr>
            <th>Tipo</th><th>Registros</th><th>Rend. prom.</th><th># Riegos prom.</th>
            {verCostos && <><th>$/kg húmedo</th><th>Utilidad</th></>}
          </tr></thead><tbody>
          {['Pivote','Tabla','Cintilla'].map(t => {
            const ar    = cosFil.filter(c => c.areas?.tipo === t); if (!ar.length) return null
            const totU  = ar.reduce((s,c) => s+(+c.utilidad||0), 0)
            const avKH  = ar.length ? ar.reduce((s,c)=>s+(+c.costo_kg_humedo||0),0)/ar.length : 0
            const arIds = [...new Set(ar.map(c => c.area_id))]
            const avgRiegosPorArea = arIds.length ? arIds.reduce((s,id) => s + acts.filter(a=>a.area_id===id&&a.tipo==='riego').length, 0) / arIds.length : 0
            return (
              <tr key={t}>
                <td><TipoChip t={t} /></td>
                <td>{ar.length}</td>
                <td style={{ fontFamily:'IBM Plex Mono' }}>{avgRend(ar)} t/ha</td>
                <td style={{ fontFamily:'IBM Plex Mono' }}>{avgRiegosPorArea.toFixed(1)}</td>
                {verCostos && <>
                  <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(avKH,4)}</td>
                  <td style={{ fontFamily:'IBM Plex Mono', color:totU>=0?'var(--cg)':'var(--cr)' }}>${fmx(totU)}</td>
                </>}
              </tr>
            )
          })}
          </tbody></table></div>
        </div>
      )}

      {/* ═══ TAB: Actividades ═══ */}
      {tab === 'acts' && (
        <div className="card">
          <div className="ct"><i className="ti ti-clipboard-list"></i>Conteo de actividades por área</div>
          <div className="tw"><table><thead><tr>
            <th>Rancho</th><th>Tipo</th><th>Área</th><th>Cultivo</th><th>Variedad</th>
            <th>💧</th><th>🌱</th><th>🌿</th><th>🐛</th><th>Total</th>
            {verCostos && <th>Costo campo</th>}
          </tr></thead><tbody>
          {areasFil.map(a => {
            const r = acts.filter(x=>x.area_id===a.id&&x.tipo==='riego').length
            const f = acts.filter(x=>x.area_id===a.id&&x.tipo==='fertilizante').length
            const h = acts.filter(x=>x.area_id===a.id&&x.tipo==='herbicida').length
            const i = acts.filter(x=>x.area_id===a.id&&x.tipo==='insecticida').length
            const costo = acts.filter(x=>x.area_id===a.id).reduce((s,x)=>s+(+x.costo||0),0)
            return (
              <tr key={a.id}>
                <td><RanchoChip r={a.rancho}/></td>
                <td><TipoChip t={a.tipo}/></td>
                <td><strong>{a.denom}</strong></td>
                <td>{a.cultivo||'—'}</td>
                <td>{a.variedad||'—'}</td>
                <td style={{ textAlign:'center', fontFamily:'IBM Plex Mono' }}>{r}</td>
                <td style={{ textAlign:'center', fontFamily:'IBM Plex Mono' }}>{f}</td>
                <td style={{ textAlign:'center', fontFamily:'IBM Plex Mono' }}>{h}</td>
                <td style={{ textAlign:'center', fontFamily:'IBM Plex Mono' }}>{i}</td>
                <td style={{ textAlign:'center', fontWeight:500 }}>{r+f+h+i}</td>
                {verCostos && <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(costo)}</td>}
              </tr>
            )
          })}
          </tbody></table></div>
        </div>
      )}

      {/* ═══ TAB: Costos ═══ */}
      {tab === 'costos' && verCostos && (
        <>
          <div className="card" style={{ marginBottom:12 }}>
            <div className="ct"><i className="ti ti-chart-pie"></i>Distribución de costos por tipo</div>
            <div className="g2" style={{ alignItems:'center' }}>
              <div>
                {tipos.map(([k,v],i) => (
                  <div key={k} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <span style={{ width:10, height:10, borderRadius:2, background:['#1A5276','#2D6A2D','#B7770D','#922B21'][i], flexShrink:0 }}></span>
                    <span style={{ fontSize:13 }}>{v.label}</span>
                    <span style={{ marginLeft:'auto', fontFamily:'IBM Plex Mono', fontSize:12 }}>${fmx(pdata[i])}</span>
                    <span style={{ fontSize:11, color:'var(--ct)' }}>
                      {pdata.reduce((a,b)=>a+b,0)>0?((pdata[i]/pdata.reduce((a,b)=>a+b,0))*100).toFixed(0):0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="ct"><i className="ti ti-map-pin"></i>Costos por rancho</div>
            <Bar data={{
              labels: rk.map(k=>RANCHOS[k].nombre),
              datasets: [{ label:'Costo ($)', data:rk.map(k=>acts.filter(a=>a.areas?.rancho===k).reduce((s,a)=>s+(+a.costo||0),0)), backgroundColor:rcols, borderWidth:0 }]
            }} options={{ responsive:true, plugins:{legend:{display:false}}, scales:{ y:{ticks:{callback:v=>'$'+v.toLocaleString('es-MX',{maximumFractionDigits:0})},beginAtZero:true}, x:{grid:{display:false}} } }} />
          </div>
        </>
      )}
    </>
  )
}
