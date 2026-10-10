import { defineTool } from "eve/tools";
import { z } from "zod";
export default defineTool({
 description:"Compare user-supplied job keywords against candidate text using literal matching. This is keyword coverage, not hiring probability.",
 inputSchema:z.object({keywords:z.array(z.string()).max(30),candidateText:z.string().max(60000)}),
 execute({keywords,candidateText}) {
 const text=candidateText.toLowerCase();
 return {matched:keywords.filter(k=>text.includes(k.toLowerCase())),missing:keywords.filter(k=>!text.includes(k.toLowerCase())),note:"Literal matches need contextual review."};
 }
});
