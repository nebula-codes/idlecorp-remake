import { migrate,pool } from './database.js';
await migrate();console.log('PostgreSQL migrations applied.');await pool.end();
