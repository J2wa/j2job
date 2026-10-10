import { matches, token } from "@/lib/access";
export async function POST(request:Request) {
 if(!token()) return Response.json({error:"Set APP_ACCESS_PASSWORD (at least 12 characters) in Vercel."},{status:503});
 const data=await request.json().catch(()=>({}));
 if(typeof data.password!=="string" || !matches(data.password,process.env.APP_ACCESS_PASSWORD!))
  return Response.json({error:"Incorrect access password."},{status:401});
 return Response.json({ok:true},{headers:{"Set-Cookie":"resume_session="+token()+"; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800"+(process.env.NODE_ENV==="production"?"; Secure":"")}});
}
export async function DELETE() { return Response.json({ok:true},{headers:{"Set-Cookie":"resume_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"}}); }
