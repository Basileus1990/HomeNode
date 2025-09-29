CREATE TABLE saved_connections (
   id UUID PRIMARY KEY,
   key_hash VARCHAR(128),
   created_at TIMESTAMP
)
