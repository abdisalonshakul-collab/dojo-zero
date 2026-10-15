// Usage: node make-owner-hash.js "your new owner password"
// Prints a value for the OWNER_HASH environment variable of server.js.
const c = require('crypto');
const pw = process.argv[2];
if (!pw || pw.length < 8) { console.error('Give a password of at least 8 characters.'); process.exit(1); }
const salt = c.randomBytes(16).toString('hex');
console.log('OWNER_HASH=' + salt + ':' + c.scryptSync(pw, salt, 32).toString('hex'));
