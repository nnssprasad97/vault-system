# Vault System Dockerfile
# Builds container for running vault system with Hardhat
# Stages: base image -> dependencies -> compilation -> deployment


FROM node:20-alpine

WORKDIR /app

# Install dependencies needed for node-gyp if necessary (python3, build-base)
# But standard hardhat usage usually fine with pure JS.
# We'll install git just in case.
RUN apk add --no-cache git

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Compile contracts
RUN npx hardhat compile

# Set entrypoint
RUN chmod +x ./docker/entrypoint.sh
CMD ["sh", "./docker/entrypoint.sh"]
