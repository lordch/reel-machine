import "dotenv/config";
import { uploadToR2 } from "../src/api/storage";

const [, , localPath, remoteKey] = process.argv;

if (!localPath || !remoteKey) {
  console.error("Usage: tsx scripts/backup-upload.ts <localPath> <remoteKey>");
  process.exit(1);
}

uploadToR2(localPath, remoteKey)
  .then((url) => {
    console.log(`Backup uploaded: ${url}`);
  })
  .catch((err) => {
    console.error("Backup upload failed:", err);
    process.exit(1);
  });
