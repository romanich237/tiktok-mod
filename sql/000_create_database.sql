-- Создание локальной базы MySQL (выполняется установщиком или вручную)
CREATE DATABASE IF NOT EXISTS tiktok_mod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'tiktok'@'localhost' IDENTIFIED BY 'tiktokpass';
GRANT ALL PRIVILEGES ON tiktok_mod.* TO 'tiktok'@'localhost';
FLUSH PRIVILEGES;
