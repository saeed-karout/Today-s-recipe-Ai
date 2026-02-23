// api/upload-token.ts
import { handleUpload, type HandleUploadBody } from '@vercel/blob';

export const config = {
  runtime: 'nodejs',
};

export default async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
          maximumSizeInBytes: 10 * 1024 * 1024, // 10 MB max
          tokenPayload: JSON.stringify({}),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('Upload completed:', blob.url);
      },
    });

    return Response.json(jsonResponse);
  } catch (error) {
    console.error('Upload token error:', error);
    return Response.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}