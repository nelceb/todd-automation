/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    GITHUB_OWNER: process.env.GITHUB_OWNER || 'cookunity',
    GITHUB_REPO: process.env.GITHUB_REPO || 'test-runner-ai',
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Excluir playwright-core y @sparticuz/chromium del bundling
      config.externals = config.externals || [];
      config.externals.push({
        'playwright-core': 'commonjs playwright-core',
        '@sparticuz/chromium': 'commonjs @sparticuz/chromium',
        'playwright': 'commonjs playwright',
      });
    }
    return config;
  },
}

module.exports = nextConfig
