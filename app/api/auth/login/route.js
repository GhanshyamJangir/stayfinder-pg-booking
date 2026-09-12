import { NextResponse } from 'next/server';
import { verifyUser } from '../../../../lib/users';
import { createSession } from '../../../../lib/session';

export async function POST(request) {
  try {
    const body = await request.json();
    const username = String(body?.username || '').trim();
    const password = String(body?.password || '');

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: 'Username aur password required hai.' },
        { status: 400 }
      );
    }

    const user = await verifyUser(username, password);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Username ya password galat hai.' },
        { status: 401 }
      );
    }

    await createSession(user);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error('LOGIN_API_ERROR', error);
    return NextResponse.json(
      { ok: false, error: 'Login service available nahi hai.' },
      { status: 500 }
    );
  }
}
