import { useState } from 'react'
import { sb } from '../lib/supabase'
import { toast } from '../components/UI'
import * as XLSX from 'xlsx'

const TEMPLATES = {
  areas: { headers:['rancho','tipo','denom','sup','cultivo','variedad','temporada','siembra','notas'], example:['cantabra','Pivote','P1','25.5','Maíz','AS-1633','Primavera','2024-03-01',''] },
  productos: { headers:['nombre','categoria','precio','unidad','descripcion','proveedor'], example:['Urea 46%','fertilizante','8.50','kg','Bolsa 50kg','Proveedor SA'] },
  maquinaria: { headers:['nombre','tipo','rancho','area_denom','estatus','modelo','anio','ultima_rev','notas'], example:['Pivote P1','pivote','cantabra','P1','operativo','Valley 8000','2018','2024-01-15',''] },
}

export default function Importar() {
  const [tipo,    setTipo]    = useState('areas')
  const [modo,    setModo]    = useState('append')
  const [preview, setPreview] = useState(null)
  const [rows,    setRows]    = useState([])
  const [saving,  setSaving]  = useState(false)

  function downloadTemplate(t) {
    const tmpl = TEMPLATES[t]; if(!tmpl) return
    const ws = XLSX.utils.aoa_to_sheet([tmpl.headers, tmpl.example])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Datos')
    XLSX.writeFile(wb, `plantilla_${t}.xlsx`)
    toast('Plantilla descargada')
  }

  function handleFile(e) {
    const file = e.target.files[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type:'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws)
        if(!data.length){ toast('Archivo vacío', false); return }
        setRows(data); setPreview(data.slice(0,3))
      } catch(err){ toast('Error al leer: '+err.message, false) }
    }
    reader.readAsArrayBuffer(file)
  }

  async function confirmar() {
    if(!rows.length) return; setSaving(true)
    const tabla = tipo
    const parsed = rows.map(r => {
      if(tabla==='areas') return { rancho:r.rancho, tipo:r.tipo, denom:String(r.denom||''), sup:parseFloat(r.sup)||0, cultivo:r.cultivo||null, variedad:r.variedad||null, temporada:r.temporada||null, siembra:r.siembra||null, notas:r.notas||null }
      if(tabla==='productos') return { nombre:r.nombre, categoria:r.categoria, precio:parseFloat(r.precio)||0, unidad:r.unidad||'kg', descripcion:r.descripcion||null, proveedor:r.proveedor||null }
      return r
    })
    if(modo==='replace') await sb.from(tabla).delete().neq('id','00000000-0000-0000-0000-000000000000')
    const {error} = await sb.from(tabla).insert(parsed)
    setSaving(false)
    if(error){ toast('Error: '+error.message, false); return }
    toast(`${parsed.length} registros importados`); setRows([]); setPreview(null)
  }

  return (
    <>
      <div className="g3" style={{marginBottom:16}}>
        {Object.entries(TEMPLATES).map(([k])=>(
          <div key={k} className="card">
            <div className="ct"><i className="ti ti-download"></i>Plantilla: {k.charAt(0).toUpperCase()+k.slice(1)}</div>
            <p style={{fontSize:12,color:'var(--cs)',marginBottom:10}}>Campos: {TEMPLATES[k].headers.join(', ')}</p>
            <button className="btn pr full" onClick={()=>downloadTemplate(k)}><i className="ti ti-file-spreadsheet"></i> Descargar</button>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="ct"><i className="ti ti-upload"></i>Subir Excel para importar</div>
        <div className="fr c2">
          <div className="fg"><label>¿Qué importar?</label>
            <select value={tipo} onChange={e=>{setTipo(e.target.value);setRows([]);setPreview(null)}}>
              <option value="areas">Áreas</option>
              <option value="productos">Productos</option>
              <option value="maquinaria">Maquinaria</option>
            </select></div>
          <div className="fg"><label>Modo</label>
            <select value={modo} onChange={e=>setModo(e.target.value)}>
              <option value="append">Agregar a los existentes</option>
              <option value="replace">Reemplazar todos</option>
            </select></div>
        </div>
        <div className="upload-zone" onClick={()=>document.getElementById('imp-file').click()}>
          <i className="ti ti-file-spreadsheet"></i>
          <p>Haz clic para seleccionar el archivo Excel (.xlsx o .xls)</p>
          <input type="file" id="imp-file" accept=".xlsx,.xls" style={{display:'none'}} onChange={handleFile}/>
        </div>
        {preview && (
          <div style={{marginTop:12}}>
            <div className="al ok"><i className="ti ti-check"></i>{rows.length} filas detectadas. Vista previa:</div>
            <div className="tw"><table><thead><tr>{Object.keys(preview[0]).map(k=><th key={k}>{k}</th>)}</tr></thead>
              <tbody>{preview.map((r,i)=><tr key={i}>{Object.values(r).map((v,j)=><td key={j} style={{fontSize:11}}>{String(v??'')}</td>)}</tr>)}
            </tbody></table></div>
            <div className="br-row">
              <button className="btn pr" onClick={confirmar} disabled={saving}>
                {saving?<><i className="ti ti-loader"></i> Importando…</>:<><i className="ti ti-upload"></i> Confirmar importación de {rows.length} registros</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
