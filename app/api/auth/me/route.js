import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';

export async function GET() {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: user.sub,
      username: user.username,
      name: user.name,
      role: user.role,
    },
  });
}
