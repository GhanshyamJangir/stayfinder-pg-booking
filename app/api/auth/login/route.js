import { NextResponse } from 'next/server';
import { findUserByUsername, verifyUser } from '../../../../lib/users';
import { createSession } from '../../../../lib/session';

const SUPPORT_EMAIL = 'stayfinderjaipur@gmail.com';

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

    // Check account state separately so a disabled account does not look like a wrong password.
    const account = await findUserByUsername(username);
    if (account && account.active === false) {
      return NextResponse.json(
        {
          ok: false,
          code: 'ACCOUNT_DISABLED',
          error: 'Your account is disabled. Please contact the support team.',
          supportEmail: SUPPORT_EMAIL,
        },
        { status: 403 }
      );
    }

    const user = await verifyUser(username, password);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Incorrect username or password.' },
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
