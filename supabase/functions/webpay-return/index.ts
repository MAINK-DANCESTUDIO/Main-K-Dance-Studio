import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
Deno.serve(async req=>{
 const url=Deno.env.get('SUPABASE_URL')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;const db=createClient(url,service);
 const frontend=Deno.env.get('FRONTEND_URL')||'http://localhost:5173';
 try{
  const u=new URL(req.url);let params=new URLSearchParams(u.search);
  if(req.method==='POST'){const ct=req.headers.get('content-type')||'';if(ct.includes('application/x-www-form-urlencoded'))params=new URLSearchParams(await req.text());else if(ct.includes('multipart/form-data')){const f=await req.formData();params=new URLSearchParams();for(const [k,v] of f.entries())params.set(k,String(v));}}
  const token=params.get('token_ws'), aborted=params.get('TBK_TOKEN'), orderFromAbort=params.get('TBK_ORDEN_COMPRA');
  if(aborted){if(orderFromAbort)await db.from('payments').update({status:'cancelled'}).eq('provider_order',orderFromAbort).eq('provider','webpay');return Response.redirect(`${frontend}/?payment=cancelled`,303);}
  if(!token)return Response.redirect(`${frontend}/?payment=error`,303);
  const apiKey=Deno.env.get('TBK_API_KEY_ID'),secret=Deno.env.get('TBK_API_KEY_SECRET');if(!apiKey||!secret)return Response.redirect(`${frontend}/?payment=error`,303);
  const base=Deno.env.get('TBK_ENVIRONMENT')==='production'?'https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions':'https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions';
  const res=await fetch(`${base}/${encodeURIComponent(token)}`,{method:'PUT',headers:{'Tbk-Api-Key-Id':apiKey,'Tbk-Api-Key-Secret':secret,'Content-Type':'application/json'}});const result=await res.json();
  const approved=res.ok&&result.response_code===0&&result.status==='AUTHORIZED';
  if(result.buy_order){await db.from('payments').update({status:approved?'paid':'failed',authorization_code:result.authorization_code||null,paid_at:approved?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('provider_order',result.buy_order).eq('provider','webpay');}
  return Response.redirect(`${frontend}/?payment=${approved?'success':'failed'}`,303);
 }catch(_){return Response.redirect(`${frontend}/?payment=error`,303);}
});
