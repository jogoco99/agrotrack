import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { RanchoChip, TipoChip, ActBadge, IvBadge, fmx, fmtFecha, today, daysFrom, Spinner } from '../components/UI'
import { RANCHOS, TIPOS_ACT, ROLES_VEN_COSTOS } from '../lib/constants'

export default function Dashboard({ onNav }) {
  const { perfil } = useAuth()
  const verCostos = ROLES_VEN_COSTOS.includes(perfil?.rol)
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [
      { data: areas },
      { data: acts },
      { data: progs },
      { data: cosechas },
      { data: riegos },
    ] = await Promise.all([
      sb.from('areas').select('*').eq('activa', true),
      sb.from('actividades')
        .select('*, areas(rancho,tipo,denom,variedad)')
        .order('fecha', { ascending: false })
        .limit(8),
      sb.from('programas')
        .select('*, areas(rancho,tipo,denom,variedad)')
        .eq('completado', false)
        .order('fecha'),
      sb.from('cosechas').select('ingresos,costo_total'),
      sb.from('v_intervalo_riego').select('*'),
    ])
    setData({ areas: areas||[], acts: acts||[], progs: progs||[], cosechas: cosechas||[], riegos: riegos||[] })
    setLoading(false)
  }

  if (loading) return <Spinner />

  const { areas, acts, progs, cosechas, riegos } = data
  const hoy   = today()
  const en10  = new Date(hoy); en10.setDate(en10.getDate() + 10)
  const en10s = en10.toISOString().split('T')[0]
  const pend  = progs.filter(p => p.fecha >= hoy && p.fecha <= en10s)
  const atras = progs.filter(p => p.fecha < hoy)
  const totalHa  = areas.reduce((s, a) => s + (+a.sup || 0), 0)
  const costActs = acts.reduce((s, a)  => s + (+a.costo || 0), 0)
  const ingTotal = cosechas.reduce((s, c) => s + (+c.ingresos || 0), 0)
  const cosTotal = cosechas.reduce((s, c) => s + (+c.costo_total || 0), 0)
  const tablaAlert = riegos.filter(r => r.dias_sin_riego > 16)
  const allPend = [...atras, ...pend].slice(0, 6)

  return (
    <>
      {tablaAlert.length > 0 && (
        <div className="al red" style={{ marginBottom: 12 }}>
          <i className="ti ti-alert-triangle"></i>
          <div>
            <strong>Áreas con intervalo &gt;16 días sin riego:</strong>{' '}
            {tablaAlert.map(r => `${RANCHOS[r.rancho]?.nombre} — ${r.denom} (${r.dias_sin_riego}d)`).join(', ')}
          </div>
        </div>
      )}

      <div className="g4" style={{ marginBottom: 16 }}>
        <div className="met">
          <div className="ml">Áreas activas</div>
          <div className="mv">{areas.length}</div>
          <div className="ms">{fmx(totalHa, 1)} ha</div>
        </div>
        <div className={`met ${atras.length + pend.length ? 'am' : 'gr'}`}>
          <div className="ml">Tareas (10 días)</div>
          <div className="mv">{atras.length + pend.length}</div>
          <div className="ms">{atras.length ? `${atras.length} atrasadas` : 'Pendientes'}</div>
        </div>
        {verCostos && <>
          <div className="met">
            <div className="ml">Costos campo</div>
            <div className="mv">${fmx(costActs)}</div>
            <div className="ms">{acts.length} actividades</div>
          </div>
          <div className={`met ${ingTotal - cosTotal >= 0 ? 'gr' : 'rd'}`}>
            <div className="ml">Utilidad neta</div>
            <div className="mv">${fmx(ingTotal - cosTotal)}</div>
          </div>
        </>}
      </div>

      <div className="g2" style={{ marginBottom: 14 }}>
        {/* Próximas tareas */}
        <div className="card">
          <div className="ct"><i className="ti ti-bell-ringing"></i>Próximos 10 días ({allPend.length})</div>
          {!allPend.length
            ? <div className="empty"><i className="ti ti-check"></i><p>Sin pendientes</p></div>
            : allPend.map(p => {
                const d   = daysFrom(p.fecha)
                const cls = d < 0 ? 'urg' : d === 0 ? 'hoy' : 'fut'
                return (
                  <div className={`pi ${cls}`} key={p.id}>
                    <div className="pi-date">{fmtFecha(p.fecha)}</div>
                    <div className="pi-info">
                      <strong>
                        {TIPOS_ACT[p.tipo]?.label}
                        {p.num_aplicacion ? ` #${p.num_aplicacion}` : ''}
                        {p.producto ? ' — ' + p.producto : ''}
                      </strong>
                      <span>
                        {p.areas?.rancho ? <RanchoChip r={p.areas.rancho} /> : null}
                        {' '}{p.areas?.denom || ''}
                        {p.areas?.variedad ? ' · ' + p.areas.variedad : ''}
                      </span>
                    </div>
                    <span className={`badge ${d < 0 ? 'badge-red' : d === 0 ? 'badge-warn' : 'badge-info'}`}>
                      {d < 0 ? 'Atraso' : d === 0 ? 'Hoy' : d + 'd'}
                    </span>
                  </div>
                )
              })}
          <button className="btn sm" style={{ marginTop: 8 }} onClick={() => onNav('tareas')}>Ver todas →</button>
        </div>

        {/* Intervalos críticos */}
        <div className="card">
          <div className="ct"><i className="ti ti-droplet"></i>Intervalos críticos (&gt;16 días)</div>
          {!tablaAlert.length
            ? <div className="empty"><i className="ti ti-check"></i><p>Todas al corriente</p></div>
            : tablaAlert.map(r => (
                <div className="pi urg" key={r.id}>
                  <div className="pi-info">
                    <strong>{RANCHOS[r.rancho]?.nombre} — {r.tipo} {r.denom}</strong>
                    <span>{r.cultivo} {r.variedad}</span>
                  </div>
                  <IvBadge n={r.dias_sin_riego} />
                </div>
              ))}
        </div>
      </div>

      {/* Últimas actividades */}
      <div className="card">
        <div className="ct"><i className="ti ti-activity"></i>Últimas actividades</div>
        {!acts.length
          ? <div className="empty"><i className="ti ti-clipboard"></i><p>Sin actividades</p></div>
          : <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Rancho</th>
                    <th>Área</th>
                    <th>Tipo</th>
                    <th>Detalle</th>
                    {verCostos && <th>Costo</th>}
                  </tr>
                </thead>
                <tbody>
                  {acts.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{fmtFecha(a.fecha)}</td>
                      <td>{a.areas?.rancho ? <RanchoChip r={a.areas.rancho} /> : '—'}</td>
                      <td>
                        {a.areas?.tipo ? <TipoChip t={a.areas.tipo} /> : null}
                        {' '}<strong>{a.areas?.denom || '—'}</strong>
                        {a.areas?.variedad ? <span style={{ fontSize: 11, color: 'var(--ct)', marginLeft: 4 }}>{a.areas.variedad}</span> : null}
                      </td>
                      <td><ActBadge tipo={a.tipo} /></td>
                      <td>{a.detalle || '—'}</td>
                      {verCostos && <td style={{ fontFamily: 'IBM Plex Mono' }}>${fmx(a.costo)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </div>
    </>
  )
}
