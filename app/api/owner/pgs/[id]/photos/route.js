import { NextResponse } from 'next/server';
import { readSession } from '../../../../../../lib/session';
import { uploadManyBuffers } from '../../../../../../lib/drive';
import { setPgImages } from '../../../../../../lib/pgs';

export async function POST(req, { params }) {
  try {
    const user = await readSession();
    if (!user || user.role !== 'owner') {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const { id } = await params;
    const form = await req.formData();
    const files = form
      .getAll('photos')
      .filter((item) => item && typeof item.arrayBuffer === 'function');

    if (files.length < 5 || files.length > 8) {
      throw new Error('Minimum 5 aur maximum 8 images required hain.');
    }

    for (const file of files) {
      if (!String(file.type || '').startsWith('image/')) {
        throw new Error('Sirf image files allowed hain.');
      }
      if (file.size > 8 * 1024 * 1024) {
        throw new Error('Har image maximum 8 MB honi chahiye.');
      }
    }

    const stamp = Date.now();
    const uploadPayload = await Promise.all(
      files.map(async (file, index) => ({
        buffer: Buffer.from(await file.arrayBuffer()),
        mimeType: file.type,
        name: `${id}-${index + 1}-${stamp}-${file.name || 'photo'}`,
      }))
    );

    const uploaded = await uploadManyBuffers({
      files: uploadPayload,
      folderName: 'PG Images',
    });
    const ids = uploaded.map((item) => item.id);

    await setPgImages(user.sub, id, ids);
    return NextResponse.json({ ok: true, images: ids });
  } catch (error) {
    console.error('PG_PHOTO_UPLOAD_ERROR', error);

    const raw = String(error?.message || '');
    const code = String(error?.code || error?.response?.data?.error || '');
    const authFailure = /invalid_grant|invalid credentials|unauthorized|token has been expired|token has been revoked/i.test(`${raw} ${code}`);

    if (authFailure) {
      return NextResponse.json(
        {
          ok: false,
          code: 'DRIVE_AUTH_UNAVAILABLE',
          error: 'Photos could not be uploaded right now. Your PG details are already saved.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        code: 'PHOTO_UPLOAD_FAILED',
        error: 'Photos could not be uploaded right now. Your PG details are already saved.',
      },
      { status: 503 }
    );
  }
}
