import app from '../server/server.js';

export default async (req, res) => {
  return app(req, res);
};
