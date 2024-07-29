console.log("Starting backup application...");

const { exec } = require("child_process");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs").promises;
const path = require("path");
const util = require("util");
const { manageBackups } = require("./manageBackups");

console.log("Modules imported successfully.");

const execPromise = util.promisify(exec);

const S3 = new S3Client({
  region: "auto",
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
});

console.log("S3 client initialized.");

const MAIN_APP_NAME = process.env.MAIN_APP_NAME || "your-main-app-name";
const DB_NAME = process.env.DB_NAME || "sqlite.db";
const LITEFS_API_URL = `http://${MAIN_APP_NAME}.internal:20202`;

console.log(`LITEFS_API_URL set to: ${LITEFS_API_URL}`);

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second

async function retry(fn, retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY) {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    console.log(`Retrying in ${delay}ms... (${retries} attempts left)`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2);
  }
}

async function backupDatabase() {
  console.log("Starting backupDatabase function...");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "");
  const backupTag = `backup_${timestamp}.sqlite`;
  const backupFile = path.join("/tmp", backupTag);

  try {
    console.log("Starting database backup process...");

    await retry(async () => {
      console.log("Attempting to sync with LiteFS...");
      await execPromise(`curl ${LITEFS_API_URL}/sync`);
      console.log("Synced with primary LiteFS node.");

      console.log("Attempting to export database...");
      await execPromise(
        `litefs export -url ${LITEFS_API_URL} -name ${DB_NAME} ${backupFile}`
      );
      console.log("Database exported successfully.");
    });

    console.log("Reading backup file...");
    const fileBuffer = await fs.readFile(backupFile);
    console.log("Backup file read into memory.");

    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    const day = new Date().getDate();
    const key = `${year}/${month}/${day}/${backupTag}`;

    const uploadParams = {
      Bucket: process.env.BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
    };

    console.log("Uploading to S3...");
    await S3.send(new PutObjectCommand(uploadParams));
    console.log(`Backup ${backupFile} uploaded successfully.`);

    console.log("Managing backups...");
    await manageBackups();
    console.log("Backup management completed.");
  } catch (error) {
    console.error("Error during backup:", error);
  } finally {
    try {
      await fs.unlink(backupFile);
      console.log("Temporary backup file deleted.");
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Error deleting backup file:", error);
      }
    }
  }
}

console.log("Backup script loaded. Attempting to run backup...");
backupDatabase().catch((error) => {
  console.error("Unhandled error in backup process:", error);
  process.exit(1);
});
