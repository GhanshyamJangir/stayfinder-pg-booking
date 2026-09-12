import { NextResponse } from 'next/server';
import { verifyPasswordOtp } from '../../../../../lib/password-reset';
export async function POST(req){try{const b=await req.json();if(!/^\d{6}$/.test(String(b?.otp||'')))throw new Error('Enter the 6 digit OTP.');const out=await verifyPasswordOtp(b?.identifier,b?.otp);return NextResponse.json({ok:true,...out});}catch(e){return NextResponse.json({ok:false,error:e.message||'OTP verification failed.'},{status:400});}}
