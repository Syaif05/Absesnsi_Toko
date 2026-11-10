const input=process.argv[2]??process.env.APP_BASE_URL;
try{
 const url=new URL(input);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('Invalid target');
 const checks=[];
 for(const [path,status] of [['/api/health/live',200],['/api/v1/me',401],['/api/v1/me/attendance/context',401]]){
  const response=await fetch(new URL(path,url),{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)}),body=await response.json();
  const ok=response.status===status&&response.headers.get('cache-control')==='no-store'&&response.headers.get('x-content-type-options')==='nosniff'&&response.headers.get('x-frame-options')==='DENY'&&(path.includes('/health/')?body.status==='alive':typeof body.error?.requestId==='string');
  checks.push(ok);console.log(`${ok?'PASS':'FAIL'} ${path}: HTTP ${response.status}`);
 }
 if(checks.some(ok=>!ok))process.exitCode=1;
 console.log('Smoke API saja; bukan uji kamera/GPS/perangkat atau persetujuan pilot.');
}catch{console.error('Smoke belum berhasil. Periksa target HTTPS, deployment protection, konfigurasi dan koneksi.');process.exitCode=1}
