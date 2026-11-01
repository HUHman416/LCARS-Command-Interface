/** Only the LCARS-owned TOS detached workspace requests a frameless monitor. */
function isTosDetachedWorkspace(value){
  try{const url=new URL(value);return url.protocol==='lcars:'&&url.hostname==='app'&&url.pathname==='/index.html'&&['document','page-peek'].includes(url.searchParams.get('tool'))&&url.searchParams.get('console')==='tos';}catch{return false;}
}
module.exports={isTosDetachedWorkspace};
