FROM node:18-alpine

# Install necessary tools
RUN apk add --no-cache sqlite curl

# Install LiteFS CLI
RUN wget https://github.com/superfly/litefs/releases/download/v0.5.5/litefs-v0.5.5-linux-amd64.tar.gz \
    && tar -xzf litefs-v0.5.5-linux-amd64.tar.gz \
    && mv litefs /usr/local/bin/ \
    && rm litefs-v0.5.5-linux-amd64.tar.gz

# Install Supercronic
ENV SUPERCRONIC_URL=https://github.com/aptible/supercronic/releases/download/v0.1.12/supercronic-linux-amd64 \
    SUPERCRONIC=supercronic-linux-amd64 \
    SUPERCRONIC_SHA1SUM=048b95b48b708983effb2e5c935a1ef8483d9e3e
RUN wget "$SUPERCRONIC_URL" \
   && echo "${SUPERCRONIC_SHA1SUM}  ${SUPERCRONIC}" | sha1sum -c - \
   && chmod +x "$SUPERCRONIC" \
   && mv "$SUPERCRONIC" "/usr/local/bin/${SUPERCRONIC}" \
   && ln -s "/usr/local/bin/${SUPERCRONIC}" /usr/local/bin/supercronic

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy your scripts
COPY backup.js ./
COPY manageBackups.js ./
COPY crontab ./crontab

# Set correct permissions
RUN mkdir -p /litefs /tmp && chown -R appuser:appgroup /app /litefs /tmp

# Switch to non-root user
USER appuser

# Start Supercronic
CMD ["supercronic", "/app/crontab"]