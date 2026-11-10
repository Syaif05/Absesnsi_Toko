// Allowlist only: never serialize Error.message, SQL, URL, payload, headers or credentials.
export function reportFailure(error:unknown,requestId:string,scope:string,sink:(entry:string)=>void=console.error){
 const candidate=typeof error==='object'&&error!==null&&'code' in error?String(error.code):'';
 const code=/^(?:[0-9A-Z]{5}|E(?:CONNRESET|CONNREFUSED|NOTFOUND|TIMEDOUT)|TRANSACTION_BUSY)$/.test(candidate)?candidate:'UNEXPECTED';
 sink(JSON.stringify({level:'error',scope:scope.replace(/[^a-z0-9_-]/gi,'').slice(0,40),requestId,code}));
}
