const http = require('node:http');
const { httpOptions, shutdownTimeoutMS } = require('../config/runtime');

function createServer(app) {
  const server = http.createServer(httpOptions, app);
  server.maxRequestsPerSocket = 1000;
  return server;
}

function gracefulShutdown(server, disconnect, timeoutMS = shutdownTimeoutMS) {
  let stopping;
  return () => {
    if (stopping) return stopping;
    stopping = new Promise((resolve, reject) => {
      const timer = setTimeout(() => server.closeAllConnections(), timeoutMS);
      timer.unref();
      // Stop accepting requests, finish active uploads/writes, then close DB.
      server.close(error => {
        clearTimeout(timer);
        if (error) return reject(error);
        Promise.resolve().then(disconnect).then(resolve, reject);
      });
      server.closeIdleConnections();
    });
    return stopping;
  };
}

module.exports = { createServer, gracefulShutdown };
