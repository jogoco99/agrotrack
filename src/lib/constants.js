export const RANCHOS = {
  cantabra: { nombre: 'Cantabra',  tipos: ['Pivote','Tabla','Cintilla'], cls: 'rc-cantabra' },
  cortijo:  { nombre: 'Cortijo',   tipos: ['Pivote','Tabla'],            cls: 'rc-cortijo'  },
  llano:    { nombre: 'Llano',     tipos: ['Pivote','Tabla'],            cls: 'rc-llano'    },
  starosa:  { nombre: 'Sta Rosa',  tipos: ['Pivote','Tabla'],            cls: 'rc-starosa'  },
}

export const CULTIVOS        = ['Maíz','Triticale','Alfalfa']
export const TEMPORADAS      = ['Primavera','Verano','Invierno']
export const CULTIVOS_PERENES = ['Alfalfa']

export const TIPOS_ACT = {
  riego:        { label:'Riego',        icon:'ti-droplet', badge:'badge-info' },
  fertilizante: { label:'Fertilizante', icon:'ti-plant',   badge:'badge-ok'   },
  herbicida:    { label:'Herbicida',    icon:'ti-leaf',     badge:'badge-warn' },
  insecticida:  { label:'Insecticida',  icon:'ti-bug',      badge:'badge-red'  },
}

export const ROLES = {
  admin:      { label:'Administrador', color:'#D4A830' },
  encargado:  { label:'Encargado',     color:'#4A8C3F' },
  capturista: { label:'Capturista',    color:'#1A5276' },
}

export const ROLES_VEN_COSTOS = ['admin', 'encargado']

export const PAGES_BY_ROL = {
  admin:      ['dashboard','tareas','riegos','areas','actividades','programacion','productos','costos_generales','maquinaria','importar','exportar','cosecha','bromatologia','rentabilidad','consulta','analisis','configuracion','usuarios'],
  encargado:  ['dashboard','tareas','riegos','areas','actividades','programacion','maquinaria','exportar','cosecha','bromatologia','rentabilidad','consulta','analisis'],
  capturista: ['dashboard','tareas','riegos','actividades','cosecha'],
}

export const DEFAULT_INTERVALO_CRITICO = 16
export const DEFAULT_INTERVALO_ALERTA  = 10
