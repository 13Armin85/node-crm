const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../model/schema/user');
const { jwtSecret } = require('../config/auth');

test('remember me extends authenticated login to 30 days; session-only login remains one day', async t => {
    const actor = { _id: new mongoose.Types.ObjectId(), username: 'login@example.test', role: 'user', password: 'test-hash', deleted: false };
    t.mock.method(User, 'findOne', query => {
        assert.equal(query.username, actor.username);
        assert.equal(query.deleted, false);
        return { select: async () => ({ ...actor, toObject: () => ({ ...actor }) }) };
    });
    t.mock.method(bcrypt, 'compare', async () => true);
    for (const [rememberMe, days] of [[true, 30], [false, 1], [undefined, 1], ['false', 1]]) {
        const res = { status(code) { this.code = code; return this; }, setHeader() { return this; }, json(data) { this.data = data; return this; } };
        await require('../controllers/user/user').login({ body: { username: actor.username, password: 'test-password', rememberMe } }, res);
        assert.equal(res.code, 200);
        assert.equal(res.data.user.password, undefined);
        const claims = jwt.verify(res.data.token, jwtSecret);
        assert.equal(claims.userId, String(actor._id));
        assert.equal(claims.exp - claims.iat, days * 24 * 60 * 60);
    }
});
