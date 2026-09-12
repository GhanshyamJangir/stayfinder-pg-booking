import { NextResponse } from 'next/server';
import { resetPassword } from '../../../../../lib/password-reset';
export async function POST(req){try{const b=await req.json();await resetPassword(b?.resetToken,b?.newPassword,b?.confirmPassword);return NextResponse.json({ok:true,message:'Password updated successfully. You can now login.'});}catch(e){return NextResponse.json({ok:false,error:e.message||'Password could not be updated.'},{status:400});}}
