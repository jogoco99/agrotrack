import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { RanchoChip, Spinner, fmx } from '../components/UI'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

export default function Bromatologia() {
  const [cs, setCs] = useState([]); const [loading, setLoading] = useState(true)
  useEffect(()=>{ load() },[])
  async function load(){ setLoading(true); const {data}=await sb.from('cosechas').select('*, areas(rancho,tipo,denom,variedad)').not('brom_pc','is',null).order('fecha',{ascending:false}); setCs(data||[]); setLoading(false) }
  if(loading) return <Spinner/>
  if(!cs.length) return <div className="card"><div className="empty"><i className="ti ti-microscope"></i><p>Sin análisis bromatológicos registrados.</p></div></div>
  const vars=[...new Set(cs.map(c=>c.areas?.variedad||'Sin variedad'))]
  const prm=(v,k)=>{ const vals=cs.filter(c=>(c.areas?.variedad||'Sin variedad')===v&&c[k]!=null).map(c=>c[k]); return vals.length?+(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2):null }
  const params=[{k:'brom_pc',l:'Proteína (%)'},{k:'brom_fdn',l:'FDN (%)'},{k:'brom_fda',l:'FDA (%)'},{k:'brom_almidon',l:'Almidón (%)'},{k:'brom_dmo',l:'Digest. MO (%)'},{k:'brom_energia',l:'EN Mcal/kg'}]
  const cols=['#2D6A2D','#1A5276','#B7770D','#6C3483','#922B21']
  return (
    <>
      <div className="card" style={{marginBottom:14}}>
        <div className="ct"><i className="ti ti-chart-radar"></i>Comparativa por variedad (promedios)</div>
        <div className="tw"><table><thead><tr><th>Parámetro</th>{vars.map(v=><th key={v}>{v}</th>)}</tr></thead>
          <tbody>{params.map(p=><tr key={p.k}><td style={{fontWeight:500}}>{p.l}</td>{vars.map(v=><td key={v} style={{fontFamily:'IBM Plex Mono'}}>{prm(v,p.k)??'—'}</td>)}</tr>)}
          </tbody></table></div>
      </div>
      <div className="card" style={{marginBottom:14}}>
        <div className="ct"><i className="ti ti-chart-bar"></i>Proteína cruda promedio por variedad</div>
        <Bar data={{labels:vars,datasets:[{label:'PC %',data:vars.map(v=>prm(v,'brom_pc')),backgroundColor:vars.map((_,i)=>cols[i%cols.length]),borderWidth:0}]}}
          options={{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,title:{display:true,text:'%'}},x:{grid:{display:false}}}}}/>
      </div>
      <div className="card">
        <div className="ct"><i className="ti ti-list-details"></i>Detalle por cosecha</div>
        <div className="tw"><table><thead><tr><th>Fecha</th><th>Rancho</th><th>Área</th><th>Variedad</th><th>PC%</th><th>FDN%</th><th>FDA%</th><th>Almidón%</th><th>EN</th></tr></thead>
          <tbody>{cs.map(c=><tr key={c.id}>
            <td style={{fontSize:11,fontFamily:'IBM Plex Mono'}}>{c.fecha}</td>
            <td>{c.areas?<RanchoChip r={c.areas.rancho}/>:'—'}</td>
            <td>{c.areas?.tipo} {c.areas?.denom}</td>
            <td>{c.areas?.variedad||'—'}</td>
            {['brom_pc','brom_fdn','brom_fda','brom_almidon','brom_energia'].map(k=><td key={k} style={{fontFamily:'IBM Plex Mono',fontSize:11}}>{c[k]??'—'}</td>)}
          </tr>)}
          </tbody></table></div>
      </div>
    </>
  )
}
