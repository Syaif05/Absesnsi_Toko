export function securityHeaders(production:boolean){
 return [
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Referrer-Policy',value:'no-referrer'},
  {key:'Permissions-Policy',value:'camera=(self), geolocation=(self), microphone=()'},
  {key:'Content-Security-Policy',value:"frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"},
  {key:'Cross-Origin-Opener-Policy',value:'same-origin'},
  ...(production?[{key:'Strict-Transport-Security',value:'max-age=31536000'}]:[]),
 ];
}
