import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const base=()=>Deno.env.get('TBK_ENVIRONMENT')==='production'?'https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions':'https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth=req.headers.get('Authorization')||'';const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:ue}=await userClient.auth.getUser();if(ue||!user)return Response.json({error:'No autenticado'},{status:401,headers:cors});
  const db=createClient(url,service);const {data:profile}=await db.from('profiles').select('active').eq('id',user.id).maybeSingle();if(!profile?.active)return Response.json({error:'Cuenta inactiva'},{status:403,headers:cors});
  const body=await req.json();const amount=Math.round(Number(body.amount));const description=String(body.description||'Pago K-Dance').slice(0,120);
  if(!Number.isFinite(amount)||amount<50||amount>5000000)return Response.json({error:'Monto inválido'},{status:400,headers:cors});
  const order='KD'+Date.now().toString(36).toUpperCase()+crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
  const {data:payment,error:pe}=await db.from('payments').insert({user_id:user.id,description,amount,status:'pending',provider:'webpay',provider_order:order}).select('id').single();if(pe)throw pe;
  const apiKey=Deno.env.get('TBK_API_KEY_ID'), secret=Deno.env.get('TBK_API_KEY_SECRET');if(!apiKey||!secret)throw new Error('Faltan secretos de Webpay');
  const returnUrl=`${url}/functions/v1/webpay-return`;
  const res=await fetch(base(),{method:'POST',headers:{'Content-Type':'application/json','Tbk-Api-Key-Id':apiKey,'Tbk-Api-Key-Secret':secret},body:JSON.stringify({buy_order:order,session_id:user.id,amount,return_url:returnUrl})});
  const result=await res.json();if(!res.ok||!result.token||!result.url){await db.from('payments').update({status:'failed'}).eq('id',payment.id);throw new Error(result.error_message||'Transbank no pudo crear la transacción');}
  await db.from('payments').update({provider_token:result.token}).eq('id',payment.id);
  return Response.json({url:result.url,token:result.token},{headers:cors});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Error interno'},{status:500,headers:cors});}
});
