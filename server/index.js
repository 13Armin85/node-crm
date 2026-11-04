const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') })
const express = require('express');
const db = require('./db/config')
const route = require('./controllers/route');
const bodyParser = require('body-parser');
const cors = require('cors');


const port = Number(process.env.PORT || 5001)

//Setup Express App
const app = express();
// Middleware
app.disable('x-powered-by');
app.disable('etag');
app.set('trust proxy', 'loopback');
const { securityHeaders, mutationLimiter, hideInternalErrors, errorHandler, privateResponse } = require('./middelwares/securityHeaders');
app.use(securityHeaders, hideInternalErrors);
app.use('/api', privateResponse);
app.use(bodyParser.json({ limit: '1mb' }));
const allowedOrigins = String(process.env.CORS_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
app.use(cors((req, callback) => {
    const origin = req.get('origin');
    if (!origin) return callback(null, { origin: true });
    let sameOrigin = false;
    try { const url = new URL(origin); sameOrigin = ['http:', 'https:'].includes(url.protocol) && url.host === req.get('host'); } catch {}
    callback(null, { origin: sameOrigin || allowedOrigins.includes(origin) });
}));
//API Routes
app.use('/api', mutationLimiter, route);
app.use(errorHandler);


app.get('/', async (req, res) => {
    res.send('Welcome to my world...')
});

// Connect to MongoDB
const DATABASE_URL = process.env.DB_URL || 'mongodb://127.0.0.1:27017'
const DATABASE = process.env.DB || 'Prolink'

async function start() {
    await db(DATABASE_URL, DATABASE);
    return new Promise((resolve, reject) => {
        const server = require('./services/serverLifecycle').createServer(app);
        server.once('error', reject);
        server.listen(port, process.env.HOST || '127.0.0.1', () => {
            const protocol = (process.env.HTTPS === 'true' || process.env.NODE_ENV === 'production') ? 'https' : 'http';
            const { address, port: activePort } = server.address();
            const host = address === '::' ? '127.0.0.1' : address;
            console.log(`Server listening at ${protocol}://${host}:${activePort}/`);
            resolve(server);
        });
    });
}

if (require.main === module) start().then(server => {
    const shutdown = require('./services/serverLifecycle').gracefulShutdown(server, () => require('mongoose').disconnect());
    const stop = () => shutdown().catch(() => { process.exitCode = 1; });
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
}).catch(async error => {
    console.error('Server startup failed:', error.message);
    await require('mongoose').disconnect();
    process.exitCode = 1;
});

module.exports = { app, start };
