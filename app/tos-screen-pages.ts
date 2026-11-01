/** Cut display sheets at record/line boundaries, keeping every source interval reachable. */
export type ScreenBoundary={top:number;bottom:number};
export type ScreenPart={label:string;start:number;end:number};
export type ScreenSheet=ScreenPart&{part:number};
export function consoleScreenSheets(parts:ScreenPart[],blocks:ScreenBoundary[],height:number):ScreenSheet[]{
 const capacity=Math.max(24,Math.floor(height)),sheets:ScreenSheet[]=[];
 for(const section of parts){
  let start=section.start,part=1;
  while(start<section.end-1){
   let end=Math.min(section.end,start+capacity);
   if(end<section.end){
    // Cascading overlaps (for example a line inside a record) must all fit before the cut.
    for(let attempts=0;attempts<=blocks.length;attempts++){
     const crossing=blocks.filter(block=>block.top<end-.5&&block.bottom>end+.5&&block.bottom-block.top<=capacity&&block.top>start+.5);
     if(!crossing.length)break;
     const cut=Math.min(...crossing.map(block=>block.top));if(cut>=end-.5)break;end=cut;
    }
   }
   if(end<=start+.5)end=Math.min(section.end,start+capacity);
   sheets.push({label:section.label,start,end,part:part++});start=end;
  }
 }
 return sheets.length?sheets:[{label:'STATUS',start:0,end:0,part:1}];
}
