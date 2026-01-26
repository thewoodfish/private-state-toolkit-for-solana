import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";

export async function writeJsonAtomic(filePath: string, obj: unknown) {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${randomBytes(4).toString(
    "hex"
  )}`;
  const data = `${JSON.stringify(obj, null, 2)}\n`;
  const handle = await fs.promises.open(tmpPath, "w");
  try {
    await handle.writeFile(data);
    if (handle.sync) {
      await handle.sync();
    }
  } finally {
    await handle.close();
  }
  await fs.promises.rename(tmpPath, filePath);
}

export async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const data = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(data) as T;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function removeIfExists(filePath: string) {
  try {
    await fs.promises.unlink(filePath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
}
