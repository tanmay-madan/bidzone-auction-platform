-- Consolidated Docker init script: Schema + Initial Seed
\i /docker-entrypoint-initdb.d/01_schema.sql
\i /docker-entrypoint-initdb.d/02_seed.sql
