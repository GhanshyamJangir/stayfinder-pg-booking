import { NextResponse } from 'next/server';
import { registerUser } from '../../../../lib/users';
import { createSession } from '../../../../lib/session';
import { mailAccountCreated } from '../../../../lib/lifecycle-mail';

export async function POST(request) {
  try {
    const body = await request.json();
    const user = await registerUser(body || {});
    await createSession(user);
    mailAccountCreated(user).catch(e=>console.error('REGISTER_MAIL_ERROR',e));
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Account could not be created.' }, { status: 400 });
  }
}
