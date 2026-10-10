import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata:Metadata={title:"Resume Studio — Your experience, expertly aligned",description:"Evidence-based resumes, job matching, and application kits."};
export default function Layout({children}:{children:ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
