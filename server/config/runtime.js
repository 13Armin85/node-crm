// Validate operational limits once, without changing business/API contracts.
const positiveInteger = (name, fallback, maximum = 300000) => {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) throw new Error(`Invalid ${name}`);
  return number;
};

module.exports = {
  reportTimeoutMS: positiveInteger('REPORT_QUERY_TIMEOUT_MS', 30000),
  databaseOptions: {
    maxPoolSize: positiveInteger('DB_MAX_POOL_SIZE', 50, 500),
    minPoolSize: 0,
    maxIdleTimeMS: 60000,
    waitQueueTimeoutMS: positiveInteger('DB_WAIT_QUEUE_TIMEOUT_MS', 5000),
    serverSelectionTimeoutMS: positiveInteger('DB_SELECTION_TIMEOUT_MS', 5000),
    connectTimeoutMS: 10000,
  },
  httpOptions: {
    maxHeaderSize: 16384,
    headersTimeout: 30000,
    requestTimeout: positiveInteger('HTTP_REQUEST_TIMEOUT_MS', 300000, 900000),
    keepAliveTimeout: 5000,
  },
  shutdownTimeoutMS: positiveInteger('SHUTDOWN_TIMEOUT_MS', 30000),
};
