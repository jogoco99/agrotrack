import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { RanchoChip, TipoChip, Modal, toast, Spinner, fmx, fmtFecha, today } from '../components/UI'
import { RANCHOS, CULTIVOS, TEMPORADAS, CULTIVOS_PERENES, ROLES_VEN_COSTOS } from '../lib/constants'

export default function Cosecha() {
  const { perfil } = useAuth()
  const verCostos = ROLES_VEN_COSTOS.includes(perfil?.rol)

  const [cosechas,  setCosechas]  = useState([])
  const [areas,     setAreas]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [form,      setForm]      = useState({ rancho:'', areaId:'', fecha:today(), kilos:'', ms:'', pv:'', cc:'', ot:'' })
  const [brom,      setBrom]      = useState({ pc:'',fdn:'',fda:'',alm:'',hum:'',dmo:'',en:'',cen:'',gc:'',lab:'' })
  const [saving,    setSaving]    = useState(false)
  const [edit,      setEdit]      = useState(null)
  const [verBromC,  setVerBromC]  = useState(null)
  const [fRancho,   setFRancho]   = useState('')
  const [fArea,     setFArea]     = useState('')

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [{ data: c }, { data: a }] = await Promise.all([
      sb.from('cosechas').select('*, areas(rancho,tipo,denom,variedad,sup,cultivo,perene,siembra)').order('fecha', { ascending: false }),
      sb.from('areas').select('*').eq('activa', true),
    ])
    setCosechas(c || []); setAreas(a || [])
    setLoading(false)
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function setB(k, v) { setBrom(b => ({ ...b, [k]: v })) }
  function setE(k, v) { setEdit(e => ({ ...e, [k]: v })) }

  const areasR   = areas.filter(a => a.rancho === form.rancho)
  const selArea  = areas.find(a => a.id === form.areaId)
  const esPerene = CULTIVOS_PERENES.includes(selArea?.cultivo)

  // Calcular ton/ha automáticamente desde kilos totales
  const rendimiento = (form.kilos && selArea?.sup)
    ? parseFloat((parseFloat(form.kilos) / 1000 / parseFloat(selArea.sup)).toFixed(4))
    : null

  function numCorteActual() {
    if (!selArea) return 1
    return cosechas.filter(c => c.area_id === selArea.id).length + 1
  }

  function fechaUltimoCorte() {
    if (!selArea) return null
    const cortes = cosechas.filter(c => c.area_id === selArea.id).sort((a, b) => b.fecha.localeCompare(a.fecha))
    return cortes.length ? cortes[0].fecha : selArea.siembra
  }

  async function calcAndSave() {
    if (!form.areaId || !form.fecha || !form.kilos || !form.pv) {
      toast('Completa área, fecha, kilos totales y precio', false); return
    }
    const ha   = +selArea?.sup || 0
    const kg   = parseFloat(form.kilos) || 0
    const rh   = parseFloat((kg / 1000 / ha).toFixed(4))
    const ms   = parseFloat(form.ms) || 0
    const pv   = parseFloat(form.pv) || 0
    const ingresos = (kg / 1000) * pv

    // Actividades del período
    const fechaDesde = esPerene ? fechaUltimoCorte() : null
    const { data: actsQ } = await sb.from('actividades')
      .select('costo').eq('area_id', form.areaId)
      .gte('fecha', fechaDesde || '1900-01-01')
      .lte('fecha', form.fecha)
    const cosActs = (actsQ || []).reduce((s, a) => s + (+a.costo || 0), 0)

    // Costo semilla del área
    const costoSemilla = !esPerene ? (selArea?.costo_semilla || 0) : 0

    // Costos generales prorateados
    let cgProrr = 0
    if (selArea) {
      const { data: cg } = await sb.from('costos_generales').select('monto,temporada,cultivo,anio')
      const anio = form.fecha.split('-')[0]
      const cgFil = (cg || []).filter(c =>
        (!selArea.temporada || c.temporada === selArea.temporada) &&
        (!selArea.cultivo   || c.cultivo   === selArea.cultivo) &&
        (!c.anio            || String(c.anio) === anio)
      )
      const totalCG = cgFil.reduce((s, c) => s + (+c.monto || 0), 0)
      const { data: areasM } = await sb.from('areas').select('sup')
        .eq('activa', true)
        .eq('cultivo', selArea.cultivo || '')
      const totalHaM = (areasM || []).reduce((s, a) => s + (+a.sup || 0), 0)
      cgProrr = totalHaM > 0 ? (ha / totalHaM) * totalCG : 0
    }

    const cc  = parseFloat(form.cc) || 0
    const ot  = parseFloat(form.ot) || 0
    const costoTotal = cosActs + costoSemilla + cc + ot + cgProrr
    const util       = ingresos - costoTotal
    const tonTotal   = kg / 1000
    const costoHa    = ha > 0 ? costoTotal / ha : 0
    const costoKgH   = kg > 0 ? costoTotal / kg : 0
    const tonMS      = tonTotal * (ms / 100)
    const costoKgMS  = tonMS > 0 ? costoTotal / (tonMS * 1000) : 0
    const numCorte   = esPerene ? numCorteActual() : null

    const hasBrom = Object.entries(brom).some(([k, v]) => k !== 'lab' && v !== '')
    const { error } = await sb.from('cosechas').insert({
      area_id: form.areaId, fecha: form.fecha,
      kilos_totales: kg, rendimiento: rh, ms_pct: ms, precio: pv,
      ingresos, costo_actividades: cosActs,
      costo_semilla: costoSemilla,
      costo_cosecha: cc, costos_cg_prorr: cgProrr,
      otros_costos: ot, costo_total: costoTotal, utilidad: util,
      costo_ha: costoHa, costo_kg_humedo: costoKgH, costo_kg_ms: costoKgMS,
      roi: costoTotal > 0 ? util / costoTotal * 100 : 0,
      num_corte: numCorte,
      ...(hasBrom ? {
        brom_pc: brom.pc ? +brom.pc : null, brom_fdn: brom.fdn ? +brom.fdn : null,
        brom_fda: brom.fda ? +brom.fda : null, brom_almidon: brom.alm ? +brom.alm : null,
        brom_humedad: brom.hum ? +brom.hum : null, brom_dmo: brom.dmo ? +brom.dmo : null,
        brom_energia: brom.en ? +brom.en : null, brom_cenizas: brom.cen ? +brom.cen : null,
        brom_grasa: brom.gc ? +brom.gc : null, brom_laboratorio: brom.lab || null,
      } : {})
    })

    if (error) { toast('Error: ' + error.message, false); return }
    toast(esPerene ? `Corte #${numCorte} guardado` : 'Cosecha guardada')
    setForm(f => ({ ...f, kilos:'', ms:'', pv:'', cc:'', ot:'' }))
    setBrom({ pc:'',fdn:'',fda:'',alm:'',hum:'',dmo:'',en:'',cen:'',gc:'',lab:'' })
    load()
  }

  async function updateCosecha() {
    if (!edit) return; setSaving(true)
    const ha  = areas.find(a => a.id === edit.area_id)?.sup || edit.areas?.sup || 1
    const kg  = parseFloat(edit.kilos_totales) || 0
    const rh  = parseFloat((kg / 1000 / ha).toFixed(4))
    await sb.from('cosechas').update({
      fecha: edit.fecha, kilos_totales: kg, rendimiento: rh,
      ms_pct: edit.ms_pct || null, precio: parseFloat(edit.precio) || 0,
      notas: edit.notas || null,
    }).eq('id', edit.id)
    setSaving(false); setEdit(null); toast('Actualizado'); load()
  }

  async function del(id) { await sb.from('cosechas').delete().eq('id', id); toast('Eliminado'); load() }

  if (loading) return <Spinner />

  const cosechasFil = cosechas.filter(c =>
    (!fRancho || c.areas?.rancho === fRancho) && (!fArea || c.area_id === fArea)
  )
  const areasAlfalfa = areas.filter(a => CULTIVOS_PERENES.includes(a.cultivo))
  const prevIng = rendimiento && selArea ? (rendimiento * selArea.sup * (parseFloat(form.pv) || 0)) : 0

  return (
    <>
      {/* ── Formulario ── */}
      <div className="card">
        <div className="ct"><i className="ti ti-basket"></i>
          {esPerene ? `Registrar Corte #${numCorteActual()} — ${selArea?.cultivo}` : 'Registrar Cosecha'}
        </div>

        {esPerene && selArea && (
          <div className="al info" style={{ marginBottom: 10 }}>
            <i className="ti ti-info-circle"></i>
            Actividades desde <strong>{fmtFecha(fechaUltimoCorte()) || 'inicio'}</strong> hasta la fecha del corte se suman automáticamente.
          </div>
        )}

        <div className="fr c3">
          <div className="fg"><label>Rancho</label>
            <select value={form.rancho} onChange={e => { set('rancho', e.target.value); set('areaId', '') }}>
              <option value="">— Rancho —</option>
              {Object.entries(RANCHOS).map(([k, r]) => <option key={k} value={k}>{r.nombre}</option>)}
            </select></div>
          <div className="fg"><label>Área</label>
            <select value={form.areaId} onChange={e => set('areaId', e.target.value)}>
              <option value="">— Área —</option>
              {areasR.map(a => <option key={a.id} value={a.id}>
                {a.tipo} {a.denom}{a.variedad ? ' — ' + a.variedad : ''}
                {CULTIVOS_PERENES.includes(a.cultivo) ? ' 🌿' : ''}
              </option>)}
            </select></div>
          <div className="fg"><label>Fecha</label>
            <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} /></div>
        </div>

        <div className="sdiv">Producción</div>
        <div className="fr c4">
          <div className="fg">
            <label>Kilos totales cosechados</label>
            <input type="number" value={form.kilos} onChange={e => set('kilos', e.target.value)} step="1" placeholder="250000" />
          </div>
          <div className="fg">
            <label>Ton/ha calculado</label>
            <input readOnly value={rendimiento != null ? rendimiento + ' t/ha' : ''} style={{ background:'var(--cgx)', fontWeight: 600 }} />
          </div>
          <div className="fg"><label>% Materia Seca</label>
            <input type="number" value={form.ms} onChange={e => set('ms', e.target.value)} step="0.01" /></div>
          <div className="fg"><label>Precio venta ($/ton)</label>
            <input type="number" value={form.pv} onChange={e => set('pv', e.target.value)} step="0.01" /></div>
        </div>

        {rendimiento && selArea && (
          <div className="al ok">
            <i className="ti ti-calculator"></i>
            {fmx(parseFloat(form.kilos))} kg totales ÷ 1000 ÷ {selArea.sup} ha = <strong>{rendimiento} ton/ha</strong>
            {prevIng > 0 && <> · Ingresos estimados: <strong>${fmx(prevIng, 2)}</strong></>}
          </div>
        )}

        {verCostos && <>
          <div className="sdiv">Costos adicionales</div>
          <div className="fr c2">
            <div className="fg"><label>Cosecha ($)</label>
              <input type="number" value={form.cc} onChange={e => set('cc', e.target.value)} step="0.01" /></div>
            <div className="fg"><label>Otros costos ($)</label>
              <input type="number" value={form.ot} onChange={e => set('ot', e.target.value)} step="0.01" /></div>
          </div>
          <div className="al info">
            <i className="ti ti-info-circle"></i>
            El flete y demás costos generales se prorratean automáticamente desde Costos Generales. El costo de semilla se toma del área.
          </div>
        </>}

        <div className="sdiv">Análisis Bromatológico (opcional)</div>
        <div className="fr c4">
          <div className="fg"><label>Proteína cruda (%)</label><input type="number" value={brom.pc} onChange={e => setB('pc', e.target.value)} step="0.01" /></div>
          <div className="fg"><label>FDN (%)</label><input type="number" value={brom.fdn} onChange={e => setB('fdn', e.target.value)} step="0.01" /></div>
          <div className="fg"><label>FDA (%)</label><input type="number" value={brom.fda} onChange={e => setB('fda', e.target.value)} step="0.01" /></div>
          <div className="fg"><label>Almidón (%)</label><input type="number" value={brom.alm} onChange={e => setB('alm', e.target.value)} step="0.01" /></div>
        </div>
        <div className="fr c4">
          <div className="fg"><label>Humedad (%)</label><input type="number" value={brom.hum} onChange={e => setB('hum', e.target.value)} step="0.01" /></div>
          <div className="fg"><label>Digestibilidad MO (%)</label><input type="number" value={brom.dmo} onChange={e => setB('dmo', e.target.value)} step="0.01" /></div>
          <div className="fg"><label>Energía neta (Mcal/kg MS)</label><input type="number" value={brom.en} onChange={e => setB('en', e.target.value)} step="0.001" /></div>
          <div className="fg"><label>Cenizas (%)</label><input type="number" value={brom.cen} onChange={e => setB('cen', e.target.value)} step="0.01" /></div>
        </div>
        <div className="fr c2">
          <div className="fg"><label>Grasa cruda (%)</label><input type="number" value={brom.gc} onChange={e => setB('gc', e.target.value)} step="0.01" /></div>
          <div className="fg"><label>Laboratorio / Folio</label><input value={brom.lab} onChange={e => setB('lab', e.target.value)} /></div>
        </div>

        <div className="br-row">
          <button className="btn pr" onClick={calcAndSave} disabled={saving}>
            {saving ? <><i className="ti ti-loader"></i> Guardando…</> : <><i className="ti ti-device-floppy"></i> Guardar {esPerene ? 'corte' : 'cosecha'}</>}
          </button>
        </div>
      </div>

      {/* ── Resumen alfalfa ── */}
      {areasAlfalfa.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="ct"><i className="ti ti-plant"></i>Resumen acumulado — Alfalfa</div>
          {areasAlfalfa.map(area => {
            const cortes = cosechas.filter(c => c.area_id === area.id).sort((a, b) => a.fecha.localeCompare(b.fecha))
            if (!cortes.length) return null
            const totIng  = cortes.reduce((s, c) => s + (+c.ingresos || 0), 0)
            const totCost = cortes.reduce((s, c) => s + (+c.costo_total || 0), 0)
            const totKg   = cortes.reduce((s, c) => s + (+c.kilos_totales || 0), 0)
            return (
              <div key={area.id} style={{ marginBottom: 14, borderBottom:'1px solid var(--cn)', paddingBottom: 14 }}>
                <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 10, flexWrap:'wrap' }}>
                  <RanchoChip r={area.rancho} /><TipoChip t={area.tipo} />
                  <strong>{area.denom}</strong>
                  {area.variedad && <span className="badge badge-ok">{area.variedad}</span>}
                  <span className="badge badge-info">{cortes.length} cortes</span>
                  <span style={{ fontSize: 11, color:'var(--ct)' }}>Siembra: {fmtFecha(area.siembra)}</span>
                </div>
                {verCostos && (
                  <div className="g4" style={{ marginBottom: 10 }}>
                    <div className="met"><div className="ml">Kg totales</div><div className="mv">{fmx(totKg)}</div></div>
                    <div className="met gr"><div className="ml">Ingresos totales</div><div className="mv">${fmx(totIng)}</div></div>
                    <div className="met"><div className="ml">Costo total</div><div className="mv" style={{ color:'var(--cr)' }}>${fmx(totCost)}</div></div>
                    <div className={`met ${totIng-totCost>=0?'gr':'rd'}`}><div className="ml">Utilidad total</div><div className="mv">${fmx(totIng-totCost)}</div></div>
                  </div>
                )}
                <div className="tw"><table><thead><tr>
                  <th>Corte</th><th>Fecha</th><th>Kg totales</th><th>t/ha</th><th>MS%</th>
                  {verCostos && <><th>Ingresos</th><th>Costo</th><th>Utilidad</th><th>$/ha</th><th>$/kg MS</th></>}
                  <th>Brom.</th><th></th>
                </tr></thead><tbody>
                {cortes.map((c, i) => (
                  <tr key={c.id} style={{ background: i%2===0?'var(--cc)':'#fff' }}>
                    <td><span className="badge badge-info">Corte #{c.num_corte||i+1}</span></td>
                    <td style={{ fontFamily:'IBM Plex Mono', fontSize:11 }}>{fmtFecha(c.fecha)}</td>
                    <td style={{ fontFamily:'IBM Plex Mono' }}>{fmx(c.kilos_totales||0)}</td>
                    <td style={{ fontFamily:'IBM Plex Mono' }}>{c.rendimiento}</td>
                    <td>{c.ms_pct||'—'}%</td>
                    {verCostos && <>
                      <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(c.ingresos)}</td>
                      <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(c.costo_total)}</td>
                      <td style={{ fontFamily:'IBM Plex Mono', color:c.utilidad>=0?'var(--cg)':'var(--cr)' }}>${fmx(c.utilidad)}</td>
                      <td style={{ fontFamily:'IBM Plex Mono', fontSize:11 }}>${fmx(c.costo_ha,0)}</td>
                      <td style={{ fontFamily:'IBM Plex Mono', fontSize:11 }}>${fmx(c.costo_kg_ms,4)}</td>
                    </>}
                    <td>{c.brom_pc!=null?<button className="btn sm" onClick={()=>setVerBromC(c)}><i className="ti ti-microscope"></i></button>:'—'}</td>
                    <td style={{ display:'flex', gap:3 }}>
                      <button className="btn sm" onClick={()=>setEdit({...c})}><i className="ti ti-edit"></i></button>
                      <button className="btn sm dg" onClick={()=>del(c.id)}><i className="ti ti-trash"></i></button>
                    </td>
                  </tr>
                ))}
                </tbody></table></div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Historial general ── */}
      <div className="card">
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end', marginBottom:12 }}>
          <div className="fg" style={{ minWidth:130 }}><label>Rancho</label>
            <select value={fRancho} onChange={e=>{setFRancho(e.target.value);setFArea('')}}>
              <option value="">Todos</option>
              {Object.entries(RANCHOS).map(([k,r])=><option key={k} value={k}>{r.nombre}</option>)}
            </select></div>
          <div className="fg" style={{ minWidth:160 }}><label>Área</label>
            <select value={fArea} onChange={e=>setFArea(e.target.value)}>
              <option value="">Todas</option>
              {areas.filter(a=>!fRancho||a.rancho===fRancho).map(a=>(
                <option key={a.id} value={a.id}>{RANCHOS[a.rancho]?.nombre} · {a.tipo} {a.denom}</option>
              ))}
            </select></div>
          <button className="btn sm" onClick={()=>{setFRancho('');setFArea('')}}><i className="ti ti-x"></i></button>
        </div>
        <div className="ct"><i className="ti ti-list"></i>Historial ({cosechasFil.length})</div>
        {!cosechasFil.length
          ? <div className="empty"><i className="ti ti-basket-off"></i><p>Sin cosechas</p></div>
          : <div className="tw"><table><thead><tr>
              <th>Fecha</th><th>Rancho</th><th>Área</th><th>Corte</th><th>Variedad</th>
              <th>Kg totales</th><th>t/ha</th><th>MS%</th>
              {verCostos && <><th>Ingresos</th><th>Costo</th><th>Utilidad</th><th>$/ha</th><th>$/kg húm.</th><th>$/kg MS</th></>}
              <th>Brom.</th><th></th>
            </tr></thead><tbody>
            {cosechasFil.map(c => (
              <tr key={c.id}>
                <td style={{ fontFamily:'IBM Plex Mono', fontSize:11 }}>{fmtFecha(c.fecha)}</td>
                <td>{c.areas?<RanchoChip r={c.areas.rancho}/>:'—'}</td>
                <td>{c.areas?<TipoChip t={c.areas.tipo}/>:null} {c.areas?.denom}</td>
                <td>{c.num_corte?<span className="badge badge-info">Corte #{c.num_corte}</span>:<span className="badge badge-ok">Cosecha</span>}</td>
                <td>{c.areas?.variedad||'—'}</td>
                <td style={{ fontFamily:'IBM Plex Mono' }}>{fmx(c.kilos_totales||0)}</td>
                <td style={{ fontFamily:'IBM Plex Mono' }}>{c.rendimiento}</td>
                <td>{c.ms_pct||'—'}%</td>
                {verCostos && <>
                  <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(c.ingresos)}</td>
                  <td style={{ fontFamily:'IBM Plex Mono' }}>${fmx(c.costo_total)}</td>
                  <td style={{ fontFamily:'IBM Plex Mono', color:c.utilidad>=0?'var(--cg)':'var(--cr)' }}>${fmx(c.utilidad)}</td>
                  <td style={{ fontFamily:'IBM Plex Mono', fontSize:11 }}>${fmx(c.costo_ha,0)}</td>
                  <td style={{ fontFamily:'IBM Plex Mono', fontSize:11 }}>${fmx(c.costo_kg_humedo,4)}</td>
                  <td style={{ fontFamily:'IBM Plex Mono', fontSize:11 }}>${fmx(c.costo_kg_ms,4)}</td>
                </>}
                <td>{c.brom_pc!=null?<button className="btn sm" onClick={()=>setVerBromC(c)}><i className="ti ti-microscope"></i></button>:'—'}</td>
                <td style={{ display:'flex', gap:3 }}>
                  <button className="btn sm" onClick={()=>setEdit({...c})}><i className="ti ti-edit"></i></button>
                  <button className="btn sm dg" onClick={()=>del(c.id)}><i className="ti ti-trash"></i></button>
                </td>
              </tr>
            ))}
            </tbody></table></div>}
      </div>

      {/* ── Modal editar cosecha ── */}
      {edit && (
        <Modal title="Editar cosecha / corte" onClose={()=>setEdit(null)}>
          <div className="fr c2">
            <div className="fg"><label>Fecha</label>
              <input type="date" value={edit.fecha||''} onChange={e=>setE('fecha',e.target.value)}/></div>
            <div className="fg"><label>Kilos totales</label>
              <input type="number" value={edit.kilos_totales||''} onChange={e=>setE('kilos_totales',e.target.value)} step="1"/></div>
          </div>
          <div className="fr c3">
            <div className="fg"><label>% Materia Seca</label>
              <input type="number" value={edit.ms_pct||''} onChange={e=>setE('ms_pct',e.target.value)} step="0.01"/></div>
            <div className="fg"><label>Precio ($/ton)</label>
              <input type="number" value={edit.precio||''} onChange={e=>setE('precio',e.target.value)} step="0.01"/></div>
            <div className="fg"><label>Notas</label>
              <input value={edit.notas||''} onChange={e=>setE('notas',e.target.value)}/></div>
          </div>
          <div className="br-row" style={{ justifyContent:'flex-end' }}>
            <button className="btn" onClick={()=>setEdit(null)}>Cancelar</button>
            <button className="btn pr" onClick={updateCosecha} disabled={saving}><i className="ti ti-check"></i> Actualizar</button>
          </div>
        </Modal>
      )}

      {/* ── Modal bromatología ── */}
      {verBromC && (
        <Modal title={'Bromatología — '+(verBromC.areas?.denom||'')+(verBromC.num_corte?' Corte #'+verBromC.num_corte:'')} onClose={()=>setVerBromC(null)}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:8 }}>
            {[['Proteína cruda',verBromC.brom_pc,'%'],['FDN',verBromC.brom_fdn,'%'],['FDA',verBromC.brom_fda,'%'],
              ['Almidón',verBromC.brom_almidon,'%'],['Humedad',verBromC.brom_humedad,'%'],['Digest. MO',verBromC.brom_dmo,'%'],
              ['EN',verBromC.brom_energia,'Mcal/kg MS'],['Cenizas',verBromC.brom_cenizas,'%'],['Grasa',verBromC.brom_grasa,'%']
            ].filter(([,v])=>v!=null).map(([k,v,u])=>(
              <div key={k} style={{ background:'var(--cc)', border:'1px solid var(--cn)', borderRadius:'var(--r)', padding:8, textAlign:'center' }}>
                <div style={{ fontSize:10, color:'var(--cs)', textTransform:'uppercase', marginBottom:3 }}>{k}</div>
                <div style={{ fontSize:17, fontWeight:500, fontFamily:'IBM Plex Mono' }}>{v}</div>
                <div style={{ fontSize:10, color:'var(--ct)' }}>{u}</div>
              </div>
            ))}
          </div>
          {verBromC.brom_laboratorio&&<p style={{ marginTop:10, fontSize:12, color:'var(--cs)' }}>{verBromC.brom_laboratorio}</p>}
          <div className="br-row" style={{ justifyContent:'flex-end', marginTop:10 }}>
            <button className="btn" onClick={()=>setVerBromC(null)}>Cerrar</button>
          </div>
        </Modal>
      )}
    </>
  )
}
