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
app.set('trust proxy', 'loopback');
const { securityHeaders, mutationLimiter, hideInternalErrors, errorHandler } = require('./middelwares/securityHeaders');
app.use(securityHeaders, hideInternalErrors);
app.use(bodyParser.json({ limit: '1mb' }));
const allowedOrigins = String(process.env.CORS_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
app.use((req, res, next) => cors({ origin(origin, callback) {
    if (!origin) return callback(null, true);
    let sameOrigin = false;
    try { sameOrigin = new URL(origin).host === req.get('host'); } catch {}
    callback(null, sameOrigin || allowedOrigins.includes(origin));
} })(req, res, next));
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
        const server = app.listen(port, process.env.HOST || '127.0.0.1', () => {
            const protocol = (process.env.HTTPS === 'true' || process.env.NODE_ENV === 'production') ? 'https' : 'http';
            const { address, port: activePort } = server.address();
            const host = address === '::' ? '127.0.0.1' : address;
            console.log(`Server listening at ${protocol}://${host}:${activePort}/`);
            resolve(server);
        });
        server.once('error', reject);
    });
}

if (require.main === module) start().catch(async error => {
    console.error('Server startup failed:', error.message);
    await require('mongoose').disconnect();
    process.exitCode = 1;
});

module.exports = { app, start };
