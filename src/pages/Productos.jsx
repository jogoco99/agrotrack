import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { Modal, toast, Spinner, fmx } from '../components/UI'

const CAT = ['fertilizante','herbicida','insecticida','semilla']
const empty = { nombre:'', categoria:'', precio:'', unidad:'kg', semillas_saco:'', desc:'', proveedor:'' }

export default function Productos() {
  const [prods,  setProds]  = useState([])
  const [loading,setLoading]= useState(true)
  const [form,   setForm]   = useState(empty)
  const [edit,   setEdit]   = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data } = await sb.from('productos').select('*').eq('activo', true).order('categoria').order('nombre')
    setProds(data || [])
    setLoading(false)
  }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function setE(k, v) { setEdit(e => ({ ...e, [k]: v })) }

  async function save() {
    if (!form.nombre || !form.categoria || !form.precio) { toast('Completa nombre, categoría y precio', false); return }
    setSaving(true)
    const { error } = await sb.from('productos').insert({
      nombre: form.nombre.trim(), categoria: form.categoria, precio: parseFloat(form.precio),
      unidad: form.unidad,
      semillas_saco: form.semillas_saco ? parseInt(form.semillas_saco) : null,
      descripcion: form.desc.trim() || null, proveedor: form.proveedor.trim() || null,
    })
    setSaving(false)
    if (error) { toast('Error: ' + error.message, false); return }
    toast('Producto guardado'); setForm(empty); load()
  }

  async function update() {
    if (!edit) return; setSaving(true)
    await sb.from('productos').update({
      nombre: edit.nombre, categoria: edit.categoria, precio: parseFloat(edit.precio),
      unidad: edit.unidad,
      semillas_saco: edit.semillas_saco ? parseInt(edit.semillas_saco) : null,
      descripcion: edit.descripcion || null, proveedor: edit.proveedor || null,
    }).eq('id', edit.id)
    setSaving(false); setEdit(null); toast('Actualizado'); load()
  }

  async function del(id) {
    await sb.from('productos').update({ activo: false }).eq('id', id)
    toast('Eliminado'); load()
  }

  if (loading) return <Spinner />

  const esSemilla = form.categoria === 'semilla'

  return (
    <>
      <div className="card">
        <div className="ct"><i className="ti ti-plus"></i>Agregar insumo / semilla</div>
        <div className="fr c4">
          <div className="fg"><label>Nombre</label>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Urea 46%, Semilla AS-1633…" /></div>
          <div className="fg"><label>Categoría</label>
            <select value={form.categoria} onChange={e => set('categoria', e.target.value)}>
              <option value="">— Categoría —</option>
              {CAT.map(c => <option key={c}>{c}</option>)}
            </select></div>
          <div className="fg"><label>Precio unitario</label>
            <input type="number" value={form.precio} onChange={e => set('precio', e.target.value)} step="0.01" min="0" /></div>
          <div className="fg"><label>Unidad</label>
            <select value={form.unidad} onChange={e => set('unidad', e.target.value)}>
              {['kg','L','ton','saco','pza','semillas'].map(u => <option key={u}>{u}</option>)}
            </select></div>
        </div>
        {esSemilla && (
          <div className="fr c2">
            <div className="fg">
              <label>Semillas por saco</label>
              <input type="number" value={form.semillas_saco} onChange={e => set('semillas_saco', e.target.value)} placeholder="80000" step="1000" />
              <span style={{ fontSize: 10, color: 'var(--ct)', marginTop: 2 }}>Para calcular sacos necesarios según densidad de siembra</span>
            </div>
            <div className="fg"><label>Presentación / lote</label>
              <input value={form.desc} onChange={e => set('desc', e.target.value)} placeholder="Bolsa 80k semillas, tratada…" /></div>
          </div>
        )}
        <div className="fr c2">
          {!esSemilla && <div className="fg"><label>Presentación</label>
            <input value={form.desc} onChange={e => set('desc', e.target.value)} placeholder="Bolsa 50kg…" /></div>}
          <div className="fg"><label>Proveedor</label>
            <input value={form.proveedor} onChange={e => set('proveedor', e.target.value)} /></div>
        </div>
        <div className="br-row">
          <button className="btn pr" onClick={save} disabled={saving}>
            {saving ? <><i className="ti ti-loader"></i> Guardando…</> : <><i className="ti ti-device-floppy"></i> Guardar</>}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="ct"><i className="ti ti-package"></i>Catálogo ({prods.length})</div>
        {!prods.length
          ? <div className="empty"><i className="ti ti-package-off"></i><p>Sin productos.</p></div>
          : <div className="tw"><table><thead><tr>
              <th>Nombre</th><th>Categoría</th><th>Precio</th><th>Unidad</th><th>Semillas/saco</th><th>Proveedor</th><th></th>
            </tr></thead><tbody>
            {prods.map(p => (
              <tr key={p.id}>
                <td><strong>{p.nombre}</strong></td>
                <td><span className={`badge ${p.categoria === 'fertilizante' ? 'badge-ok' : p.categoria === 'herbicida' ? 'badge-warn' : p.categoria === 'semilla' ? 'badge-info' : 'badge-red'}`}>{p.categoria}</span></td>
                <td style={{ fontFamily: 'IBM Plex Mono' }}>${fmx(p.precio, 2)}</td>
                <td>{p.unidad}</td>
                <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{p.semillas_saco ? fmx(p.semillas_saco) : '—'}</td>
                <td>{p.proveedor || '—'}</td>
                <td style={{ display: 'flex', gap: 4 }}>
                  <button className="btn sm" onClick={() => setEdit({ ...p })}><i className="ti ti-edit"></i></button>
                  <button className="btn sm dg" onClick={() => del(p.id)}><i className="ti ti-trash"></i></button>
                </td>
              </tr>
            ))}
            </tbody></table></div>}
      </div>

      {edit && (
        <Modal title={'Editar: ' + edit.nombre} onClose={() => setEdit(null)}>
          <div className="fr c2">
            <div className="fg"><label>Nombre</label><input value={edit.nombre} onChange={e => setE('nombre', e.target.value)} /></div>
            <div className="fg"><label>Categoría</label>
              <select value={edit.categoria} onChange={e => setE('categoria', e.target.value)}>
                {CAT.map(c => <option key={c}>{c}</option>)}
              </select></div>
          </div>
          <div className="fr c3">
            <div className="fg"><label>Precio</label><input type="number" value={edit.precio} onChange={e => setE('precio', e.target.value)} step="0.01" /></div>
            <div className="fg"><label>Unidad</label>
              <select value={edit.unidad} onChange={e => setE('unidad', e.target.value)}>
                {['kg','L','ton','saco','pza','semillas'].map(u => <option key={u}>{u}</option>)}
              </select></div>
            {edit.categoria === 'semilla' && (
              <div className="fg"><label>Semillas/saco</label><input type="number" value={edit.semillas_saco || ''} onChange={e => setE('semillas_saco', e.target.value)} /></div>
            )}
          </div>
          <div className="br-row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setEdit(null)}>Cancelar</button>
            <button className="btn pr" onClick={update} disabled={saving}><i className="ti ti-check"></i> Actualizar</button>
          </div>
        </Modal>
      )}
    </>
  )
}
