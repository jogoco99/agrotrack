import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { RanchoChip, TipoChip, IvBadge, fmx, Spinner } from '../components/UI'
import { RANCHOS } from '../lib/constants'

export default function Riegos() {
  const [riegos,  setRiegos]  = useState([])
  const [ultimos, setUltimos] = useState([])
  const [loading, setLoading] = useState(true)
  const [fRancho, setFRancho] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: r }, { data: u }] = await Promise.all([
      sb.from('v_intervalo_riego').select('*'),
      sb.from('actividades').select('*, areas(rancho,tipo,denom)').eq('tipo','riego').order('fecha',{ascending:false}).limit(20),
    ])
    setRiegos(r || []); setUltimos(u || [])
    setLoading(false)
  }

  if (loading) return <Spinner />

  const fil = fRancho ? riegos.filter(r => r.rancho === fRancho) : riegos
  const ok   = fil.filter(r => r.dias_sin_riego != null && r.dias_sin_riego < 10)
  const warn = fil.filter(r => r.dias_sin_riego != null && r.dias_sin_riego >= 10 && r.dias_sin_riego <= 16)
  const crit = fil.filter(r => r.dias_sin_riego != null && r.dias_sin_riego > 16)
  const sinR = fil.filter(r => r.dias_sin_riego == null)

  return (
    <>
      <div className="g4" style={{ marginBottom: 14 }}>
        <div className="met gr"><div className="ml">Intervalo &lt;10 días</div><div className="mv">{ok.length}</div><div className="ms">Al corriente</div></div>
        <div className="met am"><div className="ml">Intervalo 10–16 días</div><div className="mv">{warn.length}</div><div className="ms">Atención</div></div>
        <div className="met rd"><div className="ml">Intervalo &gt;16 días</div><div className="mv">{crit.length}</div><div className="ms">Crítico</div></div>
        <div className="met"><div className="ml">Sin registros</div><div className="mv">{sinR.length}</div></div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div className="fg" style={{ maxWidth: 200 }}>
          <label>Filtrar por rancho</label>
          <select value={fRancho} onChange={e => setFRancho(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(RANCHOS).map(([k,r]) => <option key={k} value={k}>{r.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="ct"><i className="ti ti-droplet"></i>Intervalos por área</div>
        <div className="tw"><table><thead><tr>
          <th>Rancho</th><th>Tipo</th><th>Área</th><th>Cultivo</th><th>Variedad</th>
          <th>Último riego</th><th>Días sin riego</th>
        </tr></thead><tbody>
          {fil.sort((a,b)=>(b.dias_sin_riego||0)-(a.dias_sin_riego||0)).map(r => (
            <tr key={r.id}>
              <td><RanchoChip r={r.rancho} /></td>
              <td><TipoChip t={r.tipo} /></td>
              <td><strong>{r.denom}</strong></td>
              <td>{r.cultivo||'—'}</td>
              <td>{r.variedad||'—'}</td>
              <td style={{ fontFamily:'IBM Plex Mono', fontSize: 11 }}>{r.ultimo_riego||'—'}</td>
              <td><IvBadge n={r.dias_sin_riego} /></td>
            </tr>
          ))}
        </tbody></table></div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="ct"><i className="ti ti-history"></i>Últimos 20 riegos</div>
        <div className="tw"><table><thead><tr>
          <th>Fecha</th><th>Rancho</th><th>Tipo</th><th>Área</th>
          <th>Hrs regadas</th><th>Hrs prog.</th><th>Cumplimiento</th>
          <th>Lámina</th><th>Vel. pivote</th><th>P. inicial</th><th>P. final</th>
        </tr></thead><tbody>
          {ultimos.map(a => (
            <tr key={a.id}>
              <td style={{ fontFamily:'IBM Plex Mono', fontSize:11 }}>{a.fecha}</td>
              <td>{a.areas ? <RanchoChip r={a.areas.rancho}/> : '—'}</td>
              <td>{a.areas ? <TipoChip t={a.areas.tipo}/> : '—'}</td>
              <td>{a.areas?.denom||'—'}</td>
              <td style={{ fontFamily:'IBM Plex Mono' }}>{a.horas_regadas||'—'}</td>
              <td style={{ fontFamily:'IBM Plex Mono' }}>{a.horas_prog||'—'}</td>
              <td>{a.cumplimiento != null
                ? <span className={`badge ${a.cumplimiento<80?'badge-red':a.cumplimiento<95?'badge-warn':'badge-ok'}`}>{a.cumplimiento}%</span>
                : '—'}
              </td>
              <td>{a.lamina||'—'}</td>
              <td>{a.velocidad_pivote != null ? a.velocidad_pivote+'%' : '—'}</td>
              <td>{a.presion_inicial||'—'}</td>
              <td>{a.presion_final||'—'}</td>
            </tr>
          ))}
        </tbody></table></div>
      </div>
    </>
  )
}
