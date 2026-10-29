/** Original backlit load instrument. Every mark represents the current sampled load. */
export function TosLoadInstrument({meters,open}:{meters:(string|number)[][];open:()=>void}){
  const readings=meters.map(([label,value,detail])=>({label:String(label),value:Math.max(0,Math.min(100,Number(value)||0)),detail:String(detail)}));
  return <div className="tos-load-instruments">
    <button className="tos-load-screen" onClick={open} aria-label={`Open system telemetry: ${readings.map(item=>`${item.label} ${item.value}%`).join(", ")}`}>
      <span className="tos-screen-label">SYSTEM LOAD · CURRENT SAMPLE</span>
      <svg viewBox="0 0 480 180" aria-hidden="true">
        {Array.from({length:11},(_,index)=><g key={index}><line x1={67+index*35} y1="22" x2={67+index*35} y2="160" stroke="#23372b" strokeWidth="1"/><text x={67+index*35} y="13" textAnchor="middle" fill="#d6c76b" fontSize="8">{index*10}</text></g>)}
        {readings.map((item,index)=><g key={item.label}>
          <text x="4" y={44+index*34} fill="#e0d78f" fontSize="11">{item.label}</text>
          {Array.from({length:25},(_,segment)=>{const lit=item.value>segment*4;return <rect key={segment} x={68+segment*14} y={29+index*34} width="11" height="16" rx="1" fill={lit?(segment<15?"#7db77a":segment<21?"#f0cf55":"#dc503b"):"#102016"}/>;})}
          <path d={`M${68+item.value*3.5} ${49+index*34} l-4 6 h8 z`} fill="#f1d26b"/>
          <text x="468" y={42+index*34} textAnchor="end" fill="#f2dc81" fontSize="11">{Math.round(item.value)}%</text>
        </g>)}
        <text x="68" y="177" fill="#b5b99b" fontSize="8">PERCENT UTILIZATION · 0–100 · OPEN FOR DETAILS</text>
      </svg>
    </button>
    <div className="tos-numeric-bank">{readings.map((item,index)=><button key={item.label} onClick={open} aria-label={`${item.label} ${item.value} percent. ${item.detail}. Open telemetry`}><span><i>{String(index+1).padStart(2,"0")}</i><b>{item.label}</b></span><strong>{Math.round(item.value)}<small>%</small></strong><em>{item.detail}</em></button>)}</div>
  </div>;
}
