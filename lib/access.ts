import { createHmac, timingSafeEqual, createHash } from "node:crypto";
export function token() {
 const password=process.env.APP_ACCESS_PASSWORD;
 if(!password || password.length<12) return null;
 return createHmac("sha256",password).update("resume-studio-session-v1").digest("hex");
}
export function matches(a:string,b:string) {
 const x=createHash("sha256").update(a).digest(), y=createHash("sha256").update(b).digest();
 return timingSafeEqual(x,y);
}
export function authorized(request:Request) {
 const expected=token();
 const cookie=request.headers.get("cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith("resume_session="))?.slice(15);
 return !!expected && !!cookie && matches(cookie,expected);
}
export function denied(request:Request) {
 if(!token()) return Response.json({error:"Set APP_ACCESS_PASSWORD (at least 12 characters) in Vercel to enable AI generation."},{status:503});
 if(!authorized(request)) return Response.json({error:"Unlock this workspace with its access password."},{status:401});
 const origin=request.headers.get("origin");
 if(origin && origin!==new URL(request.url).origin) return Response.json({error:"Request origin rejected."},{status:403});
 return null;
}
