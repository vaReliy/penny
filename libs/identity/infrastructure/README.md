# Identity Infrastructure

Plumbing layer for identity domain: Mongoose connection factory.

## Modules

### Mongo Connection (`mongo-connection.ts`)

Factory function to create a Mongoose connection driven by explicit config (URI, db name).
The interface layer (API, CLI, queue worker bootstrap) is responsible for reading env vars
and passing config in — this library never reads `process.env`.

**API**:

- `createMongoConnection(config)` — connects to MongoDB
- `disconnectMongoConnection(connection)` — gracefully closes the connection
- `pingMongo(connection)` — pings the server for health checks

**Usage** (interface layer code, e.g., API bootstrap):

```typescript
import { createMongoConnection, pingMongo } from 'identity-infrastructure';

// Interface layer reads env and passes to the factory — never inside the lib itself.
const config = {
  uri: process.env.MONGO_URI || 'mongodb://localhost:27017',
  dbName: 'penny',
};

const connection = await createMongoConnection(config);
const isAlive = await pingMongo(connection);
```

## Local Development

Start MongoDB for local testing:

```bash
docker compose -f docker-compose.dev.yml up -d mongodb
```

Connection URI: `mongodb://localhost:27017`

### Smoke Test

Run the Mongo connection smoke test (requires docker-compose mongo to be running):

```bash
docker compose -f docker-compose.dev.yml up -d mongodb
npx nx run identity-infrastructure:vite:test -- --run
docker compose -f docker-compose.dev.yml down
```

The test connects to the docker-compose mongo on the host (`localhost:27017`), pings it, and verifies lifecycle management.
