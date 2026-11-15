import test from 'node:test';
import assert from 'node:assert/strict';
import {recordsRoute} from '../records.mjs';

const owner={id:'11111111-1111-4111-8111-111111111111',role:'user',ldrs_role:'Owner',approved:false,pickup_point_id:null};
const officer={id:'22222222-2222-4222-8222-222222222222',role:'user',ldrs_role:'Officer',approved:false,pickup_point_id:'33333333-3333-4333-8333-333333333333'};
function makeCtx(user=owner,payload={query:{},options:{}}){
  const calls=[];let output=null;
  const ctx={user,calls, pool:{query:async(sql,params)=>{calls.push({sql,params});return sql.includes('count(*)::int AS total')?{rows:[{total:0}]}:{rows:[]};}},jsonBody:async()=>payload,respond:(res,status,data)=>{output={status,data};},audit:async()=>{}};
  return {ctx,calls,get result(){return output;}};
}
async function call(x,route,method='POST'){await recordsRoute(x.ctx,{method},{},new URL('http://127.0.0.1:4001'+route));}

test('owner document queries are database-scoped by owner matches/claims',async()=>{
  const x=makeCtx();await call(x,'/api/v6/entities/Document/filter');
  assert.equal(x.result.status,200);
  assert.match(x.calls[0].sql,/owner_user_id=\$1/);
  assert.equal(x.calls[0].params[0],owner.id);
});
test('unapproved officer cannot enumerate documents',async()=>{
  const x=makeCtx(officer);
  await assert.rejects(()=>call(x,'/api/v6/entities/Document/filter'),{status:403});
  assert.equal(x.calls.length,0);
});
test('unauthorized entity fields cannot be added to SQL',async()=>{
  const x=makeCtx(owner,{query:{'id; DROP TABLE users': 'x'}});
  await assert.rejects(()=>call(x,'/api/v6/entities/Document/filter'),{status:422});
});
test('owner cannot update station records',async()=>{
  const x=makeCtx(owner, {verified:true});
  await assert.rejects(()=>call(x,'/api/v6/entities/PickupPoint/33333333-3333-4333-8333-333333333333','PATCH'),{status:404});
});
test('finder cannot view global audit trail',async()=>{
  const x=makeCtx({...owner,ldrs_role:'Finder'});
  await assert.rejects(()=>call(x,'/api/v6/entities/AuditLog/filter'),{status:403});
});
test('statistics returns the full screen shape, scoped to the officer station',async()=>{
  const approved={...officer,approved:true};
  const now=new Date();
  const pool={query:async(sql,params)=>{
    if(sql.includes('FROM ldrs_v6.documents d LEFT JOIN')){assert.match(sql,/d\.pickup_point_id=\$1/);assert.equal(params[0],approved.pickup_point_id);
      return {rows:[{id:'a',document_type:'National ID',status:'Returned',created_at:now,returned_at:now,ocr_used:true,ocr_name_accepted:true,ocr_number_accepted:false,duplicate_flag:false,point_name:'Station'},
        {id:'b',document_type:'Passport',status:'Found',created_at:now,returned_at:null,ocr_used:false,duplicate_flag:true,point_name:'Station'}]};}
    if(sql.includes('count(DISTINCT m.document_id)'))return {rows:[{n:1}]};
    if(sql.includes('SELECT name FROM'))return {rows:[{name:'Station'}]};
    throw Error('unexpected SQL '+sql);
  }};
  let out=null;
  await recordsRoute({user:approved,pool,jsonBody:async()=>({name:'statistics',args:{}}),respond:(r,s,d)=>{out=d;},audit:async()=>{}},{method:'POST'},{},new URL('http://127.0.0.1:4001/api/v6/functions/invoke'));
  assert.equal(out.found,2); assert.equal(out.returned,1); assert.equal(out.matched,1); assert.equal(out.recovery_rate,50);
  assert.equal(out.months.length,6); assert.equal(out.months.at(-1).found,2); assert.deepEqual(out.by_type,{'National ID':1,Passport:1});
  assert.deepEqual(out.by_station,{}); assert.equal(out.open_reports,null); assert.equal(out.ocr_accuracy,50); assert.equal(out.duplicates,1); assert.equal(out.scope,'Station');
});
test('unapproved officer cannot read statistics',async()=>{
  const x=makeCtx(officer,{name:'statistics',args:{}});
  await assert.rejects(()=>call(x,'/api/v6/functions/invoke'),{status:403});
});
