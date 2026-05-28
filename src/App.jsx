import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { PAGES_BY_ROL } from './lib/constants'
import { Toast, Spinner } from './components/UI'
import Login    from './pages/Login'
import Sidebar  from './components/Sidebar'
import Dashboard     from './pages/Dashboard'
import Tareas        from './pages/Tareas'
import Riegos        from './pages/Riegos'
import Areas         from './pages/Areas'
import Actividades   from './pages/Actividades'
import Programacion  from './pages/Programacion'
import Productos     from './pages/Productos'
import CostosGenerales from './pages/CostosGenerales'
import Maquinaria    from './pages/Maquinaria'
import Importar      from './pages/Importar'
import Exportar      from './pages/Exportar'
import Cosecha       from './pages/Cosecha'
import Bromatologia  from './pages/Bromatologia'
import Rentabilidad  from './pages/Rentabilidad'
import Consulta      from './pages/Consulta'
import Analisis      from './pages/Analisis'
import Configuracion from './pages/Configuracion'
import Usuarios      from './pages/Usuarios'

const PAGE_TITLES = {
  dashboard:'Dashboard', tareas:'Tareas Pendientes', riegos:'Consulta de Riegos',
  areas:'Áreas de Cultivo', actividades:'Actividades', programacion:'Programación',
  productos:'Catálogo de Insumos', costos_generales:'Costos Generales',
  maquinaria:'Maquinaria y Equipo', importar:'Importar', exportar:'Exportar a Excel',
  cosecha:'Cosechas', bromatologia:'Bromatología', rentabilidad:'Rentabilidad',
  consulta:'Ficha por Área', analisis:'Comparativas',
  configuracion:'Configuración', usuarios:'Usuarios',
}

const PAGES = {
  dashboard:Dashboard, tareas:Tareas, riegos:Riegos,
  areas:Areas, actividades:Actividades, programacion:Programacion,
  productos:Productos, costos_generales:CostosGenerales,
  maquinaria:Maquinaria, importar:Importar, exportar:Exportar,
  cosecha:Cosecha, bromatologia:Bromatologia, rentabilidad:Rentabilidad,
  consulta:Consulta, analisis:Analisis, configuracion:Configuracion, usuarios:Usuarios,
}

export default function App() {
  const { user, perfil, loading } = useAuth()
  const [page, setPage] = useState('dashboard')

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--ce)' }}>
      <Spinner />
    </div>
  )
  if (!user || !perfil) return <><Login /><Toast /></>

  const allowed = PAGES_BY_ROL[perfil.rol] || []
  const safePage = allowed.includes(page) ? page : allowed[0] || 'dashboard'
  const PageComponent = PAGES[safePage] || Dashboard

  return (
    <>
      <Sidebar page={safePage} onNav={p => allowed.includes(p) && setPage(p)} />
      <main className="main">
        <div className="tb">
          <div className="tb-title">{PAGE_TITLES[safePage] || safePage}</div>
        </div>
        <div className="pg">
          <PageComponent onNav={p => allowed.includes(p) && setPage(p)} />
        </div>
      </main>
      <Toast />
    </>
  )
}
