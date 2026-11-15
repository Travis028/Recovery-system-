import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { digestCode, constantEqual, receiptDigest, handoverWorkflow, verifyPublicReceipt } from '../handover.mjs';
const key=crypto.randomBytes(32);
const alice={id:'11111111-1111-4111-8111-111111111111',role:'user',ldrs_role:'Owner',approved:false,pickup_point_id:null};
const officer={...alice,ldrs_role:'Officer',approved:false,pickup_point_id:'22222222-2222-4222-8222-222222222222'};
const matchId='33333333-3333-4333-8333-333333333333';
test('OTP hashes are stable but are not plaintext or interchangeable',()=>{
  const h=digestCode(key,matchId,'123456');
  assert.equal(h,digestCode(key,matchId,'123456'));
  assert.notEqual(h,digestCode(key,matchId,'654321'));
  assert.notEqual(h,'123456');
});
test('constant-time equality checks equal, unequal and length differences',()=>{
  assert.equal(constantEqual('ABC','ABC'),true);
  assert.equal(constantEqual('ABC','ABD'),false);
  assert.equal(constantEqual('ABC','AB'),false);
});
test('receipt signature changes if the claimant or record changes',()=>{
  const r={id:matchId,document_id:alice.id,match_id:matchId,officer_user_id:officer.id,
    released_to:'Fictional Test',claimant_id_type:'National ID',claimant_id_number:'00000000',pickup_point_id:officer.pickup_point_id,created_at:new Date().toISOString()};
  assert.equal(receiptDigest(key,r),receiptDigest(key,r));
  assert.notEqual(receiptDigest(key,r),receiptDigest(key,{...r,released_to:'Another claimant'}));
});
test('owner cannot request a collection code or status',async()=>{
  const ctx={user:alice,pool:{query:async()=>{throw Error('Should not query database');}}};
  await assert.rejects(()=>handoverWorkflow(ctx,'getCollectionCodeStatus',{match_id:matchId}),{status:403});
});
test('unapproved officer cannot request a collection code',async()=>{
  const ctx={user:officer,pool:{query:async()=>{throw Error('Should not query database');}}};
  await assert.rejects(()=>handoverWorkflow(ctx,'getCollectionCodeStatus',{match_id:matchId}),{status:403});
});
test('production cannot issue a pretend collection SMS',async()=>{
  const orig=process.env.LDRS_DEMO_OTP;
  process.env.LDRS_DEMO_OTP='0';
  try { await assert.rejects(()=>handoverWorkflow({user:{...officer,approved:true},pool:{}},'generateCollectionCode',{match_id:matchId}),{status:503}); }
  finally { if(orig===undefined)delete process.env.LDRS_DEMO_OTP; else process.env.LDRS_DEMO_OTP=orig; }
});
test('a bad receipt reference returns only invalid',async()=>{
  let sqlCalled=false;
  const reply=await verifyPublicReceipt({query:async()=>{sqlCalled=true;return {rows:[]};}}, 'not-a-uuid','not-a-hash');
  assert.deepEqual(reply,{valid:false});assert.equal(sqlCalled,false);
});
