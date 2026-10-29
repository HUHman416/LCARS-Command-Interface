/** Original backlit load instrument. Every mark represents the current sampled load. */
export function TosLoadInstrument({meters,open}:{meters:(string|number)[][];open:()=>void}){
  const readings=meters.map(([label,value,detail])=>({label:String(label),value:Math.max(0,Math.min(100,Number(value)||0)),detail:String(detail)}));
  const memory=readings.find(item=>item.label==="MEM")?.value||0,storage=readings.find(item=>item.label==="DISK")?.value||0;
  return <div className="tos-load-instruments">
    <button className="tos-load-screen" onClick={open} aria-label={`Open system telemetry: ${readings.map(item=>`${item.label} ${item.value}%`).join(", ")}`}>
      <span className="tos-screen-label">SYSTEM LOAD · CURRENT SAMPLE</span>
      <svg viewBox="0 0 480 180" aria-hidden="true">
        {Array.from({length:11},(_,index)=><g key={index}><line x1={67+index*35} y1="22" x2={67+index*35} y2="160" stroke="#303030" strokeWidth="1"/><text x={67+index*35} y="13" textAnchor="middle" fill="#ffffff" fontSize="8">{index*10}</text></g>)}
        {readings.map((item,index)=><g key={item.label}>
          <text x="4" y={44+index*34} fill="#ffffff" fontSize="11">{item.label}</text>
          {Array.from({length:25},(_,segment)=>{const lit=item.value>segment*4;return <rect key={segment} x={68+segment*14} y={29+index*34} width="11" height="16" rx="1" fill={lit?(segment<15?"#39e639":segment<21?"#ffdd00":"#ff3200"):"#151515"}/>;})}
          <path d={`M${68+item.value*3.5} ${49+index*34} l-4 6 h8 z`} fill="#00bfff"/>
          <text x="468" y={42+index*34} textAnchor="end" fill="#ffffff" fontSize="11">{Math.round(item.value)}%</text>
        </g>)}
        <text x="68" y="177" fill="#ffffff" fontSize="8">PERCENT UTILIZATION · 0–100 · OPEN FOR DETAILS</text>
      </svg>
    </button>
    <button className="tos-allocation-screen" onClick={open} aria-label={`Open memory and storage telemetry: memory ${memory} percent, disk ${storage} percent`}>
      <span className="tos-screen-label">CORE ALLOCATION · CURRENT SAMPLE</span>
      <svg viewBox="0 0 320 180" aria-hidden="true">
        <rect width="320" height="180" fill="#000000"/>
        {Array.from({length:17},(_,index)=><line key={`x-${index}`} x1={index*20} y1="0" x2={index*20} y2="180" stroke="#4c4200" strokeWidth=".6"/>)}
        {Array.from({length:10},(_,index)=><line key={`y-${index}`} x1="0" y1={index*20} x2="320" y2={index*20} stroke="#4c4200" strokeWidth=".6"/>)}
        <g transform="translate(112 90)" fill="none" stroke="#ffdd00">
          <circle r="75" strokeWidth="1.5"/><circle r="58"/><circle r="39"/>
          {Array.from({length:48},(_,index)=>{const a=index*Math.PI/24;return <line key={index} x1={Math.cos(a)*61} y1={Math.sin(a)*61} x2={Math.cos(a)*(index%4===0?74:68)} y2={Math.sin(a)*(index%4===0?74:68)} strokeWidth={index%4===0?1.5:.7}/>;})}
          <circle r="50" stroke="#ffdd00" strokeWidth="5" strokeDasharray={`${memory*3.1416} 314.16`} transform="rotate(-90)"/>
          <circle r="32" stroke="#00bfff" strokeWidth="5" strokeDasharray={`${storage*2.0106} 201.06`} transform="rotate(-90)"/>
          <path d="M-82 0H82M0-82V82" strokeWidth=".7"/>
        </g>
        <g fill="#ffffff" fontFamily="monospace">
          <text x="212" y="42" fontSize="9">MEMORY</text><text x="212" y="63" fontSize="20">{Math.round(memory)}%</text>
          <rect x="212" y="73" width="65" height="5" fill="#ffdd00"/>
          <text x="212" y="111" fontSize="9">STORAGE</text><text x="212" y="132" fontSize="20">{Math.round(storage)}%</text>
          <rect x="212" y="142" width="65" height="5" fill="#00bfff"/>
        </g>
      </svg>
    </button>
    <div className="tos-numeric-bank">{readings.map((item,index)=><button key={item.label} onClick={open} aria-label={`${item.label} ${item.value} percent. ${item.detail}. Open telemetry`}><span><i>{String(index+1).padStart(2,"0")}</i><b>{item.label}</b></span><strong>{Math.round(item.value)}<small>%</small></strong><em>{item.detail}</em></button>)}</div>
  </div>;
}
