import { NextResponse } from 'next/server';
import { registerUser } from '../../../../lib/users';
import { createSession } from '../../../../lib/session';

export async function POST(request) {
  try {
    const body = await request.json();
    const user = await registerUser(body || {});
    await createSession(user);
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Account create nahi hua.' }, { status: 400 });
  }
}
