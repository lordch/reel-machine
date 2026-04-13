import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import path from "path";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET = process.env.R2_BUCKET_NAME || "reel-machine";

/**
 * Upload a file to R2 and return the public URL.
 */
export async function uploadToR2(localPath: string, remoteName?: string): Promise<string> {
  const key = remoteName || path.basename(localPath);
  const body = readFileSync(localPath);

  const contentType = key.endsWith(".mp4") ? "video/mp4"
    : key.endsWith(".mp3") ? "audio/mpeg"
    : "application/octet-stream";

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));

  const publicUrl = process.env.R2_PUBLIC_URL
    ? `${process.env.R2_PUBLIC_URL}/${key}`
    : `${process.env.R2_ENDPOINT}/${BUCKET}/${key}`;

  console.log(`  Uploaded to R2: ${key} (${(body.length / 1024 / 1024).toFixed(1)} MB) → ${publicUrl}`);
  return publicUrl;
}
