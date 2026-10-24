import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, writeFile, readFile, rm, rename, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { resolve, dirname } from "node:path";
import { env, lite } from "../env";
import { sign } from "../security/crypto";
const local = () => lite || env.STORAGE_MODE === "local";
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "minio",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "minio12345",
  },
});
const bucket = process.env.S3_BUCKET ?? "reporeel";
export function localObjectPath(key: string) {
  if (!/^[a-f0-9-]{36}\/[a-zA-Z0-9_.-]+$/.test(key))
    throw new Error("Invalid storage key.");
  return resolve(process.env.REPOREEL_DATA_DIR ?? ".data", "objects", key);
}
export async function putObject(
  key: string,
  body: Buffer | string,
  type: string,
) {
  if (local()) {
    const file = localObjectPath(key);
    await mkdir(dirname(file), { recursive: true });
    const temp = file + "." + randomUUID() + ".tmp";
    try {
      await writeFile(temp, body);
      await rename(temp, file);
    } finally {
      await rm(temp, { force: true });
    }
  } else
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: type,
      }),
    );
}
export async function getObject(key: string): Promise<Buffer> {
  if (local()) return readFile(localObjectPath(key));
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  return Buffer.from(await result.Body!.transformToByteArray());
}
export async function getObjectStream(key: string): Promise<Readable> {
  if (local()) {
    const path = localObjectPath(key);
    await stat(path);
    return createReadStream(path);
  }
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!result.Body) throw new Error("Artifact has no body.");
  return result.Body as Readable;
}
export async function signedUrl(key: string, name: string, type: string) {
  if (local()) {
    const exp = Date.now() + 900000;
    const value = `${key}:${exp}:${name}:${type}`;
    return `/api/v1/files/${key}?expires=${exp}&name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}&signature=${sign(value)}`;
  }
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentType: type,
      ResponseContentDisposition: `attachment; filename="${name.replace(/[^a-zA-Z0-9_.-]/g, "_")}"`,
    }),
    { expiresIn: 900 },
  );
}
export async function deleteObjects(keys: string[]) {
  if (local()) {
    await Promise.all(
      keys.map((key) => rm(localObjectPath(key), { force: true })),
    );
    return;
  }
  for (let i = 0; i < keys.length; i += 1000)
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) },
      }),
    );
}
