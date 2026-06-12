-- EduRanker — Database Schema & Seed Data
-- Import file ini ke phpMyAdmin (Database: eduranker)

CREATE DATABASE IF NOT EXISTS `eduranker`;
USE `eduranker`;

-- 1. Tabel Users
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `display_name` VARCHAR(100) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'user',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tabel Students (Ditambahkan kolom class_name untuk dukungan multi-kelas)
CREATE TABLE IF NOT EXISTS `students` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `class_name` VARCHAR(50) NOT NULL DEFAULT '10-A',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Tabel Scores
CREATE TABLE IF NOT EXISTS `scores` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT NOT NULL,
  `subject` VARCHAR(50) NOT NULL,
  `score` INT NOT NULL CHECK (`score` >= 0 AND `score` <= 100),
  UNIQUE KEY `student_subject` (`student_id`, `subject`),
  CONSTRAINT `fk_scores_students` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Seed Data (Default Users & Demo Students)
-- Password admin: admin123 (bcrypt hash: $2a$10$5GuhtE6GEtdTr2kFWIlriOH2jmg1Nj.TtItPDEksJK4EHkzDlT9Ye)
-- Password user: user123 (bcrypt hash: $2a$10$5GuhtE6GEtdTr2kFWIlriOM6hSNCnUcZU3xq7.5JtWPqc2W82BJda)

INSERT INTO `users` (`id`, `username`, `password`, `display_name`, `role`) VALUES
(1, 'admin', '$2a$10$5GuhtE6GEtdTr2kFWIlriOH2jmg1Nj.TtItPDEksJK4EHkzDlT9Ye', 'Administrator', 'admin'),
(2, 'user', '$2a$10$5GuhtE6GEtdTr2kFWIlriOM6hSNCnUcZU3xq7.5JtWPqc2W82BJda', 'User Viewer', 'user')
ON DUPLICATE KEY UPDATE `username`=`username`;

INSERT INTO `students` (`id`, `name`, `class_name`) VALUES
(1, 'Andi Pratama', '10-A'),
(2, 'Budi Santoso', '10-A'),
(3, 'Citra Dewi', '10-B'),
(4, 'Dina Fitriani', '10-B'),
(5, 'Eko Setiawan', '10-A')
ON DUPLICATE KEY UPDATE `name`=`name`, `class_name`=`class_name`;

INSERT INTO `scores` (`student_id`, `subject`, `score`) VALUES
(1, 'Matematika', 92),
(1, 'B. Indonesia', 88),
(1, 'B. Inggris', 85),
(1, 'IPA', 90),
(1, 'IPS', 87),
(2, 'Matematika', 75),
(2, 'B. Indonesia', 80),
(2, 'B. Inggris', 70),
(2, 'IPA', 68),
(2, 'IPS', 72),
(3, 'Matematika', 60),
(3, 'B. Indonesia', 65),
(3, 'B. Inggris', 58),
(3, 'IPA', 62),
(4, 'Matematika', 45),
(4, 'B. Indonesia', 50),
(4, 'IPS', 48),
(5, 'Matematika', 88),
(5, 'B. Indonesia', 92),
(5, 'B. Inggris', 90),
(5, 'IPA', 85),
(5, 'IPS', 89)
ON DUPLICATE KEY UPDATE `score`=`score`;
