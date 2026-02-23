// api/upload-token.ts
import { handleUpload, type HandleUploadBody } from '@vercel/blob';

export const config = { runtime: 'edge' };

export default async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Optional: Add auth checks here if needed
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50 MB allowed for Blob
          tokenPayload: JSON.stringify({ userId: 'anonymous' }), // Optional metadata
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Optional: Log or notify
        console.log('Upload completed:', blob.url);
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