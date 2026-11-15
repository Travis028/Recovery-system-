/** LDRS v6 adapter: React api.entities / functions -> PostgreSQL backend (/api/v6).
 * Maintains original api.entities.X.filter / functions.invoke contract.
 */
async function jsonRequest(route,method='GET',payload){
  let res;
  try {res=await fetch('/api/v6/'+route,{method,credentials:'include',cache:'no-store',headers:payload===undefined?undefined:{'Content-Type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload)});}
  catch {const e=new Error('Cannot reach the LDRS v6 backend (port 4001). Is it running?');e.status=503;throw e;}
  const data=await res.json().catch(()=>({}));
  if(!res.ok){const e=new Error(data.error||'Server request failed.');e.status=res.status;throw e;}
  return data;
}
function withTotal({items,total}){const rows=items||[];rows.total=total??rows.length;return rows;}
export function pgEntity(name){
  const base='entities/'+name;
  return {
    async filter(query={},options={}){return withTotal(await jsonRequest(base+'/filter','POST',{query,options}));},
    async list(sort,limit){return this.filter({},{sort,limit});},
    async get(id){return jsonRequest(base+'/'+encodeURIComponent(id));},
    async count(query={}){return (await jsonRequest(base+'/count','POST',{query})).total;},
    async create(data){return jsonRequest(base,'POST',data);},
    async update(id,changes){return jsonRequest(base+'/'+encodeURIComponent(id),'PATCH',changes);},
    async delete(){const e=new Error('Delete is disabled; records require audited retention processing.');e.status=403;throw e;},
  };
}
export function pgFunction(name,args={}){
  if(name==='verifyReceipt')return jsonRequest('public/receipts/'+encodeURIComponent(args.id||'')+'?h='+encodeURIComponent(args.h||''));
  return jsonRequest('functions/invoke','POST',{name,args});
}
export async function pgUpload({file}){
  if(!file || !['image/jpeg','image/png'].includes(file.type))throw new Error('Choose a JPG or PNG.');
  if(file.size>5*1024*1024)throw new Error('Image exceeds 5 MB.');
  const res=await fetch('/api/v6/uploads',{method:'POST',credentials:'include',headers:{'Content-Type':file.type},body:file});
  const data=await res.json().catch(()=>({}));
  if(!res.ok){const e=new Error(data.error||'Upload failed.');e.status=res.status;throw e;}
  return data;
}
export async function pgSignedUrl({file_uri}){
  const id=String(file_uri||'').match(/^ldrs-private:\/\/([0-9a-f-]{36})$/i)?.[1];
  if(!id)throw new Error('Invalid private image reference.');
  const res=await fetch('/api/v6/uploads/'+id,{credentials:'include',cache:'no-store'});
  if(!res.ok){const data=await res.json().catch(()=>({}));throw new Error(data.error||'Image not available.');}
  return {signed_url:URL.createObjectURL(await res.blob())};
}
