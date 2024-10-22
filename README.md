# fly-litefs-backup

Automated SQLite backup solution for Fly.io applications using LiteFS.

## Quick Start

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/fly-backup-sqlite.git
   cd fly-backup-sqlite
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Set up Fly.io app:

   ```
   fly launch
   ```

4. Set required secrets:

   ```
   fly secrets set AWS_ENDPOINT_URL_S3=your_s3_endpoint BUCKET_NAME=your_bucket_name MAIN_APP_NAME=your-main-app-name DB_NAME=data.db
   ```

5. Deploy:
   ```
   fly deploy
   ```

## Requirements in the app you're backing up

In the fly.toml of the app that's running your litefs database, you'll need to expose the db to your Fly organization's private network. 

   ```
   [[services]]
   internal_port = 20202
   protocol = "tcp"
   ```

## What it does

- Backs up SQLite database every 5 minutes
- Uploads backups to S3-compatible storage (like Tigris)
- Manages backups daily, retaining one per day for 3 months

## Configuration

Edit `fly.toml` to customize app name and resources.

## Requirements

- Node.js 18+
- Fly.io account
- S3-compatible storage
