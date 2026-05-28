import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { Modal, RanchoChip, TipoChip, toast, Spinner, fmx, fmtFecha } from '../components/UI'
import { RANCHOS, CULTIVOS, TEMPORADAS, CULTIVOS_PERENES } from '../lib/constants'

const empty = { rancho:'', tipo:'', denom:'', sup:'', cultivo:'', variedad:'', temporada:'', siembra:'', densidad:'', semillaId:'', notas:'' }

export default function Areas() {
  const [areas,   setAreas]   = useState([])
  const [prods,   setProds]   = useState([])
  const [loading, setLoading] = useState(true)
  const [form,    setForm]    = useState(empty)
  const [edit,    setEdit]    = useState(null)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [{ data: a }, { data: p }] = await Promise.all([
      sb.from('areas').select('*, productos(nombre,precio,semillas_saco)').eq('activa', true).order('rancho').order('tipo').order('denom'),
      sb.from('productos').select('*').eq('activo', true).eq('categoria', 'semilla'),
    ])
    setAreas(a || []); setProds(p || [])
    setLoading(false)
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function setE(k, v) { setEdit(e => ({ ...e, [k]: v })) }

  const tiposDisp = form.rancho ? (RANCHOS[form.rancho]?.tipos || []) : []
  const esPerene  = CULTIVOS_PERENES.includes(form.cultivo)

  // Cálculo automático costo semilla
  function calcCostoSemilla(semillaId, densidad, sup) {
    const prod = prods.find(p => p.id === semillaId)
    if (!prod || !densidad || !sup || !prod.semillas_saco || !prod.precio) return null
    const costo = sup * densidad * (prod.precio / prod.semillas_saco)
    return parseFloat(costo.toFixed(2))
  }

  const prevCostoSemilla = calcCostoSemilla(form.semillaId, parseFloat(form.densidad), parseFloat(form.sup))
  const editCostoSemilla = edit ? calcCostoSemilla(edit.semilla_id, parseFloat(edit.densidad_semilla), parseFloat(edit.sup)) : null

  async function save() {
    if (!form.rancho || !form.tipo || !form.denom || !form.sup) { toast('Completa rancho, tipo, ID y hectáreas', false); return }
    setSaving(true)
    const costoSemilla = calcCostoSemilla(form.semillaId, parseFloat(form.densidad), parseFloat(form.sup))
    const { error } = await sb.from('areas').insert({
      rancho: form.rancho, tipo: form.tipo, denom: form.denom.trim(), sup: parseFloat(form.sup),
      cultivo: form.cultivo || null, variedad: form.variedad?.trim() || null,
      temporada: esPerene ? null : (form.temporada || null),
      siembra: form.siembra || null,
      densidad_semilla: form.densidad ? parseFloat(form.densidad) : null,
      semilla_id: form.semillaId || null,
      costo_semilla: costoSemilla,
      notas: form.notas?.trim() || null,
      perene: esPerene,
    })
    setSaving(false)
    if (error) { toast('Error: ' + error.message, false); return }
    toast('Área guardada'); setForm(empty); load()
  }

  async function update() {
    if (!edit) return; setSaving(true)
    const costoSemilla = calcCostoSemilla(edit.semilla_id, parseFloat(edit.densidad_semilla), parseFloat(edit.sup))
    const { error } = await sb.from('areas').update({
      rancho: edit.rancho, tipo: edit.tipo, denom: edit.denom, sup: parseFloat(edit.sup),
      cultivo: edit.cultivo || null, variedad: edit.variedad || null,
      temporada: CULTIVOS_PERENES.includes(edit.cultivo) ? null : (edit.temporada || null),
      siembra: edit.siembra || null,
      densidad_semilla: edit.densidad_semilla ? parseFloat(edit.densidad_semilla) : null,
      semilla_id: edit.semilla_id || null,
      costo_semilla: costoSemilla,
      notas: edit.notas || null,
    }).eq('id', edit.id)
    setSaving(false)
    if (error) { toast('Error: ' + error.message, false); return }
    toast('Área actualizada'); setEdit(null); load()
  }

  async function del(id) {
    await sb.from('areas').update({ activa: false }).eq('id', id)
    toast('Eliminado'); load()
  }

  if (loading) return <Spinner />

  return (
    <>
      {/* ── Formulario nueva área ── */}
      <div className="card">
        <div className="ct"><i className="ti ti-plus"></i>Nueva Área</div>
        <div className="fr c3">
          <div className="fg"><label>Rancho</label>
            <select value={form.rancho} onChange={e => set('rancho', e.target.value)}>
              <option value="">— Rancho —</option>
              {Object.entries(RANCHOS).map(([k, r]) => <option key={k} value={k}>{r.nombre}</option>)}
            </select></div>
          <div className="fg"><label>Tipo de área</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              <option value="">— Tipo —</option>
              {tiposDisp.map(t => <option key={t}>{t}</option>)}
            </select></div>
          <div className="fg"><label>Denominación / ID</label>
            <input value={form.denom} onChange={e => set('denom', e.target.value)} placeholder="P1, T3, C2…" /></div>
        </div>
        <div className="fr c4">
          <div className="fg"><label>Superficie (ha)</label>
            <input type="number" value={form.sup} onChange={e => set('sup', e.target.value)} step="0.1" min="0.1" /></div>
          <div className="fg"><label>Cultivo</label>
            <select value={form.cultivo} onChange={e => set('cultivo', e.target.value)}>
              <option value="">— Cultivo —</option>
              {CULTIVOS.map(c => <option key={c}>{c}</option>)}
            </select></div>
          <div className="fg"><label>Variedad</label>
            <input value={form.variedad || ''} onChange={e => set('variedad', e.target.value)} placeholder="AS-1633…" /></div>
          {!esPerene && (
            <div className="fg"><label>Temporada</label>
              <select value={form.temporada} onChange={e => set('temporada', e.target.value)}>
                <option value="">— Temporada —</option>
                {TEMPORADAS.map(t => <option key={t}>{t}</option>)}
              </select></div>
          )}
        </div>

        <div className="sdiv">Siembra y semilla</div>
        <div className="fr c3">
          <div className="fg"><label>Fecha de siembra</label>
            <input type="date" value={form.siembra} onChange={e => set('siembra', e.target.value)} /></div>
          <div className="fg"><label>Semilla sembrada</label>
            <select value={form.semillaId} onChange={e => set('semillaId', e.target.value)}>
              <option value="">— Selecciona semilla —</option>
              {prods.map(p => <option key={p.id} value={p.id}>{p.nombre} (${fmx(p.precio, 2)}/saco · {fmx(p.semillas_saco)} sem/saco)</option>)}
            </select>
            {prods.length === 0 && <span style={{ fontSize: 10, color:'var(--ca)' }}>Da de alta semillas en Catálogo de Insumos primero</span>}
          </div>
          <div className="fg"><label>Densidad (semillas/ha)</label>
            <input type="number" value={form.densidad} onChange={e => set('densidad', e.target.value)} placeholder="75000" step="1000" /></div>
        </div>

        {/* Preview costo semilla */}
        {prevCostoSemilla != null && (
          <div className="al ok">
            <i className="ti ti-calculator"></i>
            Costo de semilla calculado: <strong>${fmx(prevCostoSemilla, 2)}</strong>
            <span style={{ fontSize: 11, marginLeft: 8, opacity: .8 }}>
              ({fmx(parseFloat(form.sup))} ha × {fmx(parseFloat(form.densidad))} sem/ha × ${fmx(prods.find(p=>p.id===form.semillaId)?.precio,2)}/saco ÷ {fmx(prods.find(p=>p.id===form.semillaId)?.semillas_saco)} sem/saco)
            </span>
          </div>
        )}

        <div className="fg" style={{ marginTop: 10 }}><label>Notas</label>
          <input value={form.notas || ''} onChange={e => set('notas', e.target.value)} /></div>
        {esPerene && <div className="al info" style={{ marginTop: 8 }}><i className="ti ti-info-circle"></i>Cultivo perene — los cortes se registran como cosechas individuales.</div>}

        <div className="br-row">
          <button className="btn pr" onClick={save} disabled={saving}>
            {saving ? <><i className="ti ti-loader"></i> Guardando…</> : <><i className="ti ti-device-floppy"></i> Guardar</>}
          </button>
        </div>
      </div>

      {/* ── Tabla de áreas ── */}
      <div className="card">
        <div className="ct"><i className="ti ti-map-2"></i>Áreas ({areas.length})</div>
        {!areas.length
          ? <div className="empty"><i className="ti ti-map-off"></i><p>Sin áreas</p></div>
          : <div className="tw"><table><thead><tr>
              <th>Rancho</th><th>Tipo</th><th>ID</th><th>Ha</th><th>Cultivo</th><th>Variedad</th>
              <th>Temporada</th><th>Siembra</th><th>Semilla</th><th>Densidad</th><th>Costo semilla</th><th></th>
            </tr></thead><tbody>
            {areas.map(a => (
              <tr key={a.id}>
                <td><RanchoChip r={a.rancho} /></td>
                <td><TipoChip t={a.tipo} /></td>
                <td><strong>{a.denom}</strong>{a.perene && <span className="badge badge-ok" style={{ marginLeft: 4, fontSize: 9 }}>perene</span>}</td>
                <td style={{ fontFamily:'IBM Plex Mono' }}>{a.sup}</td>
                <td>{a.cultivo || '—'}</td>
                <td>{a.variedad || '—'}</td>
                <td>{a.temporada || '—'}</td>
                <td style={{ fontSize: 11 }}>{fmtFecha(a.siembra)}</td>
                <td style={{ fontSize: 11 }}>{a.productos?.nombre || '—'}</td>
                <td style={{ fontFamily:'IBM Plex Mono', fontSize: 11 }}>{a.densidad_semilla ? fmx(a.densidad_semilla) : '—'}</td>
                <td style={{ fontFamily:'IBM Plex Mono', fontSize: 11 }}>{a.costo_semilla ? '$' + fmx(a.costo_semilla, 2) : '—'}</td>
                <td style={{ display:'flex', gap: 4 }}>
                  <button className="btn sm" onClick={() => setEdit({ ...a, semilla_id: a.semilla_id || '' })}><i className="ti ti-edit"></i></button>
                  <button className="btn sm dg" onClick={() => del(a.id)}><i className="ti ti-trash"></i></button>
                </td>
              </tr>
            ))}
            </tbody></table></div>}
      </div>

      {/* ── Modal editar ── */}
      {edit && (
        <Modal title={'Editar: ' + RANCHOS[edit.rancho]?.nombre + ' · ' + edit.tipo + ' ' + edit.denom} onClose={() => setEdit(null)} wide>
          <div className="fr c3">
            <div className="fg"><label>Rancho</label>
              <select value={edit.rancho} onChange={e => setE('rancho', e.target.value)}>
                {Object.entries(RANCHOS).map(([k, r]) => <option key={k} value={k}>{r.nombre}</option>)}
              </select></div>
            <div className="fg"><label>Tipo</label>
              <select value={edit.tipo} onChange={e => setE('tipo', e.target.value)}>
                {(RANCHOS[edit.rancho]?.tipos || []).map(t => <option key={t}>{t}</option>)}
              </select></div>
            <div className="fg"><label>ID</label><input value={edit.denom} onChange={e => setE('denom', e.target.value)} /></div>
          </div>
          <div className="fr c3">
            <div className="fg"><label>Ha</label><input type="number" value={edit.sup} onChange={e => setE('sup', e.target.value)} step="0.1" /></div>
            <div className="fg"><label>Cultivo</label>
              <select value={edit.cultivo || ''} onChange={e => setE('cultivo', e.target.value)}>
                <option value="">—</option>
                {CULTIVOS.map(c => <option key={c}>{c}</option>)}
              </select></div>
            <div className="fg"><label>Variedad</label><input value={edit.variedad || ''} onChange={e => setE('variedad', e.target.value)} /></div>
          </div>
          <div className="fr c3">
            <div className="fg"><label>Temporada</label>
              <select value={edit.temporada || ''} onChange={e => setE('temporada', e.target.value)}>
                <option value="">—</option>
                {TEMPORADAS.map(t => <option key={t}>{t}</option>)}
              </select></div>
            <div className="fg"><label>Siembra</label><input type="date" value={edit.siembra || ''} onChange={e => setE('siembra', e.target.value)} /></div>
            <div className="fg"><label>Notas</label><input value={edit.notas || ''} onChange={e => setE('notas', e.target.value)} /></div>
          </div>
          <div className="sdiv">Semilla</div>
          <div className="fr c3">
            <div className="fg"><label>Semilla</label>
              <select value={edit.semilla_id || ''} onChange={e => setE('semilla_id', e.target.value)}>
                <option value="">— Sin semilla —</option>
                {prods.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select></div>
            <div className="fg"><label>Densidad (sem/ha)</label>
              <input type="number" value={edit.densidad_semilla || ''} onChange={e => setE('densidad_semilla', e.target.value)} step="1000" /></div>
            <div className="fg"><label>Costo semilla calculado</label>
              <input readOnly value={editCostoSemilla != null ? '$' + fmx(editCostoSemilla, 2) : '—'} style={{ background:'var(--cgx)' }} /></div>
          </div>
          <div className="br-row" style={{ justifyContent:'flex-end' }}>
            <button className="btn" onClick={() => setEdit(null)}>Cancelar</button>
            <button className="btn pr" onClick={update} disabled={saving}><i className="ti ti-check"></i> Actualizar</button>
          </div>
        </Modal>
      )}
    </>
  )
}
