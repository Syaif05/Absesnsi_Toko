export function demoEnabled(env:Record<string,string|undefined>){return env.NODE_ENV!=='production'&&env.APP_ENV==='development'}
