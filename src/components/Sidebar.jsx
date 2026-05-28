import { useAuth } from '../hooks/useAuth'
import { PAGES_BY_ROL } from '../lib/constants'

const NAV = [
  { section: 'General', items: [
    { id: 'dashboard',    icon: 'ti-dashboard',        label: 'Dashboard' },
    { id: 'tareas',       icon: 'ti-bell',             label: 'Tareas Pendientes' },
    { id: 'riegos',       icon: 'ti-droplet',          label: 'Consulta Riegos' },
  ]},
  { section: 'Cultivo', items: [
    { id: 'areas',        icon: 'ti-map-2',            label: 'Áreas' },
    { id: 'actividades',  icon: 'ti-clipboard-list',   label: 'Actividades' },
    { id: 'programacion', icon: 'ti-calendar-plus',    label: 'Programación' },
  ]},
  { section: 'Insumos', items: [
    { id: 'productos',       icon: 'ti-package',          label: 'Catálogo Insumos' },
    { id: 'costos_generales',icon: 'ti-cash',             label: 'Costos Generales' },
    { id: 'maquinaria',      icon: 'ti-tractor',          label: 'Maquinaria / Equipo' },
    { id: 'importar',        icon: 'ti-file-spreadsheet', label: 'Importar' },
    { id: 'exportar',        icon: 'ti-table-export',      label: 'Exportar Excel' },
  ]},
  { section: 'Cosecha', items: [
    { id: 'cosecha',      icon: 'ti-basket',           label: 'Cosechas' },
    { id: 'bromatologia', icon: 'ti-microscope',       label: 'Bromatología' },
    { id: 'rentabilidad', icon: 'ti-report-money',     label: 'Rentabilidad' },
  ]},
  { section: 'Consultas', items: [
    { id: 'consulta',     icon: 'ti-id-badge',         label: 'Ficha por Área' },
    { id: 'analisis',     icon: 'ti-chart-bar',        label: 'Comparativas' },
  ]},
  { section: 'Sistema', items: [
    { id: 'configuracion',icon: 'ti-settings',         label: 'Configuración' },
    { id: 'usuarios',     icon: 'ti-users',            label: 'Usuarios' },
  ]},
]

export default function Sidebar({ page, onNav }) {
  const { perfil, signOut } = useAuth()
  const allowed = PAGES_BY_ROL[perfil?.rol] || []

  return (
    <nav className="sb">
      <div className="sb-logo">
        <h1>AgroTrack</h1>
        <div className="sb-rol">{perfil?.rol || '—'}</div>
      </div>

      {NAV.map(sec => {
        const visible = sec.items.filter(i => allowed.includes(i.id))
        if (!visible.length) return null
        return (
          <div className="ns" key={sec.section}>
            <div className="nst">{sec.section}</div>
            {visible.map(item => (
              <button key={item.id} className={`ni ${page === item.id ? 'active' : ''}`} onClick={() => onNav(item.id)}>
                <i className={`ti ${item.icon}`}></i>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )
      })}

      <div className="sb-footer">
        <div style={{ fontSize: 11, color:'var(--ct)', marginBottom: 6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {perfil?.nombre}
        </div>
        <button className="btn sm" style={{ width:'100%', color:'var(--ct)', background:'transparent', borderColor:'rgba(200,149,108,.3)' }} onClick={signOut}>
          <i className="ti ti-logout"></i> <span>Salir</span>
        </button>
      </div>
    </nav>
  )
}
