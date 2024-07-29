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
const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds
const ONE_DAY = 24 * ONE_HOUR;
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
  const twentyFourHoursAgo = new Date(now - ONE_DAY);
  const threeMonthsAgo = new Date(now - THREE_MONTHS);

  const backupsByHour = new Map();
  const dailyBackups = new Map();

  for (const backup of backups) {
    const backupDate = new Date(backup.LastModified);
    const hourKey = backupDate.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const dateKey = backupDate.toISOString().split("T")[0]; // YYYY-MM-DD

    // Organize backups by hour for the last 24 hours
    if (backupDate >= twentyFourHoursAgo) {
      if (!backupsByHour.has(hourKey)) {
        backupsByHour.set(hourKey, []);
      }
      backupsByHour.get(hourKey).push(backup);
    }

    // Track the latest backup of each day for daily backups
    if (
      !dailyBackups.has(dateKey) ||
      backupDate > dailyBackups.get(dateKey).LastModified
    ) {
      dailyBackups.set(dateKey, backup);
    }
  }

  // Keep only the latest backup for each hour in the last 24 hours
  for (const hourlyBackups of backupsByHour.values()) {
    const sortedBackups = hourlyBackups.sort(
      (a, b) => b.LastModified - a.LastModified
    );
    for (let i = 1; i < sortedBackups.length; i++) {
      await deleteBackup(sortedBackups[i].Key);
    }
  }

  // Manage daily backups
  for (const [dateKey, backup] of dailyBackups) {
    const backupDate = new Date(dateKey);
    if (backupDate < threeMonthsAgo) {
      // Delete daily backups older than 3 months
      await deleteBackup(backup.Key);
    } else if (backupDate < now.toISOString().split("T")[0]) {
      // For past days, ensure only the last backup of the day is kept
      const backupTime = new Date(backup.LastModified).toTimeString();
      if (backupTime < "23:50:00" || backupTime > "23:59:59") {
        await deleteBackup(backup.Key);
      }
    }
  }
}

module.exports = { manageBackups };
