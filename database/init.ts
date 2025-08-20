import { Client } from 'pg';
import { config } from 'dotenv';

// init env variables
config();

function connectToPG() {
  const pgClient = new Client({
    host: process.env.POSTGRES_HOSTNAME,
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  });

  return pgClient;
}

export { connectToPG };
