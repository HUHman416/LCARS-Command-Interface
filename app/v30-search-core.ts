export type UniversalSearchCategory = "applications"|"files"|"settings"|"commands"|"stations"|"notifications"|"media"|"contacts"|"modules"|"procedures"|"activity";

export type UniversalSearchEntry = {
  id:string;
  category:UniversalSearchCategory;
  title:string;
  detail:string;
  keywords?:string;
  updatedAt?:number;
  payload?:Record<string,unknown>;
};

const normalized=(value:unknown)=>String(value||"").toLowerCase().replace(/[^a-z0-9./:_ -]+/g," ").replace(/\s+/g," ").trim();

export function rankUniversalResults(query:string,entries:UniversalSearchEntry[],limit=80){
  const requested=normalized(query),tokens=requested.split(" ").filter(Boolean);
  const unique=new Map<string,UniversalSearchEntry>();
  for(const entry of entries)if(!unique.has(`${entry.category}:${entry.id}`))unique.set(`${entry.category}:${entry.id}`,entry);
  return [...unique.values()].map((entry)=>{
    const title=normalized(entry.title),haystack=normalized(`${entry.title} ${entry.detail} ${entry.keywords||""} ${entry.category}`);
    let score=requested?0:Math.min(30,Math.floor((entry.updatedAt||0)/100000000));
    if(requested){
      if(title===requested)score+=120;
      else if(title.startsWith(requested))score+=90;
      else if(title.includes(requested))score+=65;
      if(haystack.includes(requested))score+=45;
      for(const token of tokens)if(haystack.includes(token))score+=12;
      if(tokens.some((token)=>!haystack.includes(token)))score-=80;
    }
    return{entry,score};
  }).filter((item)=>!requested||item.score>0).sort((left,right)=>right.score-left.score||(right.entry.updatedAt||0)-(left.entry.updatedAt||0)||left.entry.title.localeCompare(right.entry.title)).slice(0,Math.max(1,Math.min(200,limit))).map((item)=>item.entry);
}
