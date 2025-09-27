CREATE TABLE saved_connections (
   id UUID PRIMARY KEY,
   key_hash VARCHAR(128),
   valid_until TIMESTAMP
)
