import { ResumeGenerationError } from "./model-fallback.ts";
export type Provider = "gateway" | "openrouter" | "gemini" | "openai";
export function parseKeys(multiple?:string,single?:string):string[] {
  let values:unknown=[];
  if(multiple?.trim()) {
    try {values=multiple.trim().startsWith("[")?JSON.parse(multiple):multiple.split(/[\n,]+/);}
    catch {throw new ResumeGenerationError("configuration");}
    if(!Array.isArray(values)||values.some(x=>typeof x!=="string"))throw new ResumeGenerationError("configuration");
  }
  const keys=[...new Set([...(values as string[]),single??""].map(x=>x.trim()).filter(Boolean))];
  if(keys.length>32)throw new ResumeGenerationError("configuration");
  return keys;
}
export function providerKeys(provider:Provider,env:Record<string,string|undefined>=process.env) {
  const prefix=provider==="gateway"?"AI_GATEWAY":provider.toUpperCase();
  return parseKeys(env[prefix+"_API_KEYS"],env[prefix+"_API_KEY"] || (provider==="gemini"?env.GOOGLE_GENERATIVE_AI_API_KEY:undefined));
}
export function providerEnabled(provider:Provider,env:Record<string,string|undefined>=process.env) {
  return providerKeys(provider,env).length>0 || provider==="gateway"&&Boolean(env.VERCEL_OIDC_TOKEN);
}
// Each request has its own pool. Secrets remain inside this closure, never in response metadata.
export function createKeyRunner(keys:string[],attemptMs=25000) {
  let preferred=0;
  const disabled=new Set<number>();
  let lastFailure:unknown=Object.assign(new Error("No usable provider keys"),{statusCode:401});
  return async <T>(run:(key:string,attemptSignal:AbortSignal)=>Promise<T>,signal:AbortSignal):Promise<T>=>{
    if(!keys.length)throw Object.assign(new Error("No configured provider keys"),{statusCode:401});
    let last:unknown=lastFailure;
    for(let offset=0;offset<keys.length;offset++) {
      const index=(preferred+offset)%keys.length;
      if(disabled.has(index))continue;
      signal.throwIfAborted();
      const attemptSignal=keys.length>1?AbortSignal.any([signal,AbortSignal.timeout(attemptMs)]):signal;
      try {
        let listener=()=>{};
        const cancelled=new Promise<never>((_,reject)=>{listener=()=>reject(attemptSignal.reason);attemptSignal.addEventListener("abort",listener,{once:true});if(attemptSignal.aborted)listener();});
        let result:T;
        try{result=await Promise.race([run(keys[index],attemptSignal),cancelled]);}finally{attemptSignal.removeEventListener("abort",listener);}
        preferred=index;return result;
      }
      catch(error) {
        signal.throwIfAborted();last=error;lastFailure=error;
        const status=(error as {statusCode?:number})?.statusCode;
        if([401,402,429].includes(status??0)||(error as {name?:string})?.name==="TimeoutError")disabled.add(index);
        // A request/schema problem is model-specific, so changing keys cannot repair it.
        if(status===400||status===404||status===422||error instanceof SyntaxError)throw error;
      }
    }
    if(disabled.size===keys.length)throw Object.assign(new Error("Provider key pool exhausted"),{statusCode:(last as {statusCode?:number})?.statusCode,poolExhausted:true});
    throw last;
  };
}
