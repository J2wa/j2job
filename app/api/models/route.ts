import {denied} from "@/lib/access";
import {resumeProviders,providerNames,catalogFor,automaticModelOrder} from "@/lib/provider-models";
import {providerEnabled} from "@/lib/api-keys";
export const runtime="nodejs";
export const maxDuration=30;
export async function GET(request:Request) {
 const rejection=denied(request);if(rejection)return rejection;
 try {
  const list=await Promise.all(resumeProviders.map(async provider=>{
   const enabled=providerEnabled(provider);
   if(!enabled)return {id:provider,name:providerNames[provider],enabled,models:[],source:"not configured"};
   const {models,source}=await catalogFor(provider);
   const allowed=new Set(automaticModelOrder(provider,models));
   return {id:provider,name:providerNames[provider],enabled,source,models:models.filter(m=>allowed.has(m.id)).map(m=>({id:m.id}))};
  }));
  return Response.json({providers:list,defaultProvider:list.find(provider=>provider.enabled)?.id??null,order:resumeProviders},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Could not load model options. Check provider configuration."},{status:503});}
}
