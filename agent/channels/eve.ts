import { eveChannel } from "eve/channels/eve";
import type { AuthFn } from "eve/channels/auth";
import { authorized } from "../../lib/access";
const appSession:AuthFn<Request>=async request=>{
 if(!authorized(request))return null;
 const origin=request.headers.get("origin");
 const publicHost=request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host") || new URL(request.url).host;
 if(origin && new URL(origin).host!==publicHost)return null;
 return {authenticator:"workspace-cookie",principalId:"resume-workspace",principalType:"user",attributes:{}};
};
export default eveChannel({auth:[appSession]});
