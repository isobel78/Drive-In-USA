-- Drive-In USA — MySQL Schema
-- Run this once to create the theaters table.

CREATE TABLE IF NOT EXISTS theaters (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255)    NOT NULL,
    address     VARCHAR(255)    NOT NULL DEFAULT '',
    city        VARCHAR(100)    NOT NULL DEFAULT '',
    state       VARCHAR(10)     NOT NULL DEFAULT '',
    state_long  VARCHAR(100)    NOT NULL DEFAULT '',
    lat         DECIMAL(10, 7)  NOT NULL DEFAULT 0,
    lng         DECIMAL(10, 7)  NOT NULL DEFAULT 0,
    description TEXT            DEFAULT '',
    website     VARCHAR(500)    DEFAULT '',
    created_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_state (state),
    INDEX idx_name  (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ip           VARCHAR(45) NOT NULL,
    attempted_at DATETIME    NOT NULL,
    INDEX idx_ip_time (ip, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
