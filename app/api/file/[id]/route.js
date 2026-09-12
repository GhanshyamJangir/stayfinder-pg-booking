import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { getDriveFile } from '../../../../lib/drive';

export async function GET(_req, { params }) {
  try {
    const user = await readSession();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const { id } = await params;
    const file = await getDriveFile(id);

    return new NextResponse(file.buffer, {
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('DRIVE_FILE_READ_ERROR', error);
    return NextResponse.json(
      { ok: false, error: 'File not found' },
      { status: 404 }
    );
  }
}
