import { LoginPanel } from '@/components/auth-panel';
import { demoEnabled } from '@/server/release/demo';
export const dynamic='force-dynamic';
export default function LoginPage(){return <main className="login-page"><LoginPanel showDemo={demoEnabled(process.env)}/></main>}
