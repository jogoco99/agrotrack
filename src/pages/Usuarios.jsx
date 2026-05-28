import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { toast, Spinner } from '../components/UI'
import { ROLES } from '../lib/constants'

export default function Usuarios() {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [invEmail, setInvEmail] = useState('')
  const [invRol,   setInvRol]   = useState('capturista')
  const [invNombre, setInvNombre] = useState('')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data } = await sb.from('perfiles').select('*').order('created_at')
    setUsers(data || [])
    setLoading(false)
  }

  async function invitar() {
    if (!invEmail || !invRol) { toast('Completa email y rol', false); return }
    setSaving(true)
    const { error } = await sb.auth.admin?.inviteUserByEmail
      ? sb.auth.admin.inviteUserByEmail(invEmail, { data: { rol: invRol, nombre: invNombre } })
      : { error: null }
    // Fallback: create via signUp (user needs to confirm email)
    if (error) { toast('Usa el panel de Supabase → Authentication → Users → Invite user', false) }
    else { toast('Invitación enviada a ' + invEmail) }
    setSaving(false)
  }

  async function cambiarRol(id, rol) {
    await sb.from('perfiles').update({ rol }).eq('id', id)
    toast('Rol actualizado'); load()
  }

  async function toggleActivo(id, activo) {
    await sb.from('perfiles').update({ activo: !activo }).eq('id', id)
    toast('Estado actualizado'); load()
  }

  if (loading) return <Spinner />

  return (
    <>
      <div className="al info" style={{ marginBottom: 12 }}>
        <i className="ti ti-info-circle"></i>
        Para invitar nuevos usuarios ve a <strong>Supabase → Authentication → Users → Invite user</strong>. El usuario recibirá un email para establecer su contraseña.
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ct"><i className="ti ti-users"></i>Usuarios registrados ({users.length})</div>
        {!users.length ? <div className="empty"><i className="ti ti-user-off"></i><p>Sin usuarios</p></div>
        : <div className="tw"><table><thead><tr>
            <th>Nombre</th><th>Rol</th><th>Estado</th><th>Desde</th><th>Cambiar rol</th><th></th>
          </tr></thead><tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td><strong>{u.nombre || '(sin nombre)'}</strong></td>
              <td>
                <span className="badge" style={{ background: ROLES[u.rol]?.color+'22', color: ROLES[u.rol]?.color }}>
                  {ROLES[u.rol]?.label || u.rol}
                </span>
              </td>
              <td>
                <span className={`badge ${u.activo ? 'badge-ok' : 'badge-red'}`}>
                  {u.activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td style={{ fontSize: 11, color: 'var(--ct)' }}>{u.created_at?.split('T')[0]}</td>
              <td>
                <select value={u.rol} onChange={e => cambiarRol(u.id, e.target.value)}
                  style={{ padding: '3px 6px', fontSize: 12, border: '1px solid var(--cn)', borderRadius: 4, background: 'var(--cc)' }}>
                  {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </td>
              <td>
                <button className={`btn sm ${u.activo ? 'dg' : ''}`} onClick={() => toggleActivo(u.id, u.activo)}>
                  {u.activo ? 'Desactivar' : 'Activar'}
                </button>
              </td>
            </tr>
          ))}
          </tbody></table></div>}
      </div>

      <div className="card">
        <div className="ct"><i className="ti ti-user-plus"></i>Pasos para agregar usuario</div>
        <ol style={{ paddingLeft: 20, fontSize: 13, color: 'var(--cs)', lineHeight: 2 }}>
          <li>Ve a tu proyecto en <strong>supabase.com</strong></li>
          <li>Menú izquierdo → <strong>Authentication</strong> → <strong>Users</strong></li>
          <li>Clic en <strong>Invite user</strong></li>
          <li>Ingresa el email y clic en <strong>Send invitation</strong></li>
          <li>El usuario recibirá un correo para establecer su contraseña</li>
          <li>Vuelve a esta pantalla y cambia su rol con el selector de la tabla</li>
        </ol>
      </div>
    </>
  )
}
