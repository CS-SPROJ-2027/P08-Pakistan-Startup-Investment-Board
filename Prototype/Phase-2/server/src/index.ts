/**
 * Server entry point.
 * Loads environment variables and starts the Express server.
 */
import 'dotenv/config';
import app from './app';
import logger from './config/logger';

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET is missing in .env. Add it and start the server again.');
  process.exit(1);
}

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
