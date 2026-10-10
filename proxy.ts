import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorized } from "./lib/access";
export function proxy(request:NextRequest) {
 if(request.nextUrl.pathname.startsWith("/eve/")) {
  if(!authorized(request))return NextResponse.json({error:"Unlock the workspace first."},{status:401});
  const origin=request.headers.get("origin");
  if(origin && origin!==request.nextUrl.origin)return NextResponse.json({error:"Request origin rejected."},{status:403});
 }
 return NextResponse.next();
}
export const config={matcher:["/eve/:path*"]};
