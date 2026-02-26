// Endpoint temporaire pour debugger le filesystem - A SUPPRIMER
import { NextResponse } from "next/server";
import { readdir, stat, writeFile, mkdir } from "fs/promises";
import { execSync } from "child_process";

export async function GET() {
  const info: Record<string, unknown> = {};
  const uploadsDir = process.env.UPLOADS_DIR || "/app/uploads";

  try {
    // Check uploads dir
    try {
      const s = await stat(uploadsDir);
      info.uploads_dir = uploadsDir;
      info.uploads_exists = true;
      info.uploads_is_dir = s.isDirectory();
    } catch {
      info.uploads_exists = false;
    }

    // List contents
    try {
      const files = await readdir(uploadsDir);
      info.uploads_contents = files;

      for (const sub of ["signatures", "pdfs", "logos"]) {
        try {
          const subFiles = await readdir(`${uploadsDir}/${sub}`);
          info[`${sub}_files`] = subFiles;
        } catch {
          info[`${sub}_files`] = "dir not found";
        }
      }
    } catch {
      info.uploads_contents = "cannot read";
    }

    // Test write
    try {
      await mkdir(`${uploadsDir}/test`, { recursive: true });
      await writeFile(`${uploadsDir}/test/probe.txt`, "test-" + Date.now());
      info.write_test = "OK";
    } catch (e) {
      info.write_test = `FAIL: ${e}`;
    }

    // Check mounts
    try {
      info.mounts = execSync("mount | grep uploads || echo 'no mount found'").toString().trim();
    } catch {
      info.mounts = "cannot check";
    }

    try {
      info.df = execSync("df -h /app/uploads 2>/dev/null || echo 'no df'").toString().trim();
    } catch {
      info.df = "cannot check";
    }

  } catch (e) {
    info.error = String(e);
  }

  return NextResponse.json(info);
}
