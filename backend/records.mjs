/** LDRS v6 — PostgreSQL data operations for the React screens (schema ldrs_v6).
 * Local development only; do not store real identity documents in this pilot.
 * Every access is scoped server-side to the current session and role.
 */
import { verifyChain, purgeAuditOlderThan } from './auditChain.mjs';
import { checkPlace, describePlace } from './locations.mjs';
import crypto from 'node:crypto';
import { handoverWorkflow } from './handover.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PHOTO_DIR = path.join(ROOT, '.private-document-photos');
const KEY_FILE = path.join(ROOT, '.private-photo-key');
const MAX_PHOTO = 5 * 1024 * 1024;
const tables = {
  Document: ['documents','id','finder_user_id','document_type','owner_name','document_number','found_location','date_found','pickup_point_id','image_url','ocr_name_confidence','ocr_number_confidence','status','returned_at','image_sha256','image_phash','ocr_used','ocr_name_accepted','ocr_number_accepted','duplicate_flag','duplicate_reasons','duplicate_of_id','county','sub_county','ward','landmark','created_at','updated_at'],
  LossReport: ['loss_reports','id','owner_user_id','document_type','owner_name','document_number','phone','consent_given','date_lost','status','phone_verified','county','sub_county','ward','landmark','created_at','updated_at'],
  Match: ['matches','id','document_id','loss_report_id','owner_user_id','match_score','match_type','match_status','reference_code','created_at','updated_at'],
  Claim: ['claims','id','document_id','document_type','owner_user_id','owner_name','phone','document_number','note','status','match_id','reference_code','created_at','updated_at'],
  Notification: ['notifications','id','user_id','phone','message','channel','sender','language','delivery_status','attempts','read','created_at'],
  Handover: ['handovers','id','document_id','match_id','officer_user_id','released_to','claimant_id_type','claimant_id_number','verification_method','notes','pickup_point_id','integrity_hash','created_at','updated_at'],
  PickupPoint: ['pickup_points','id','name','point_type','location','county','contact_phone','opening_hours','verified','verification_note','verified_at','active','created_at','updated_at'],
  User: ['users','id','email','full_name','phone','phone_verified','role','ldrs_role','approved','pickup_point_id','language','disabled','failed_logins','locked_until','created_at','updated_at'],
  DataRequest: ['data_requests','id','owner_user_id','request_type','details','status','response','created_at','updated_at'],
  Setting: ['settings','key','value','updated_at'],
  AuditLog: ['audit_log','id','seq','user_id','action','details','actor_role','logged_at'],
  OtpCode: ['otp_codes','id','match_id','owner_user_id','expires_at','used','attempts','locked','created_at'],
};
const col = (x) => x === 'created_date' ? 'created_at' : x === 'updated_date' ? 'updated_at' : x;
const roleOf = (u) => u.role === 'admin' ? 'Admin' : u.ldrs_role;
const approvedOfficer = (u) => roleOf(u) === 'Officer' && u.approved && u.pickup_point_id;
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function abort(status, message) { const err = new Error(message); err.status = status; throw err; }
function insist(ok, msg, status = 422) { if (!ok) abort(status, msg); }
function text(v, max = 200) { return String(v ?? '').trim().slice(0, max); }

