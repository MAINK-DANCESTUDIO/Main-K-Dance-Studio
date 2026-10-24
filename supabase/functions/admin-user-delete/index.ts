import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth=req.headers.get('Authorization')||'';const caller=createClient(url,anon,{global:{headers:{Authorization:auth}}});const {data:{user},error}=await caller.auth.getUser();if(error||!user)return Response.json({error:'No autenticado'},{status:401,headers:cors});
  const admin=createClient(url,service);const {data:profile}=await admin.from('profiles').select('role').eq('id',user.id).maybeSingle();if(profile?.role!=='admin')return Response.json({error:'Solo administración puede eliminar cuentas'},{status:403,headers:cors});
  const {user_id}=await req.json();if(!user_id||user_id===user.id)return Response.json({error:'No puedes eliminar tu propia cuenta'},{status:400,headers:cors});
  const {data:target}=await admin.from('profiles').select('role').eq('id',user_id).maybeSingle();if(!target)return Response.json({error:'Usuario no encontrado'},{status:404,headers:cors});
  if(target.role==='admin'){const {count}=await admin.from('profiles').select('id',{count:'exact',head:true}).eq('role','admin').eq('active',true);if((count||0)<=1)return Response.json({error:'No se puede eliminar al último administrador activo'},{status:400,headers:cors});}
  const {error:deleteError}=await admin.auth.admin.deleteUser(user_id);if(deleteError)throw deleteError;
  return Response.json({ok:true},{headers:cors});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Error interno'},{status:500,headers:cors});}
});
