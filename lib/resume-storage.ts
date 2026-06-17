import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

const pdfMagic = "%PDF";

export function resumeStorageDir() {
  return path.join(process.cwd(), "storage", "resumes");
}

function safePdfName(name: string) {
  const ext = path.extname(name).toLowerCase() === ".pdf" ? ".pdf" : ".pdf";
  const base = slugify(path.basename(name, path.extname(name))) || "resume";
  return `${base}${ext}`;
}

async function ensureStorageDir(userId: string) {
  const dir = path.join(resumeStorageDir(), userId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function saveResumeForUser({
  userId,
  file,
  makeDefault = true,
}: {
  userId: string;
  file: File;
  makeDefault?: boolean;
}) {
  if (!file || file.size === 0) {
    throw new Error("Please upload a PDF resume.");
  }

  if (file.type && file.type !== "application/pdf") {
    throw new Error("Resume must be a PDF file.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer.subarray(0, 4).toString() !== pdfMagic) {
    throw new Error("Resume must be a valid PDF file.");
  }

  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const dir = await ensureStorageDir(userId);
  const fileName = safePdfName(file.name || "resume.pdf");
  const storagePath = path.join(dir, `${sha256.slice(0, 16)}-${fileName}`);

  await fs.writeFile(storagePath, buffer, { flag: "wx" }).catch(async (error) => {
    if (error?.code !== "EEXIST") throw error;
  });

  if (makeDefault) {
    await prisma.resume.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }

  return prisma.resume.upsert({
    where: {
      id: `${userId}-${sha256}`,
    },
    update: {
      fileName,
      storagePath,
      mimeType: "application/pdf",
      size: buffer.length,
      isDefault: makeDefault,
    },
    create: {
      id: `${userId}-${sha256}`,
      userId,
      fileName,
      storagePath,
      mimeType: "application/pdf",
      size: buffer.length,
      sha256,
      isDefault: makeDefault,
    },
  });
}

export async function getDefaultResume(userId: string) {
  return prisma.resume.findFirst({
    where: { userId, isDefault: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function setDefaultResume(userId: string, resumeId: string) {
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId },
  });

  if (!resume) {
    throw new Error("Resume not found.");
  }

  await prisma.resume.updateMany({
    where: { userId },
    data: { isDefault: false },
  });

  return prisma.resume.update({
    where: { id: resumeId },
    data: { isDefault: true },
  });
}
