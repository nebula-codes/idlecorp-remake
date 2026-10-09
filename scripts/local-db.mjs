import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import path from 'node:path';
if (process.env.NODE_ENV === 'production') throw new Error('Local database helper is development-only. Use managed PostgreSQL or Docker Compose in production.');
const directory = path.resolve('.runtime/postgres');
fs.mkdirSync(directory, { recursive: true });
const database = new EmbeddedPostgres({ databaseDir: directory, user: 'idlecorp', password: 'idlecorp', port: 5432, persistent: true, authMethod: 'scram-sha-256', postgresFlags: ['-c', 'listen_addresses=127.0.0.1'], onLog: () => {}, onError: (error) => { if (!String(error).includes('LOG:')) console.error(String(error)); } });
if (!fs.existsSync(path.join(directory, 'PG_VERSION'))) await database.initialise();
await database.start();
const client = database.getPgClient();
await client.connect();
if (!(await client.query("SELECT 1 FROM pg_database WHERE datname='idlecorp'")).rowCount) await database.createDatabase('idlecorp');
console.log('Persistent PostgreSQL ready at localhost:5432. Data: ' + directory);
await client.end();
let closing = false;
async function stop() { if (closing) return; closing = true; await database.stop(); process.exit(0); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
setInterval(() => {}, 60000);
