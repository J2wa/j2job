import {denied} from "@/lib/access";
import {providers,providerNames,catalogFor,modelOrder} from "@/lib/provider-models";
import {providerEnabled} from "@/lib/api-keys";
import {selectProvider} from "@/lib/openrouter";
export const runtime="nodejs";
export const maxDuration=30;
export async function GET(request:Request) {
 const rejection=denied(request);if(rejection)return rejection;
 try {
  const list=await Promise.all(providers.map(async provider=>{
   const enabled=providerEnabled(provider);
   if(!enabled)return {id:provider,name:providerNames[provider],enabled,models:[],source:"not configured"};
   const {models,source}=await catalogFor(provider);
   const allowed=new Set(modelOrder(provider,models));
   return {id:provider,name:providerNames[provider],enabled,source,models:models.filter(m=>allowed.has(m.id)).map(m=>({id:m.id}))};
  }));
  return Response.json({providers:list,defaultProvider:selectProvider("auto")},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Could not load model options. Check provider configuration."},{status:503});}
}
