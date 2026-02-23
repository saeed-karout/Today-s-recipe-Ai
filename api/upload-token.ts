// api/upload-token.ts
// هذا الـ route يولد token للـ client upload – لا تستخدم Edge هنا

import { handleUpload, type HandleUploadBody } from '@vercel/blob';

export const config = {
  runtime: 'nodejs', // مهم: Node.js بدل Edge لدعم undici/stream
};

export default async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // يمكنك إضافة auth هنا لاحقًا (مثل check user logged in)
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50 MB max للصور
          addRandomSuffix: true, // يضيف suffix عشوائي لتجنب overwrite
          // tokenPayload: JSON.stringify({ userId: '123' }) // اختياري
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('Upload completed:', blob.url, tokenPayload);
        // هنا يمكنك حفظ الـ url في DB أو إرسال إشعار
      },
    });

    return Response.json(jsonResponse);
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}