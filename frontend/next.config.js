/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    GITHUB_OWNER: process.env.GITHUB_OWNER || 'cookunity',
    GITHUB_REPO: process.env.GITHUB_REPO || 'test-runner-ai',
  },
}

module.exports = nextConfig
