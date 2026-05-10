const { app, connectToMongo } = require('../server-mongo');

module.exports = async (req, res) => {
  try {
    await connectToMongo();
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    return res.status(500).json({ error: 'Database connection failed' });
  }

  return app(req, res);
};
