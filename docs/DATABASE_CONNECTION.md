# Database Connection Configuration

## Overview

This document describes how to configure the MySQL database connection for the User Search feature in test-runner-ai.

## Prerequisites

**⚠️ IMPORTANT:** Active VPN connection to DEV and PROD environments is **REQUIRED** before connecting to the database.

> "Active VPN connection to both DEV and PROD environments is required before running any tests"

## Environment Variables

The following environment variables must be configured for MySQL connection:

### QA Environment (Default):
```bash
SUBSCRIPTION_DB_HOST=subscription-back-qa-cluster.cluster-cip0g4qqrpp7.us-east-1.rds.amazonaws.com
SUBSCRIPTION_DB_USER=automation-process
SUBSCRIPTION_DB_PASSWORD=eU3GEcBkB4KGPeS
SUBSCRIPTION_DB_DATABASE=cookunity
```

### PROD Environment:
Check `properties/prod/.env.default` in the `pw-cookunity-automation` repository for production credentials.

## Connection Method

The connection uses `mysql2` library (promise-based) and follows the same pattern as `MySQLClass` in the framework:

```typescript
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host,
  user,
  password,
  database,
  port: 3306,
  connectTimeout: 10000,
  multipleStatements: false
});
```

## Common Issues

### Error: "Access denied for user 'automation-process'@'[IP]'"

**Possible Causes:**
1. **VPN not connected** - VPN is REQUIRED for database access
2. **IP not whitelisted** - Your IP needs to be in the RDS Security Group
3. **Incorrect credentials** - Verify environment variables

**Solutions:**
1. Connect to CookUnity VPN before running the application
2. Contact DevOps/Infrastructure team to whitelist your IP
3. Verify credentials match those in `properties/qa/.env.default`

### Error: "ECONNREFUSED" or "ETIMEDOUT"

**Possible Causes:**
1. VPN not connected or not routing correctly
2. Network connectivity issues
3. Database host/port incorrect

**Solutions:**
1. Verify VPN connection is active
2. Check network connectivity
3. Verify database host and port settings

## SSL Configuration (If Required)

If AWS RDS requires SSL connections, uncomment and configure SSL in the connection options:

```typescript
const connection = await mysql.createConnection({
  host,
  user,
  password,
  database,
  port: 3306,
  ssl: {
    rejectUnauthorized: false // For development, adjust according to security policies
  },
  connectTimeout: 10000,
  multipleStatements: false
});
```

## SSH Tunnel Alternative

If direct connection is not possible, you can use an SSH tunnel:

```bash
ssh -L 3306:subscription-back-qa-cluster.cluster-cip0g4qqrpp7.us-east-1.rds.amazonaws.com:3306 user@bastion-host
```

Then use `localhost` as the host instead of the RDS hostname.

## Related Files

- `app/api/search-users/route.ts` - API endpoint with database connection logic
- `database/mysqlConnection.ts` (in pw-cookunity-automation repo) - Original MySQLClass implementation
- `properties/qa/.env.default` (in pw-cookunity-automation repo) - QA environment variables
- `properties/prod/.env.default` (in pw-cookunity-automation repo) - PROD environment variables

## Testing Connection

To test the connection, try searching for a user in the "Find Users" section. If the connection fails, you'll see detailed error messages with troubleshooting steps.

## Support

For access issues or configuration problems:
- Verify VPN connection is active
- Contact DevOps team about IP whitelisting
- Check framework documentation in `pw-cookunity-automation` repository

