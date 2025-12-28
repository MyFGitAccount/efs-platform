/*import app from '../server/server.js';

export default async (req, res) => {
  return app(req, res);
};*/
// index.js   ← CommonJS version
const app = require('../server/server.js');

module.exports = (req, res) => {
  return app(req, res);
};
