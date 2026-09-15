import { NextResponse } from 'next/server';

export function proxy(request){
  if(String(process.env.MAINTENANCE_MODE||'').toLowerCase()!=='true') return NextResponse.next();
  const path=request.nextUrl.pathname;
  if(path==='/maintenance'||path.startsWith('/admin')||path.startsWith('/api/')||path.startsWith('/_next/')||path==='/favicon.ico'||path.includes('.')) return NextResponse.next();
  const url=request.nextUrl.clone();
  url.pathname='/maintenance';
  url.search='';
  return NextResponse.rewrite(url);
}

export const config={matcher:['/((?!_next/static|_next/image).*)']};
