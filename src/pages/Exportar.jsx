import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { RanchoChip, Spinner, fmtFecha, fmx } from '../components/UI'
import { RANCHOS, ROLES_VEN_COSTOS } from '../lib/constants'
import * as XLSX from 'xlsx'

export default function Exportar() {
  const { perfil } = useAuth()
  const verCostos = ROLES_VEN_COSTOS.includes(perfil?.rol)
  const [areas,    setAreas]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [fRancho,  setFRancho]  = useState('')
  const [fArea,    setFArea]    = useState('')
  const [fDesde,   setFDesde]   = useState('')
  const [fHasta,   setFHasta]   = useState('')
  const [exporting,setExporting]= useState('')

  useEffect(() => {
    sb.from('areas').select('*').eq('activa', true).then(({ data }) => {
      setAreas(data || []); setLoading(false)
    })
  }, [])

  async function exportar(tipo) {
    setExporting(tipo)
    let data = [], cols = [], nombre = ''

    if (tipo === 'riegos') {
      let q = sb.from('actividades').select('*, areas(rancho,tipo,denom,variedad)').eq('tipo', 'riego').order('fecha', { ascending: false })
      if (fRancho) q = q.eq('areas.rancho', fRancho)
      if (fArea)   q = q.eq('area_id', fArea)
      if (fDesde)  q = q.gte('fecha', fDesde)
      if (fHasta)  q = q.lte('fecha', fHasta)
      const { data: rows } = await q
      data = (rows || []).map(r => ({
        'Fecha':         fmtFecha(r.fecha),
        'Rancho':        RANCHOS[r.areas?.rancho]?.nombre || r.areas?.rancho || '',
        'Tipo área':     r.areas?.tipo  || '',
        'Área':          r.areas?.denom || '',
        'Variedad':      r.areas?.variedad || '',
        'Hora inicio':   r.hora_inicio || '',
        'Hora fin':      r.hora_fin    || '',
        'Fecha fin':     fmtFecha(r.fecha_fin_riego) !== '—' ? fmtFecha(r.fecha_fin_riego) : '',
        'Hrs regadas':   r.horas_regadas || '',
        'Hrs prog.':     r.horas_prog    || '',
        'Cumplimiento%': r.cumplimiento  || '',
        'Lámina/Vol':    r.lamina  || '',
        'Método':        r.metodo  || '',
        'Vel. pivote%':  r.velocidad_pivote || '',
        'Presión ini':   r.presion_inicial  || '',
        'Presión fin':   r.presion_final    || '',
        'Notas':         r.notas || '',
      }))
      nombre = 'riegos'
    }

    if (tipo === 'actividades') {
      let q = sb.from('actividades').select('*, areas(rancho,tipo,denom,variedad)').order('fecha', { ascending: false })
      if (fRancho) q = q.eq('areas.rancho', fRancho)
      if (fArea)   q = q.eq('area_id', fArea)
      if (fDesde)  q = q.gte('fecha', fDesde)
      if (fHasta)  q = q.lte('fecha', fHasta)
      const { data: rows } = await q
      data = (rows || []).map(r => ({
        'Fecha':     fmtFecha(r.fecha),
        'Rancho':    RANCHOS[r.areas?.rancho]?.nombre || '',
        'Tipo área': r.areas?.tipo   || '',
        'Área':      r.areas?.denom  || '',
        'Variedad':  r.areas?.variedad || '',
        'Tipo acto': r.tipo,
        'Detalle':   r.detalle || '',
        'Dosis':     r.dosis   || '',
        'Método':    r.metodo  || '',
        ...(verCostos ? { 'Costo ($)': r.costo || 0 } : {}),
        'Notas':     r.notas || '',
      }))
      nombre = 'actividades'
    }

    if (tipo === 'cosechas') {
      let q = sb.from('cosechas').select('*, areas(rancho,tipo,denom,variedad,sup)').order('fecha', { ascending: false })
      if (fRancho) q = q.eq('areas.rancho', fRancho)
      if (fArea)   q = q.eq('area_id', fArea)
      if (fDesde)  q = q.gte('fecha', fDesde)
      if (fHasta)  q = q.lte('fecha', fHasta)
      const { data: rows } = await q
      data = (rows || []).map(r => ({
        'Fecha':       fmtFecha(r.fecha),
        'Rancho':      RANCHOS[r.areas?.rancho]?.nombre || '',
        'Tipo área':   r.areas?.tipo    || '',
        'Área':        r.areas?.denom   || '',
        'Variedad':    r.areas?.variedad || '',
        'Corte #':     r.num_corte || '',
        'Rend. t/ha':  r.rendimiento || '',
        'MS%':         r.ms_pct     || '',
        ...(verCostos ? {
          'Precio $/ton':    r.precio          || 0,
          'Ingresos ($)':    r.ingresos        || 0,
          'Costo acts. ($)': r.costo_actividades || 0,
          'Costo cosecha($)':r.costo_cosecha   || 0,
          'Flete prorr. ($)':r.flete_prorr     || 0,
          'CG prorr. ($)':   r.costos_cg_prorr || 0,
          'Costo total ($)': r.costo_total     || 0,
          'Utilidad ($)':    r.utilidad        || 0,
          '$/ha':            r.costo_ha        || 0,
          '$/kg húmedo':     r.costo_kg_humedo || 0,
          '$/kg MS':         r.costo_kg_ms     || 0,
          'ROI%':            r.roi             || 0,
        } : {}),
        'PC%':   r.brom_pc      || '',
        'FDN%':  r.brom_fdn     || '',
        'FDA%':  r.brom_fda     || '',
        'EN':    r.brom_energia || '',
        'Notas': r.notas        || '',
      }))
      nombre = 'cosechas'
    }

    if (!data.length) { setExporting(''); alert('Sin datos para exportar con los filtros seleccionados'); return }

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, nombre)
    const sfx = fDesde || fHasta ? `_${fDesde||''}${fHasta?'_a_'+fHasta:''}` : ''
    XLSX.writeFile(wb, `agrotrack_${nombre}${sfx}.xlsx`)
    setExporting('')
  }

  if (loading) return <Spinner />

  const areasF = fRancho ? areas.filter(a => a.rancho === fRancho) : areas

  return (
    <>
      <div className="al info" style={{ marginBottom: 14 }}>
        <i className="ti ti-info-circle"></i>Aplica los filtros que quieras antes de exportar. Si no filtras se descarga todo el historial.
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ct"><i className="ti ti-filter"></i>Filtros</div>
        <div className="fr c4">
          <div className="fg"><label>Rancho</label>
            <select value={fRancho} onChange={e => { setFRancho(e.target.value); setFArea('') }}>
              <option value="">Todos</option>
              {Object.entries(RANCHOS).map(([k, r]) => <option key={k} value={k}>{r.nombre}</option>)}
            </select></div>
          <div className="fg"><label>Área</label>
            <select value={fArea} onChange={e => setFArea(e.target.value)}>
              <option value="">Todas</option>
              {areasF.map(a => <option key={a.id} value={a.id}>{a.tipo} {a.denom}{a.variedad?' — '+a.variedad:''}</option>)}
            </select></div>
          <div className="fg"><label>Desde</label>
            <input type="date" value={fDesde} onChange={e => setFDesde(e.target.value)} /></div>
          <div className="fg"><label>Hasta</label>
            <input type="date" value={fHasta} onChange={e => setFHasta(e.target.value)} /></div>
        </div>
        <button className="btn sm" onClick={() => { setFRancho(''); setFArea(''); setFDesde(''); setFHasta('') }}>
          <i className="ti ti-x"></i> Limpiar filtros
        </button>
      </div>

      {/* Botones de exportación */}
      <div className="g3">
        {[
          { tipo:'riegos',      icon:'ti-droplet',      titulo:'Riegos', desc:'Fecha, horas, lámina, presiones, cumplimiento' },
          { tipo:'actividades', icon:'ti-clipboard-list',titulo:'Actividades', desc:'Todos los tipos: riego, fertilizante, herbicida, insecticida' },
          { tipo:'cosechas',    icon:'ti-basket',       titulo:'Cosechas / Cortes', desc:'Rendimiento, costos, utilidad, bromatología' },
        ].map(({ tipo, icon, titulo, desc }) => (
          <div key={tipo} className="card" style={{ textAlign:'center' }}>
            <i className={`ti ${icon}`} style={{ fontSize: 32, color:'var(--cgm)', display:'block', marginBottom: 8 }}></i>
            <div style={{ fontFamily:'Playfair Display,serif', fontSize: 15, marginBottom: 6 }}>{titulo}</div>
            <p style={{ fontSize: 12, color:'var(--cs)', marginBottom: 14 }}>{desc}</p>
            <button className="btn pr full" onClick={() => exportar(tipo)} disabled={exporting === tipo}>
              {exporting === tipo
                ? <><i className="ti ti-loader"></i> Generando…</>
                : <><i className="ti ti-file-spreadsheet"></i> Descargar Excel</>}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
