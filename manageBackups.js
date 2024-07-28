const {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const S3 = new S3Client({
  region: "auto",
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
});

const BUCKET_NAME = process.env.BUCKET_NAME;
const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const THREE_MONTHS = 90 * ONE_DAY;

async function listBackups() {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
  });

  let backups = [];
  let isTruncated = true;
  let continuationToken = undefined;

  while (isTruncated) {
    const response = await S3.send(command);
    backups.push(...response.Contents);
    isTruncated = response.IsTruncated;
    continuationToken = response.NextContinuationToken;
    command.input.ContinuationToken = continuationToken;
  }

  return backups;
}

async function deleteBackup(key) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  await S3.send(command);
  console.log(`Deleted backup: ${key}`);
}

async function manageBackups() {
  const backups = await listBackups();
  const now = new Date();
  const oneDayAgo = new Date(now - ONE_DAY);
  const threeMonthsAgo = new Date(now - THREE_MONTHS);

  const backupsByDate = new Map();

  for (const backup of backups) {
    const backupDate = new Date(backup.LastModified);
    const dateKey = backupDate.toISOString().split("T")[0];

    if (!backupsByDate.has(dateKey)) {
      backupsByDate.set(dateKey, []);
    }
    backupsByDate.get(dateKey).push(backup);
  }

  for (const [dateKey, dateBackups] of backupsByDate) {
    const backupDate = new Date(dateKey);

    if (backupDate < threeMonthsAgo) {
      // Delete all backups older than 3 months
      for (const backup of dateBackups) {
        await deleteBackup(backup.Key);
      }
    } else if (backupDate < oneDayAgo) {
      // Keep only one backup per day for the past 3 months
      const sortedBackups = dateBackups.sort(
        (a, b) => b.LastModified - a.LastModified
      );
      for (let i = 1; i < sortedBackups.length; i++) {
        await deleteBackup(sortedBackups[i].Key);
      }
    }
    // Keep all backups for the current day
  }
}

manageBackups().catch((error) => {
  console.error("Error managing backups:", error);
  process.exit(1);
});
