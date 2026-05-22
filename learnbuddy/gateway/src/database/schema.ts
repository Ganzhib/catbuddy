/** Idempotent MySQL schema for gateway persistence. */
export const GATEWAY_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS gateway_users (
    email VARCHAR(255) NOT NULL PRIMARY KEY,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME(3) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS gateway_sessions (
    session_key VARCHAR(512) NOT NULL PRIMARY KEY,
    title VARCHAR(512) NOT NULL DEFAULT '',
    preview TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    last_consolidated BIGINT NOT NULL DEFAULT 0,
    metadata JSON NOT NULL,
    INDEX idx_gateway_sessions_updated (updated_at DESC)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS gateway_session_messages (
    session_key VARCHAR(512) NOT NULL,
    message_id BIGINT NOT NULL,
    role ENUM('user', 'assistant', 'tool', 'system') NOT NULL,
    content MEDIUMTEXT NOT NULL,
    tool_calls JSON NULL,
    tool_call_id VARCHAR(64) NULL,
    name VARCHAR(128) NULL,
    media JSON NULL,
    ts DATETIME(3) NOT NULL,
    PRIMARY KEY (session_key, message_id),
    CONSTRAINT fk_gateway_messages_session
      FOREIGN KEY (session_key) REFERENCES gateway_sessions (session_key)
      ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
] as const