/* Settings the server actually applies (Backups and data protection page). [default, min, max] */
const SETTINGS = {
  search_limit_per_hour: [10, 1, 100],
  unclaimed_after_days: [30, 1, 3650],
  document_retention_days: [180, 7, 3650],
  audit_retention_days: [365, 30, 3650],
};
export async function ensureDefaultSettings(pool) {
  for (const [key, [value]] of Object.entries(SETTINGS))
    await pool.query(`INSERT INTO ldrs_v6.settings(key,value) VALUES($1,$2::jsonb) ON CONFLICT (key) DO NOTHING`, [key, JSON.stringify(value)]);
}
async function getSetting(db, key) {
  const row = (await db.query('SELECT value FROM ldrs_v6.settings WHERE key=$1', [key])).rows[0];
  const n = Number(row?.value); const [def, min, max] = SETTINGS[key];
  return Number.isInteger(n) && n >= min && n <= max ? n : def;
}
function csvCell(value) {
  let v = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; // stop spreadsheet formula injection
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function upper(v) { return text(v).toUpperCase(); }
function norm(v) { return upper(v).replace(/[^A-Z0-9]/g, ''); }
function maskName(value) { const words = text(value).split(/\s+/); return words.map(w=>w.length<=2?'*'.repeat(w.length):w[0]+'*'.repeat(Math.min(w.length-1,5))).join(' '); }
function maskNumber(value) { const s=text(value); return s.length<=4?'*'.repeat(s.length):'*'.repeat(Math.min(10,s.length-4))+s.slice(-4); }
function safeRow(name, row, actor) {
  if (!row) return row;
  const out = { ...row };
  if (out.created_at) out.created_date = out.created_at;
  if (name === 'AuditLog' && out.logged_at) out.created_date = out.logged_at; // audit time column is logged_at
  if (name === 'Handover' && out.created_at) out.released_at = out.created_at;
  if (out.updated_at) out.updated_date = out.updated_at;
  if (name === 'Setting') out.id = out.key; // screens address settings by id
  if (name === 'OtpCode') delete out.otp_hash;
  if (name === 'User') { delete out.password_hash; delete out.password_salt; }
  if (name === 'User' && roleOf(actor) !== 'Admin' && out.id !== actor.id) return { id: out.id, full_name: out.full_name, ldrs_role: out.ldrs_role };
  if (name === 'Document' && roleOf(actor) === 'Owner') {
    out.owner_name = maskName(out.owner_name); out.document_number = maskNumber(out.document_number);
    delete out.image_url; delete out.image_sha256; delete out.image_phash; delete out.finder_user_id; delete out.duplicate_reasons;
  }
  return out;
}
function scopeFor(name, actor, offset = 1) {
  const role = roleOf(actor);
  if (role === 'Admin') return {sql:name === 'Setting' ? `left(t.key,1)<>'_'` : 'TRUE',params:[]};
  const ph = `$${offset}`;
  if (name === 'User') return {sql:`(t.id=${ph} OR (t.ldrs_role='Officer' AND t.pickup_point_id=${`$${offset+1}`} AND t.pickup_point_id IS NOT NULL))`,params:[actor.id,actor.pickup_point_id]};
  if (name === 'PickupPoint') return {sql:'TRUE',params:[]};
  if (name === 'Setting') return {sql:`left(t.key,1)<>'_'`,params:[]};
  if (name === 'AuditLog') abort(403,'Only administrators may view audit logs.');
  if (name === 'OtpCode') return {sql:'FALSE',params:[]}; // Never return collection-code hashes/codes through generic entities.
  if (name === 'Document') {
    if (role === 'Finder') return {sql:`t.finder_user_id=${ph}`,params:[actor.id]};
    if (role === 'Officer') { insist(approvedOfficer(actor),'Officer awaiting approval.',403); return {sql:`t.pickup_point_id=${ph}`,params:[actor.pickup_point_id]}; }
    if (role === 'Owner') return {sql:`(EXISTS(SELECT 1 FROM ldrs_v6.matches m WHERE m.document_id=t.id AND m.owner_user_id=${ph} AND m.match_status IN ('Confirmed','Returned')) OR EXISTS(SELECT 1 FROM ldrs_v6.claims c WHERE c.document_id=t.id AND c.owner_user_id=${ph}))`,params:[actor.id]};
  }
  if (name === 'LossReport') {
    if (role === 'Owner') return {sql:`t.owner_user_id=${ph}`,params:[actor.id]};
    if (role === 'Officer') { insist(approvedOfficer(actor),'Officer awaiting approval.',403); return {sql:`EXISTS(SELECT 1 FROM ldrs_v6.matches m JOIN ldrs_v6.documents d ON m.document_id=d.id WHERE m.loss_report_id=t.id AND d.pickup_point_id=${ph})`,params:[actor.pickup_point_id]}; }
  }
  if (name === 'Match' || name === 'Claim') {
    if (role === 'Owner') return {sql:name==='Match'?`(t.owner_user_id=${ph} AND t.match_status IN ('Confirmed','Returned'))`:`t.owner_user_id=${ph}`,params:[actor.id]};
    if (role === 'Officer') { insist(approvedOfficer(actor),'Officer awaiting approval.',403); return {sql:`EXISTS(SELECT 1 FROM ldrs_v6.documents d WHERE d.id=t.document_id AND d.pickup_point_id=${ph})`,params:[actor.pickup_point_id]}; }
  }
  if (name === 'Notification') return {sql:`t.user_id=${ph}`,params:[actor.id]};
  if (name === 'Handover' && role === 'Officer') { insist(approvedOfficer(actor),'Officer awaiting approval.',403); return {sql:`EXISTS(SELECT 1 FROM ldrs_v6.documents d WHERE d.id=t.document_id AND d.pickup_point_id=${ph})`,params:[actor.pickup_point_id]}; }
  if (name === 'DataRequest' && ['Owner','Finder'].includes(role)) return {sql:`t.owner_user_id=${ph}`,params:[actor.id]};
  return {sql:'FALSE',params:[]};
}
function filters(name, query, start=1) {
  const fields = tables[name].slice(1); const parts=[]; const params=[];
  for (const [original,v] of Object.entries(query || {})) {
    const k=col(original);
    insist(fields.includes(k),`Unsupported filter field: ${original}`);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (Array.isArray(v.$in)) {
        if (!v.$in.length) { parts.push('FALSE'); continue; }
        params.push(v.$in); parts.push(`t."${k}" = ANY($${start+params.length})`);
      } else if ('$ne' in v) { params.push(v.$ne); parts.push(`t."${k}" IS DISTINCT FROM $${start+params.length}`); }
      else abort(422,'Unsupported filter operator.');
    } else { params.push(v); parts.push(`t."${k}" = $${start+params.length}`); }
  }
  return {sql:parts.length?parts.join(' AND '):'TRUE', params};
}
function sortClause(name, value) {
  const original = String(value || '-created_date'); const desc=original.startsWith('-'); const key=col(desc?original.slice(1):original);
  const fields=tables[name].slice(1);
  return fields.includes(key) ? `ORDER BY t."${key}" ${desc?'DESC':'ASC'}` : `ORDER BY t."${name==='AuditLog'?'logged_at':name==='Setting'?'updated_at':'created_at'}" DESC`;
}
async function listEntities(ctx,name,query={},opts={}) {
  const {pool,user}=ctx;
  const t=tables[name]; insist(t,`Unknown entity: ${name}`,404);
  const sc=scopeFor(name,user); const f=filters(name,query,sc.params.length);
  const params=[...sc.params,...f.params];
  const countRes=await pool.query(`SELECT count(*)::int AS total FROM ldrs_v6.${t[0]} t WHERE (${sc.sql}) AND (${f.sql})`,params);
  const skip = Math.max(0, Math.min(100000, Number(opts.skip)||0));
  const limit = Math.max(1, Math.min(500, Number(opts.limit)||100));
  const select = name==='User' ? 't.id,t.email,t.full_name,t.phone,t.phone_verified,t.role,t.ldrs_role,t.approved,t.pickup_point_id,t.language,t.disabled,t.failed_logins,t.locked_until,t.created_at,t.updated_at' : 't.*';
  const rows=(await pool.query(`SELECT ${select} FROM ldrs_v6.${t[0]} t WHERE (${sc.sql}) AND (${f.sql}) ${sortClause(name,opts.sort)} LIMIT $${params.length+1} OFFSET $${params.length+2}`,[...params,limit,skip])).rows.map(r=>safeRow(name,r,user));
  return {items:rows,total:countRes.rows[0].total};
}
async function getEntity(ctx,name,id) { const rows=await listEntities(ctx,name,{[name==='Setting'?'key':'id']:id},{limit:1}); if (!rows.items.length) abort(404,'Record not found.'); return rows.items[0]; }
async function editEntity(ctx,name,id,changes) {
  const {pool,user,audit}=ctx; const role=roleOf(user);
  insist(['User','Document','Match','Claim','Notification','PickupPoint','Setting','DataRequest','LossReport'].includes(name),'Updates are not allowed for this entity.',403);
  const original=await getEntity(ctx,name,id);
  let allowed=[];
  if (name==='User') { insist(role==='Admin' || user.id===id,'You cannot update this account.',403); allowed=role==='Admin'?['approved','disabled','pickup_point_id','phone_verified','failed_logins','locked_until','full_name','language']:['full_name','language']; }
  if (name==='Document') { insist(role==='Admin' || (approvedOfficer(user)&&original.pickup_point_id===user.pickup_point_id),'Station approval required.',403); allowed=['duplicate_flag','duplicate_reasons']; } // Status changes require audited workflows.
  if (name==='Match') { abort(403,'Match decisions must use the audited review workflow.'); }
  if (name==='Claim') { abort(403,'Claim decisions must use the audited review workflow.'); }
  if (name==='Notification') { insist(role==='Admin' || original.user_id===user.id,'Not your notification.',403); allowed=role==='Admin'?['read','delivery_status']:['read']; }
  if (name==='PickupPoint') { insist(role==='Admin','Administrator required.',403); allowed=['name','point_type','location','county','contact_phone','opening_hours','verified','verification_note','active']; }
  if (name==='Setting') { insist(role==='Admin','Administrator required.',403); allowed=['value'];
    const range=SETTINGS[original.key]; insist(range,'This setting cannot be changed here.',403);
    const n=Number(changes.value); insist(Number.isInteger(n)&&n>=range[1]&&n<=range[2],`${original.key.replace(/_/g,' ')} must be a whole number from ${range[1]} to ${range[2]}.`);
    changes={value:JSON.stringify(n)}; }
  if (name==='DataRequest') { insist(role==='Admin','Administrator required.',403); allowed=['status','response']; }
  if (name==='LossReport') { insist(role==='Admin'||(role==='Owner'&&original.owner_user_id===user.id),'Not your report.',403); allowed=['status']; if(role==='Owner')insist(changes.status==='Closed','Owners may only close reports.',403); }
  const kv=Object.entries(changes).filter(([k])=>allowed.includes(k)); insist(kv.length && kv.length===Object.keys(changes).length,'Unsupported record changes.');
  if (name==='User' && changes.approved===true) insist(original.ldrs_role==='Officer' && (changes.pickup_point_id||original.pickup_point_id) && original.phone, 'Officer needs a verified station and phone.');
  const pk=name==='Setting'?'key':'id'; const values=kv.map(([,v])=>v=== ''?null:v);
  const set=kv.map(([k],i)=>`"${k}"=$${i+1}`).join(',');
  const updated=(await pool.query(`UPDATE ldrs_v6.${tables[name][0]} SET ${set}${name==='Notification'||name==='AuditLog'?'':',updated_at=now()'} WHERE ${pk}=$${values.length+1} RETURNING *`,[...values,id])).rows[0];
  await audit(user.id,`update_${name.toLowerCase()}`,`Record ${id} changed`,role);
  return safeRow(name,updated,user);
}
async function addEntity(ctx,name,data) {
  const {pool,user,audit}=ctx; const role=roleOf(user);
  insist(['Claim','DataRequest','PickupPoint','Notification','AuditLog'].includes(name),'Use the workflow to create this record.',403);
  if (name==='AuditLog') { insist(text(data.action,100).length>0,'Action is required.'); await audit(user.id, 'client_event',text(data.action,100)+': '+text(data.details,300),role); return {id:crypto.randomUUID()}; }
  if (name==='PickupPoint') insist(role==='Admin','Administrator required.',403);
  if (name==='Notification') insist(role==='Admin','Only administrators can add manual notifications.',403);
  if (name==='Claim') insist(role==='Owner','Owner required.',403);
  if (name==='DataRequest') insist(['Owner','Finder'].includes(role),'Owner or finder required.',403);
  const allowed={Claim:['document_id','document_type','owner_name','phone','document_number','note','match_id','reference_code'],DataRequest:['request_type','details'],PickupPoint:['name','point_type','location','county','contact_phone','opening_hours','active'],Notification:['user_id','phone','message','channel','sender','language','delivery_status']}[name];
  const record={id:crypto.randomUUID()}; for(const k of allowed){if(data[k]!==undefined)record[k]=data[k];}
  if(name==='Claim'){const found=await pool.query(`SELECT id,status,document_type FROM ldrs_v6.documents WHERE id=$1`,[record.document_id]);insist(found.rows.length&&['Found','Matched','Notified'].includes(found.rows[0].status),'Document is not claimable.',422);const exists=await pool.query(`SELECT id FROM ldrs_v6.claims WHERE document_id=$1 AND owner_user_id=$2 AND status IN ('Pending','Approved') LIMIT 1`,[record.document_id,user.id]);insist(!exists.rows.length,'A claim is already active for this document.',409);record.document_type=found.rows[0].document_type;record.owner_user_id=user.id;record.status='Pending';}
  if(name==='DataRequest'){record.owner_user_id=user.id;record.status='Open';}
  if(name==='PickupPoint'){record.verified=false;}
  const keys=Object.keys(record); const result=await pool.query(`INSERT INTO ldrs_v6.${tables[name][0]} (${keys.map(k=>'"'+k+'"').join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,keys.map(k=>record[k]));
  await audit(user.id,`create_${name.toLowerCase()}`,`Record ${record.id} created`,role);
  return safeRow(name,result.rows[0],user);
}
function photoKey() {
  fs.mkdirSync(PHOTO_DIR,{recursive:true,mode:0o700});
  if(!fs.existsSync(KEY_FILE)){fs.writeFileSync(KEY_FILE,crypto.randomBytes(32),{flag:'wx',mode:0o600});}
  const key=fs.readFileSync(KEY_FILE); insist(key.length===32,'File encryption key is invalid.',500); return key;
}
async function upload(ctx,req,res) {
  const {user,pool,respond,audit}=ctx; insist(['Finder','Officer','Admin'].includes(roleOf(user)),'Only finders and staff may upload.',403);
  if(roleOf(user)==='Officer')insist(approvedOfficer(user),'Officer awaiting approval.',403);
  const type=String(req.headers['content-type']||'').split(';')[0];insist(['image/jpeg','image/png'].includes(type),'JPEG or PNG required.',415);
  let size=0;const chunks=[];for await(const part of req){size+=part.length;if(size>MAX_PHOTO)abort(413,'Photograph exceeds 5MB.');chunks.push(part);}
  const b=Buffer.concat(chunks);insist(b.length>8,'Empty photograph.');
  const isJpeg=b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;const isPng=b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
  insist(type==='image/jpeg'?isJpeg:isPng,'File content does not match its image type.',415);
  const id=crypto.randomUUID();const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',photoKey(),iv);
  const encrypted=Buffer.concat([cipher.update(b),cipher.final()]); const tag=cipher.getAuthTag();
  fs.writeFileSync(path.join(PHOTO_DIR,id+'.bin'),Buffer.concat([iv,tag,encrypted]),{mode:0o600,flag:'wx'});
  const uri='ldrs-private://'+id;
  try{await pool.query(`INSERT INTO ldrs_v6.uploads(id,file_uri,uploaded_by,sha256,content_type,byte_length) VALUES($1,$2,$3,$4,$5,$6)`,[id,uri,user.id,crypto.createHash('sha256').update(b).digest('hex'),type,b.length]);}
  catch(e){fs.rmSync(path.join(PHOTO_DIR,id+'.bin'),{force:true});throw e;}
  await audit(user.id,'photo_uploaded','Private encrypted image uploaded',roleOf(user));
  respond(res,201,{file_uri:uri});
}
async function download(ctx,id,res) {
  const {pool,user}=ctx; insist(uuidRe.test(id),'Invalid photo ID.');
  const result=await pool.query(`SELECT u.*,d.pickup_point_id,d.finder_user_id FROM ldrs_v6.uploads u LEFT JOIN ldrs_v6.documents d ON d.image_url=u.file_uri WHERE u.id=$1`,[id]);
  const row=result.rows[0]; if(!row)abort(404,'Photograph not found.');
  const ok = roleOf(user)==='Admin' || row.uploaded_by===user.id || (approvedOfficer(user)&&row.pickup_point_id===user.pickup_point_id);
  insist(ok,'Photograph not available to this role.',403);
  const payload=fs.readFileSync(path.join(PHOTO_DIR,id+'.bin')); const iv=payload.subarray(0,12);const tag=payload.subarray(12,28);
  const decipher=crypto.createDecipheriv('aes-256-gcm',photoKey(),iv);decipher.setAuthTag(tag);const decrypted=Buffer.concat([decipher.update(payload.subarray(28)),decipher.final()]);
  res.writeHead(200,{'Content-Type':row.content_type,'Content-Length':decrypted.length,'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"});res.end(decrypted);
}
async function createMatches(ctx, doc, report = null) {
  const {pool,user,audit}=ctx;
  const others=report ? (await pool.query(`SELECT * FROM ldrs_v6.documents WHERE status IN ('Found','Matched','Notified') AND document_type=$1`,[report.document_type])).rows : (await pool.query(`SELECT * FROM ldrs_v6.loss_reports WHERE status IN ('Open','Matched') AND document_type=$1`,[doc.document_type])).rows;
  const created=[];
  for(const other of others){const d=report?other:doc;const r=report||other;const numberMatch=norm(d.document_number)&&norm(d.document_number)===norm(r.document_number);const nameMatch=upper(d.owner_name)===upper(r.owner_name);
    if(!numberMatch&&!nameMatch)continue;
    const type=numberMatch?'Exact':'Fuzzy';const score=numberMatch?100:75;
    const query=await pool.query(`INSERT INTO ldrs_v6.matches(id,document_id,loss_report_id,owner_user_id,match_score,match_type,match_status,reference_code)
      VALUES($1,$2,$3,$4,$5,$6,'Pending',$7) ON CONFLICT(document_id,loss_report_id) DO NOTHING RETURNING *`,[crypto.randomUUID(),d.id,r.id,r.owner_user_id,score,type,crypto.randomBytes(4).toString('hex').toUpperCase()]);
    if(query.rows.length)created.push({match:query.rows[0],pickup_point_id:d.pickup_point_id});
  }
  if(created.length)await audit(user.id,'potential_match_created',`${created.length} match candidates created (officer review required)`,roleOf(user));
  return created;
}
/** Totals only (no personal details), in the shape the Statistics screen expects.
 * Officers see their own station; administrators see every pickup point. */
async function statistics(ctx) {
  const {pool,user}=ctx; const role=roleOf(user);
  insist(role==='Admin'||approvedOfficer(user),'Approved staff required.',403);
  const officer=role==='Officer';
  const docs=(await pool.query(`SELECT d.id,d.document_type,d.status,d.created_at,d.returned_at,d.ocr_used,d.ocr_name_accepted,d.ocr_number_accepted,d.duplicate_flag,p.name AS point_name
    FROM ldrs_v6.documents d LEFT JOIN ldrs_v6.pickup_points p ON p.id=d.pickup_point_id ${officer?'WHERE d.pickup_point_id=$1':''}`,officer?[user.pickup_point_id]:[])).rows;
  const matched=(await pool.query(`SELECT count(DISTINCT m.document_id)::int AS n FROM ldrs_v6.matches m JOIN ldrs_v6.documents d ON d.id=m.document_id
    WHERE m.match_status IN ('Confirmed','Returned') ${officer?'AND d.pickup_point_id=$1':''}`,officer?[user.pickup_point_id]:[])).rows[0].n;
  const scope=officer?((await pool.query('SELECT name FROM ldrs_v6.pickup_points WHERE id=$1',[user.pickup_point_id])).rows[0]?.name||'My station'):'All pickup points';
  const iso=(v)=>v?new Date(v).toISOString():'';
  const returned=docs.filter(d=>d.status==='Returned');
  const days=returned.filter(d=>d.returned_at).map(d=>(new Date(d.returned_at)-new Date(d.created_at))/86400000);
  const ocrDocs=docs.filter(d=>d.ocr_used);
  const ocrAccepted=ocrDocs.reduce((sum,d)=>sum+(d.ocr_name_accepted?1:0)+(d.ocr_number_accepted?1:0),0);
  const names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; const now=new Date(); const months=[];
  for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push({key:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),label:names[d.getMonth()],found:0,returned:0});}
  const byType={}; const byStation={};
  for(const d of docs){
    const f=months.find(m=>m.key===iso(d.created_at).slice(0,7)); if(f)f.found+=1;
    const r=d.returned_at&&months.find(m=>m.key===iso(d.returned_at).slice(0,7)); if(r)r.returned+=1;
    byType[d.document_type]=(byType[d.document_type]||0)+1;
    if(!officer){const n=d.point_name||'Unknown';byStation[n]=byStation[n]||{found:0,returned:0};byStation[n].found+=1;if(d.status==='Returned')byStation[n].returned+=1;}
  }
  const open=officer?null:(await pool.query(`SELECT count(*)::int AS n FROM ldrs_v6.loss_reports WHERE status='Open'`)).rows[0].n;
  return {scope,found:docs.length,matched,returned:returned.length,
    unclaimed:docs.filter(d=>d.status==='Unclaimed').length,duplicates:docs.filter(d=>d.duplicate_flag).length,
    recovery_rate:docs.length?Math.round(returned.length*100/docs.length):0,
    avg_days_to_recovery:days.length?Math.round(days.reduce((a,b)=>a+b,0)/days.length*10)/10:null,
    ocr_accuracy:ocrDocs.length?Math.round(ocrAccepted*100/(ocrDocs.length*2)):null,ocr_documents:ocrDocs.length,
    open_reports:open,months,by_type:byType,by_station:byStation};
}
/** Data Protection Act retention: mark old documents unclaimed, dispose of old unclaimed ones
 * (personal fields removed, photo deleted), and remove audit entries past their retention period. */
async function runRetention(ctx) {
  const {pool,user}=ctx; insist(roleOf(user)==='Admin','Administrator required.',403);
  const unclaimedDays=await getSetting(pool,'unclaimed_after_days'), keepDays=await getSetting(pool,'document_retention_days'), auditDays=await getSetting(pool,'audit_retention_days');
  const conn=await pool.connect(); let markedUnclaimed=0, disposed=0, auditRemoved=0; const photos=[];
  try {
    await conn.query('BEGIN');
    markedUnclaimed=(await conn.query(`UPDATE ldrs_v6.documents SET status='Unclaimed',updated_at=now()
      WHERE status IN ('Found','Matched') AND created_at < now()-make_interval(days=>$1)`,[unclaimedDays])).rowCount;
    const gone=await conn.query(`WITH old AS (SELECT id,image_url FROM ldrs_v6.documents WHERE status='Unclaimed' AND owner_name IS DISTINCT FROM 'REMOVED'
        AND created_at < now()-make_interval(days=>$1) FOR UPDATE)
      UPDATE ldrs_v6.documents d SET owner_name='REMOVED',document_number='REMOVED',image_url=NULL,image_sha256=NULL,image_phash=NULL,updated_at=now()
      FROM old WHERE d.id=old.id RETURNING old.image_url`,[keepDays]);
    disposed=gone.rowCount;
    for (const {image_url} of gone.rows) {
      const id=String(image_url||'').split('//')[1];
      if (/^[0-9a-f-]{36}$/.test(id||'')) { await conn.query('DELETE FROM ldrs_v6.uploads WHERE id=$1',[id]); photos.push(id); }
    }
    auditRemoved=await purgeAuditOlderThan(conn,auditDays);
    await conn.query('COMMIT');
  } catch(err){await conn.query('ROLLBACK').catch(()=>{});throw err;} finally{conn.release();}
  for (const id of photos) fs.rmSync(path.join(PHOTO_DIR,id+'.bin'),{force:true});
  await ctx.audit(user.id,'retention_run',`${markedUnclaimed} marked unclaimed, ${disposed} disposed (handed to the registration authority), ${auditRemoved} old audit entries removed`,'Admin');
  return {markedUnclaimed,disposed,auditRemoved};
}
async function workflow(ctx,name,args) {
  const {pool,user,audit,challengeFor,redeemChallenge}=ctx; const role=roleOf(user);
  if (['getCollectionCodeStatus','generateCollectionCode','completeHandover'].includes(name)) return handoverWorkflow(ctx,name,args);
  if(name==='listPublicPickupPoints') return (await pool.query(`SELECT id,name,point_type,location,county,contact_phone,opening_hours,active,verified FROM ldrs_v6.pickup_points WHERE active=true AND verified=true ORDER BY name`)).rows;
  if(name==='sendPhoneCode') {
    insist(['Owner','Finder','Officer','Admin'].includes(role),'Login required.',403);
    const phone=text(args.phone,30).replace(/[\s-]/g,'');insist(/^(?:\+254|0)7\d{8}$/.test(phone),'Enter a Kenyan phone number.');
    const attempts=(await pool.query(`SELECT count(*)::int AS n FROM ldrs_v6.rate_events WHERE user_id=$1 AND kind='phone_code' AND created_at>now()-interval '15 minutes'`,[user.id])).rows[0].n;
    insist(attempts<3,'Too many phone codes requested. Try again later.',429);
    await pool.query(`INSERT INTO ldrs_v6.rate_events(id,user_id,kind) VALUES($1,$2,'phone_code')`,[crypto.randomUUID(),user.id]);
    return challengeFor({...user,phone},'phone');
  }
  if(name==='verifyPhoneCode') {const record=await redeemChallenge(text(args.challenge_id,120),text(args.code,6),'phone');insist(record.id===user.id,'Verification belongs to another account.',403);
    const result=await pool.query(`UPDATE ldrs_v6.users SET phone=$1,phone_verified=true,updated_at=now() WHERE id=$2 RETURNING phone`,[record.challenge_phone,user.id]);await audit(user.id,'phone_verified','Phone verified',role);return {status:'ok',phone:result.rows[0].phone};}
  if(name==='submitLossReport') {
    insist(role==='Owner','Owner account required.',403);insist(user.phone_verified&&user.phone,'Verify your phone before reporting.',403);insist(args.consent===true,'Consent required.');
    const place=checkPlace(args,false);
    const kind=text(args.document_type,80),owner=text(args.owner_name,120),number=text(args.document_number,80),date=args.date_lost||null;
    insist(kind&&owner.length>=3&&number.length>=4,'Document details are incomplete.');insist(!date||(/^\d{4}-\d{2}-\d{2}$/.test(date)&&date<=new Date().toISOString().slice(0,10)),'Invalid or future date.');
    const duplicate=await pool.query(`SELECT id FROM ldrs_v6.loss_reports WHERE owner_user_id=$1 AND document_type=$2 AND regexp_replace(upper(coalesce(document_number,'')),'[^A-Z0-9]','','g')=$3 AND status!='Closed' LIMIT 1`,[user.id,kind,norm(number)]);
    insist(!duplicate.rows.length,'This report is already open.',409);
    const report=(await pool.query(`INSERT INTO ldrs_v6.loss_reports(id,owner_user_id,document_type,owner_name,document_number,phone,consent_given,date_lost,phone_verified,county,sub_county,ward,landmark) VALUES($1,$2,$3,$4,$5,$6,true,$7,true,$8,$9,$10,$11) RETURNING *`,[crypto.randomUUID(),user.id,kind,owner,number,user.phone,date,place.county,place.sub_county,place.ward,place.landmark])).rows[0];
    const pairs=await createMatches(ctx,null,report);await audit(user.id,'report_created','Loss report saved in PostgreSQL',role);
    return {report:safeRow('LossReport',report,user),matches:await Promise.all(pairs.map(async x=>{const q=await pool.query('SELECT name FROM ldrs_v6.pickup_points WHERE id=$1',[x.pickup_point_id]);return {match_type:x.match.match_type,pickup_point_name:q.rows[0]?.name||''};}))};
  }
  if(name==='registerFoundDocument') {
    insist(['Finder','Officer','Admin'].includes(role),'Finder or staff required.',403);if(role==='Officer')insist(approvedOfficer(user),'Officer awaiting approval.',403);
    const pointId=role==='Officer'?user.pickup_point_id:args.pickup_point_id;
    const pt=(await pool.query(`SELECT id,name FROM ldrs_v6.pickup_points WHERE id=$1 AND active=true AND verified=true`,[pointId])).rows[0];insist(pt,'Choose a verified pickup point.');
    const place=checkPlace(args,true);
    const kind=text(args.document_type,80),owner=upper(args.owner_name),number=upper(args.document_number),found=describePlace(place),date=args.date_found;
    insist(kind&&owner.length>=3&&number.length>=4&&found&&/^\d{4}-\d{2}-\d{2}$/.test(String(date))&&date<=new Date().toISOString().slice(0,10),'Document details are incomplete or date is in the future.');
    insist(typeof args.image_url==='string'&&args.image_url.startsWith('ldrs-private://'),'Upload a photograph first.');
    const uploaded=await pool.query(`SELECT id FROM ldrs_v6.uploads WHERE file_uri=$1 AND uploaded_by=$2`,[args.image_url,user.id]);insist(uploaded.rows.length,'Photograph was not uploaded by this account.',403);
    const duplicates=(await pool.query(`SELECT id FROM ldrs_v6.documents WHERE document_type=$1 AND upper(document_number)=$2 AND status!='Returned' LIMIT 1`,[kind,number])).rows;
    const reasons=duplicates.length?['A document with this number is already registered.']:[];
    const ocr=args.ocr||{};
    const doc=(await pool.query(`INSERT INTO ldrs_v6.documents(id,finder_user_id,document_type,owner_name,document_number,found_location,date_found,pickup_point_id,image_url,image_sha256,image_phash,ocr_used,ocr_name_accepted,ocr_number_accepted,ocr_name_confidence,ocr_number_confidence,duplicate_flag,duplicate_reasons,duplicate_of_id,county,sub_county,ward,landmark)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`,
       [crypto.randomUUID(),user.id,kind,owner,number,found,date,pointId,args.image_url,text(args.image_sha256,128)||null,text(args.image_phash,128)||null,!!ocr.used,ocr.used?!!ocr.name_accepted:null,ocr.used?!!ocr.number_accepted:null,Number.isFinite(Number(ocr.name_confidence))?Number(ocr.name_confidence):null,Number.isFinite(Number(ocr.number_confidence))?Number(ocr.number_confidence):null,reasons.length>0,JSON.stringify(reasons),duplicates[0]?.id||null,place.county,place.sub_county,place.ward,place.landmark])).rows[0];
    const pairs=await createMatches(ctx,doc);await audit(user.id,'document_created','Found document and photo recorded in PostgreSQL',role);
    return {document:safeRow('Document',doc,user),exact:pairs.filter(x=>x.match.match_type==='Exact').length,fuzzy:pairs.filter(x=>x.match.match_type==='Fuzzy').length,duplicate_reasons:reasons,pickup_point_name:pt.name};
  }
  if(name==='closeLossReport'){insist(role==='Owner','Owner required.',403);const result=await pool.query(`UPDATE ldrs_v6.loss_reports SET status='Closed',updated_at=now() WHERE id=$1 AND owner_user_id=$2 RETURNING id`,[args.report_id,user.id]);insist(result.rows.length,'Report not found.',404);await audit(user.id,'report_closed','Owner closed loss report',role);return {status:'ok'};}
  if(name==='searchStatus'){const used=(await pool.query(`SELECT count(*)::int AS n FROM ldrs_v6.rate_events WHERE user_id=$1 AND kind='search' AND created_at>now()-interval '1 hour'`,[user.id])).rows[0].n;const limit=await getSetting(pool,'search_limit_per_hour');return {used,limit,remaining:Math.max(0,limit-used),captcha_required:false};}
  if(name==='searchFoundDocuments') {
    insist(role==='Owner'||role==='Admin','Owner access required.',403);insist(role==='Admin'||user.phone_verified,'Verify phone before searching.',403);
    const nameNeedle=text(args.name,120),numberNeedle=norm(args.number);insist(nameNeedle.length>=3||numberNeedle.length>=4,'Enter a name or document number.');
    const since=(await pool.query(`SELECT count(*)::int AS n FROM ldrs_v6.rate_events WHERE user_id=$1 AND kind='search' AND created_at>now()-interval '1 hour'`,[user.id])).rows[0].n;
    const searchLimit=await getSetting(pool,'search_limit_per_hour');
    insist(since<searchLimit,'Too many searches. Try again later.',429);
    await pool.query(`INSERT INTO ldrs_v6.rate_events(id,user_id,kind) VALUES($1,$2,'search')`,[crypto.randomUUID(),user.id]);
    const found=await pool.query(`SELECT d.id,d.document_type,d.owner_name,d.document_number,d.found_location,d.date_found,d.status,p.county FROM ldrs_v6.documents d LEFT JOIN ldrs_v6.pickup_points p ON p.id=d.pickup_point_id
      WHERE d.status IN ('Found','Matched','Notified') AND ($1='' OR d.document_type=$1) AND (($2<>'' AND upper(d.owner_name) LIKE '%'||upper($2)||'%') OR ($3<>'' AND upper(d.document_number) LIKE '%'||upper($3)||'%')) LIMIT 10`,[args.document_type||'',nameNeedle,numberNeedle]);
    await audit(user.id,'document_search',`${found.rows.length} masked results returned`,role);
    return {results:found.rows.map(r=>({...r,owner_name:maskName(r.owner_name),document_number:maskNumber(r.document_number)})),remaining:Math.max(0,searchLimit-1-since),captcha_required:false};
  }
  if(name==='submitClaim') return addEntity(ctx,'Claim',args);
  if(name==='completeDataRequest') {
    insist(role==='Admin','Administrator required.',403); insist(uuidRe.test(String(args.request_id||'')),'Invalid request ID.');
    const decision=args.decision==='Declined'?'Declined':'Completed';
    const conn=await pool.connect();
    try {
      await conn.query('BEGIN');
      const request=(await conn.query(`SELECT * FROM ldrs_v6.data_requests WHERE id=$1 FOR UPDATE`,[args.request_id])).rows[0];
      insist(request,'Request not found.',404); insist(request.status==='Open','Request already handled.',409);
      let summary=text(args.response,500);
      if(request.request_type==='Removal'&&decision==='Completed') {
        const removed=await conn.query(`UPDATE ldrs_v6.loss_reports SET status='Closed',owner_name='REMOVED',document_number='REMOVED',phone='',updated_at=now()
          WHERE owner_user_id=$1 AND status<>'Matched'`,[request.owner_user_id]);
        await conn.query(`UPDATE ldrs_v6.claims SET status='Rejected',owner_name='REMOVED',phone='',document_number='',note='',updated_at=now()
          WHERE owner_user_id=$1 AND status='Pending'`,[request.owner_user_id]);
        summary=summary||`${removed.rowCount} report(s) anonymised.`;
      }
      await conn.query(`UPDATE ldrs_v6.data_requests SET status=$1,response=$2,updated_at=now() WHERE id=$3`,[decision,summary,request.id]);
      await audit(user.id,'data_request',`${request.request_type} request ${request.id.slice(0,8)} ${decision.toLowerCase()}`,role,conn);
      await conn.query('COMMIT');
    } catch(err){await conn.query('ROLLBACK').catch(()=>{});throw err;} finally{conn.release();}
    return {status:'ok'};
  }
  if (['confirmMatch','rejectMatch','sendCollectionReminder'].includes(name)) {
    insist(role==='Admin'||approvedOfficer(user),'Approved staff required.',403);
    const m=(await pool.query(`SELECT m.*,d.pickup_point_id,d.status AS document_status,d.document_type,d.document_number,p.name AS station_name
      FROM ldrs_v6.matches m JOIN ldrs_v6.documents d ON d.id=m.document_id
      LEFT JOIN ldrs_v6.pickup_points p ON p.id=d.pickup_point_id WHERE m.id=$1`,[args.match_id])).rows[0];
    insist(m,'Match not found.',404);
    insist(role==='Admin'||m.pickup_point_id===user.pickup_point_id,'Another station owns this document.',403);
    insist(m.document_status!=='Returned','Document already released.',409);
    if(name==='sendCollectionReminder')insist(m.match_status==='Confirmed','Only confirmed matches can be reminded.',409);
    else insist(m.match_status==='Pending','Only pending matches can be decided.',409);
    if(name==='sendCollectionReminder') {
      await pool.query(`INSERT INTO ldrs_v6.notifications(id,user_id,message)
        VALUES($1,$2,$3)`,[crypto.randomUUID(),m.owner_user_id,`LDRS: Your ${m.document_type} is ready at ${m.station_name}. Reference: ${m.reference_code}. Bring proof of ownership.`]);
      await audit(user.id,'collection_reminder','Collection reminder saved to in-app alerts',role);return {status:'ok'};
    }
    const target=name==='confirmMatch'?'Confirmed':'Rejected';
    const conn=await pool.connect();
    try {
      await conn.query('BEGIN');
      await conn.query(`UPDATE ldrs_v6.matches SET match_status=$1,updated_at=now() WHERE id=$2`,[target,m.id]);
      if(target==='Confirmed') {
        await conn.query(`UPDATE ldrs_v6.documents SET status='Notified',updated_at=now() WHERE id=$1`,[m.document_id]);
        if(m.loss_report_id)await conn.query(`UPDATE ldrs_v6.loss_reports SET status='Matched',updated_at=now() WHERE id=$1`,[m.loss_report_id]);
        await conn.query(`INSERT INTO ldrs_v6.notifications(id,user_id,message) VALUES($1,$2,$3)`,[crypto.randomUUID(),m.owner_user_id,`LDRS: Your ${m.document_type} may be ready at ${m.station_name}. Reference: ${m.reference_code}. Bring proof of ownership.`]);
      }
      await audit(user.id, name, `Decision recorded on match ${m.id}`,role,conn);
      await conn.query('COMMIT');
    } catch(err){await conn.query('ROLLBACK');throw err;}finally{conn.release();}
    return name==='confirmMatch'?{reference_code:m.reference_code}:{status:'ok'};
  }
  if (['approveClaim','rejectClaim'].includes(name)) {
    insist(role==='Admin'||approvedOfficer(user),'Approved staff required.',403);
    const claim=(await pool.query(`SELECT c.*,d.pickup_point_id,d.status AS doc_status,d.document_type AS doc_type,d.document_number AS doc_number,p.name AS station_name
      FROM ldrs_v6.claims c JOIN ldrs_v6.documents d ON d.id=c.document_id
      LEFT JOIN ldrs_v6.pickup_points p ON p.id=d.pickup_point_id WHERE c.id=$1`,[args.claim_id])).rows[0];
    insist(claim,'Claim not found.',404);
    insist(role==='Admin'||claim.pickup_point_id===user.pickup_point_id,'Another station owns this document.',403);
    insist(claim.status==='Pending','Claim already reviewed.',409);
    insist(claim.doc_status!=='Returned','Document already released.',409);
    const approval=name==='approveClaim';
    const conn=await pool.connect();let reference='';
    try {
      await conn.query('BEGIN');
      if(approval) {
        reference=crypto.randomBytes(4).toString('hex').toUpperCase();
        const exact=norm(claim.doc_number)===norm(claim.document_number);
        const match=(await conn.query(`INSERT INTO ldrs_v6.matches(id,document_id,owner_user_id,match_score,match_type,match_status,reference_code)
          VALUES($1,$2,$3,$4,$5,'Confirmed',$6) RETURNING id`,[crypto.randomUUID(),claim.document_id,claim.owner_user_id,exact?100:75,exact?'Exact':'Fuzzy',reference])).rows[0];
        await conn.query(`UPDATE ldrs_v6.claims SET status='Approved',match_id=$1,reference_code=$2,updated_at=now() WHERE id=$3`,[match.id,reference,claim.id]);
        await conn.query(`UPDATE ldrs_v6.documents SET status='Notified',updated_at=now() WHERE id=$1`,[claim.document_id]);
      } else await conn.query(`UPDATE ldrs_v6.claims SET status='Rejected',updated_at=now() WHERE id=$1`,[claim.id]);
      const message=approval?`LDRS: Your claim was approved. Collect your ${claim.doc_type} at ${claim.station_name}; reference ${reference}. Bring proof of ownership.`:`LDRS: Your claim was not approved. Bring proof of ownership to the pickup point for review.`;
      await conn.query(`INSERT INTO ldrs_v6.notifications(id,user_id,message) VALUES($1,$2,$3)`,[crypto.randomUUID(),claim.owner_user_id,message]);
      await audit(user.id,name,`Claim ${claim.id} reviewed`,role,conn);
      await conn.query('COMMIT');
    } catch(err){await conn.query('ROLLBACK');throw err;}finally{conn.release();}
    return approval?{reference_code:reference}:{status:'ok'};
  }
  if(name==='statistics') return statistics(ctx);
  if(name==='runRetention') return runRetention(ctx);
  if(name==='exportAnonymised') {
    insist(role==='Admin','Only administrators can export data.',403);
    const {rows}=await pool.query(`SELECT d.id,d.document_type,d.status,d.created_at,d.returned_at,d.duplicate_flag,d.ocr_used,p.name AS point,p.county
      FROM ldrs_v6.documents d LEFT JOIN ldrs_v6.pickup_points p ON p.id=d.pickup_point_id ORDER BY d.created_at`);
    const lines=[['record','document_type','status','pickup_point','county','month_registered','days_to_recovery','duplicate_flag','ocr_used'],
      ...rows.map(d=>[crypto.createHash('sha256').update('ldrs-export:'+d.id).digest('hex').slice(0,10),d.document_type,d.status,d.point||'',d.county||'',
        new Date(d.created_at).toISOString().slice(0,7),d.returned_at?Math.round((new Date(d.returned_at)-new Date(d.created_at))/86400000):'',d.duplicate_flag?'yes':'no',d.ocr_used?'yes':'no'])];
    await ctx.audit(user.id,'data_export',`Anonymised document export (${rows.length} rows)`,role);
    return {filename:`ldrs-anonymised-${new Date().toISOString().slice(0,10)}.csv`,csv:lines.map(l=>l.map(csvCell).join(',')).join('\r\n')+'\r\n'};
  }
  if(name==='exportMyData') {
    insist(role==='Owner'||role==='Finder','Only owners and finders can download their own data.',403);
    const mine=async(entity,field)=>(await pool.query(`SELECT * FROM ldrs_v6.${tables[entity][0]} WHERE ${field}=$1 ORDER BY created_at`,[user.id])).rows.map(r=>safeRow(entity,r,user));
    const me=(await pool.query('SELECT * FROM ldrs_v6.users WHERE id=$1',[user.id])).rows[0];
    const data={generated_at:new Date().toISOString(),account:safeRow('User',me,user),loss_reports:await mine('LossReport','owner_user_id'),claims:await mine('Claim','owner_user_id'),
      notifications:await mine('Notification','user_id'),data_requests:await mine('DataRequest','owner_user_id'),documents_handed_in:await mine('Document','finder_user_id')};
    await ctx.audit(user.id,'data_request','User downloaded a copy of their data',role);
    return data;
  }
  if(name==='verifyAuditChain') {
    insist(role==='Admin','Administrator required.',403);
    const result=await verifyChain(pool);
    await ctx.audit(user.id,'audit_chain_verified',result.ok?`Chain intact (${result.checked} entries; ${result.legacy} before chain)`:`Chain BROKEN at entry ${result.brokenAt}: ${result.reason}`,role);
    return result;
  }
  if(name==='securityAlerts') {
    insist(role==='Admin','Admin required.',403);
    const locked=(await pool.query(`SELECT count(*)::int AS n FROM ldrs_v6.users WHERE locked_until>now()`)).rows[0].n;
    const failed=(await pool.query(`SELECT count(*)::int AS n FROM ldrs_v6.users WHERE failed_logins>=3`)).rows[0].n;
    const alerts=[];
    if(locked)alerts.push({level:'high',title:'Accounts temporarily locked',detail:`${locked} account(s) currently locked after failed sign-ins.`});
    if(failed)alerts.push({level:'medium',title:'Repeated sign-in failures',detail:`${failed} account(s) have three or more failed login attempts.`});
    return alerts;
  }
  abort(501,`${name} is not yet connected to PostgreSQL.`);
}
export async function recordsRoute(ctx,req,res,url) {
  const p=url.pathname;
  if(!p.startsWith('/api/v6/entities/')&&!p.startsWith('/api/v6/functions/')&&!p.startsWith('/api/v6/uploads'))return false;
  const {jsonBody,respond,user}=ctx;
  if(p==='/api/v6/uploads'&&req.method==='POST'){await upload(ctx,req,res);return true;}
  const imageMatch=p.match(/^\/api\/v6\/uploads\/([0-9a-f-]{36})$/);
  if(imageMatch&&req.method==='GET'){await download(ctx,imageMatch[1],res);return true;}
  if(p==='/api/v6/functions/invoke'&&req.method==='POST') {
    const x=await jsonBody(req);insist(typeof x.name==='string'&&x.name.length<100,'Invalid function.');
    const result=await workflow(ctx,x.name,x.args||{});respond(res,200,result);return true;
  }
  const m=p.match(/^\/api\/v6\/entities\/([A-Za-z]+)(?:\/([0-9a-f-]{36}|[^/]+))?(?:\/(filter|count))?$/);
  if(!m) abort(404,'Unknown data endpoint.');
  const [,name,id,action]=m;insist(tables[name],`Unknown entity: ${name}`,404);
  if(req.method==='POST'&&id==='filter'){const x=await jsonBody(req);respond(res,200,await listEntities(ctx,name,x.query||{},x.options||{}));return true;}
  if(req.method==='POST'&&id==='count'){const x=await jsonBody(req);const result=await listEntities(ctx,name,x.query||{},{});respond(res,200,{total:result.total});return true;}
  if(req.method==='GET'&&!id){respond(res,200,await listEntities(ctx,name,{},{}));return true;}
  if(req.method==='GET'&&id){respond(res,200,await getEntity(ctx,name,id));return true;}
  if(req.method==='PATCH'&&id){respond(res,200,await editEntity(ctx,name,id,await jsonBody(req)));return true;}
  if(req.method==='POST'&&!id){respond(res,201,await addEntity(ctx,name,await jsonBody(req)));return true;}
  abort(405,'Method not supported.');
}
