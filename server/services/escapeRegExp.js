module.exports = value => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
