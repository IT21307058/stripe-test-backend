# Winston Logging Configuration

This application uses Winston for comprehensive logging to files.

## Log Files

All logs are stored in the `logs/` directory:

- **error-YYYY-MM-DD.log** - Contains only error-level logs
- **combined-YYYY-MM-DD.log** - Contains all log levels (info, warn, error, etc.)
- **exceptions-YYYY-MM-DD.log** - Contains uncaught exceptions
- **rejections-YYYY-MM-DD.log** - Contains unhandled promise rejections

## Log Rotation

- Logs are rotated daily (new file each day)
- Maximum file size: 20MB
- Logs are kept for 14 days

## Using the Logger

Import the logger in any file:

```javascript
const logger = require('./config/logger');
```

### Log Levels

```javascript
logger.error('Error message');   // Errors
logger.warn('Warning message');  // Warnings
logger.info('Info message');     // Information
logger.debug('Debug message');   // Debug info
```

### Logging with Metadata

```javascript
logger.error('User creation failed', {
  userId: user.id,
  email: user.email,
  stack: error.stack
});
```

## Configuration

The logger can be configured using environment variables in your `.env` file:

```env
# Log directory (default: ./logs)
LOG_DIR=/var/log/node-app

# Log level (default: info)
# Options: error, warn, info, debug
LOG_LEVEL=info

# Environment (production disables console logging)
NODE_ENV=production
```

## For Production (Promtail/Loki)

When deploying with Promtail for log aggregation:

1. Set `LOG_DIR=/var/log/node-app` in your `.env` file
2. Ensure the directory has proper write permissions
3. Configure Promtail to scrape from this directory
4. Error logs will be in `/var/log/node-app/error-*.log`

Example Promtail configuration:

```yaml
scrape_configs:
  - job_name: nodejs-app
    static_configs:
      - targets:
          - localhost
        labels:
          job: nodejs-app
          __path__: /var/log/node-app/*.log
```
