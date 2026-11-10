import { reportingPage } from "@/server/reporting/page";
export const dynamic="force-dynamic";
export default async function Page(){return reportingPage("dashboard")}
