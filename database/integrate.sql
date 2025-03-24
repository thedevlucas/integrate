-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Versión del servidor:         10.4.32-MariaDB - mariadb.org binary distribution
-- SO del servidor:              Win64
-- HeidiSQL Versión:             12.10.0.7000
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Volcando estructura de base de datos para integrate
CREATE DATABASE IF NOT EXISTS `integrate` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;
USE `integrate`;

-- Volcando estructura para tabla integrate.categories
CREATE TABLE IF NOT EXISTS `categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Volcando datos para la tabla integrate.categories: ~8 rows (aproximadamente)
INSERT INTO `categories` (`id`, `name`) VALUES
	(1, 'Psicólogo'),
	(16, 'Nutricionista'),
	(17, 'Psicopedagogos'),
	(18, 'Fonoaudiólogos'),
	(19, 'Fisioterapeutas'),
	(20, 'Psicomotricistas'),
	(21, 'Psiquiatras'),
	(22, 'Médicos');

-- Volcando estructura para tabla integrate.contact_attempts
CREATE TABLE IF NOT EXISTS `contact_attempts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `profile_id` int(11) NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `profile_ip_idx` (`profile_id`,`ip_address`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Volcando datos para la tabla integrate.contact_attempts: ~10 rows (aproximadamente)
INSERT INTO `contact_attempts` (`id`, `profile_id`, `ip_address`, `created_at`) VALUES
	(1, 8, '::1', '2025-03-15 18:45:56'),
	(2, 8, '::1', '2025-03-15 18:51:06'),
	(3, 8, '::1', '2025-03-15 18:51:34'),
	(4, 8, '::1', '2025-03-15 18:51:43'),
	(5, 8, '::1', '2025-03-15 18:53:31'),
	(6, 8, '::1', '2025-03-15 18:53:36'),
	(7, 8, '::1', '2025-03-15 18:53:37'),
	(8, 8, '::1', '2025-03-15 19:03:21'),
	(9, 8, '::1', '2025-03-15 19:12:09'),
	(10, 8, '::1', '2025-03-15 19:19:17');

-- Volcando estructura para tabla integrate.filter_categories
CREATE TABLE IF NOT EXISTS `filter_categories` (
  `id` char(36) NOT NULL DEFAULT uuid(),
  `name` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Volcando datos para la tabla integrate.filter_categories: ~2 rows (aproximadamente)
INSERT INTO `filter_categories` (`id`, `name`, `created_at`) VALUES
	('4a5609ba-0422-11f0-a007-de3579640a38', 'aaas', '2025-03-18 17:56:15'),
	('c034780a-0419-11f0-a007-de3579640a38', 'asdasd', '2025-03-18 16:55:07');

-- Volcando estructura para tabla integrate.filter_options
CREATE TABLE IF NOT EXISTS `filter_options` (
  `id` char(36) NOT NULL DEFAULT uuid(),
  `category_id` char(36) DEFAULT NULL,
  `name` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_category` (`category_id`),
  CONSTRAINT `fk_category` FOREIGN KEY (`category_id`) REFERENCES `filter_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Volcando datos para la tabla integrate.filter_options: ~3 rows (aproximadamente)
INSERT INTO `filter_options` (`id`, `category_id`, `name`, `created_at`) VALUES
	('4dfb0da5-0422-11f0-a007-de3579640a38', 'c034780a-0419-11f0-a007-de3579640a38', 'axax', '2025-03-18 17:56:21'),
	('527a89e9-0422-11f0-a007-de3579640a38', '4a5609ba-0422-11f0-a007-de3579640a38', 'xxxxxxxxx', '2025-03-18 17:56:28'),
	('c4b96b96-0419-11f0-a007-de3579640a38', 'c034780a-0419-11f0-a007-de3579640a38', 'asdasd', '2025-03-18 16:55:15');

-- Volcando estructura para tabla integrate.locations
CREATE TABLE IF NOT EXISTS `locations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Volcando datos para la tabla integrate.locations: ~43 rows (aproximadamente)
INSERT INTO `locations` (`id`, `name`) VALUES
	(1, 'Canelones'),
	(2, 'Canelones - 18 de Mayo'),
	(3, 'Canelones - Aguas Corrientes'),
	(4, 'Canelones - Atlántida'),
	(5, 'Canelones - Barros Blancos'),
	(6, 'Canelones Ciudad'),
	(7, 'Canelones - Costa Azul'),
	(9, 'Canelones - Cuchilla Alta'),
	(10, 'Canelones - Jaurreguiberry'),
	(11, 'Canelones - Juanicó'),
	(12, 'Canelones - El Pinar'),
	(13, 'Canelones - Empalme Olmos'),
	(14, 'Canelones - La Floresta'),
	(15, 'Canelones - Logomar'),
	(16, 'Canelones - La Paz'),
	(17, 'Canelones - Las Piedras'),
	(18, 'Canelones - Laas Toscas'),
	(19, 'Canelones - Los cerrillos'),
	(20, 'Canelones - Marindia'),
	(21, 'Canelones - Migues'),
	(22, 'Canelones - Neptunia'),
	(23, 'Canelones - Nicolich'),
	(24, 'Canelones - Pando'),
	(25, 'Canelones - Parque del Plata'),
	(26, 'Canelones - Paso Carrasco'),
	(27, 'Canelones - Pinamar'),
	(28, 'Canelones - Progreso'),
	(29, 'Canelones - Salinas'),
	(30, 'Canelones - San Antonio'),
	(31, 'Canelones - Saan Bautista'),
	(32, 'Canelones - San Jancito'),
	(33, 'Canelones - San Ramón'),
	(34, 'Canelones - Santa Lucía'),
	(35, 'Canelones - Santa Rosa'),
	(36, 'Canelones - San Luis'),
	(37, 'Canelones - Santa Lucía del Este'),
	(38, 'Canelones - Sauce'),
	(39, 'Canelones - Shangrilá'),
	(40, 'Canelones - Soca'),
	(41, 'Canelones - Solymar'),
	(42, 'Canelones - Joaquín Suarez'),
	(43, 'Canelones - Tala'),
	(44, 'Canelones - Toledo');

-- Volcando estructura para tabla integrate.orientations
CREATE TABLE IF NOT EXISTS `orientations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Volcando datos para la tabla integrate.orientations: ~14 rows (aproximadamente)
INSERT INTO `orientations` (`id`, `name`) VALUES
	(1, 'Psicoanálisis'),
	(2, 'Terapia cognitivo conductual'),
	(3, 'Mindfulness'),
	(4, 'EMDR'),
	(5, 'Logoterapia'),
	(6, 'Psicodrama'),
	(7, 'Psicología Positiva'),
	(8, 'Psicoterapia Integral'),
	(9, 'Sexología'),
	(10, 'Terapia gestáltica'),
	(11, 'Terapia junguiana'),
	(12, 'Terapia sistémica familiar'),
	(13, 'DBT'),
	(14, 'Otras terapias');

-- Volcando estructura para tabla integrate.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(50) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `fullname` varchar(50) DEFAULT NULL,
  `phone` int(11) DEFAULT NULL,
  `languages` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '{"languages": ["Español"]}',
  `short_description` text DEFAULT NULL,
  `presential` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '{"online": false,"presential": false}' CHECK (json_valid(`presential`)),
  `patients_type` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '{"niños": false,"adolescentes": false, "adultos": false, "parejas": false, "familias": false}',
  `contact_clicks` int(11) DEFAULT NULL,
  `recommended` tinyint(1) DEFAULT 0,
  `gender` tinyint(1) DEFAULT 0,
  `status` enum('pending','active','inactive') DEFAULT 'pending',
  `group` enum('professional','admin') DEFAULT 'professional',
  `reg_ip` varchar(50) DEFAULT NULL,
  `created_at` date DEFAULT current_timestamp(),
  `avatar` longtext DEFAULT NULL,
  `university_degree` longtext DEFAULT NULL,
  `transfer_ticket` longtext DEFAULT NULL,
  `category_id` int(11) DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `orientation_id` int(11) DEFAULT NULL,
  `location` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Volcando datos para la tabla integrate.users: ~1 rows (aproximadamente)
INSERT INTO `users` (`id`, `email`, `password`, `fullname`, `phone`, `languages`, `short_description`, `presential`, `patients_type`, `contact_clicks`, `recommended`, `gender`, `status`, `group`, `reg_ip`, `created_at`, `avatar`, `university_degree`, `transfer_ticket`, `category_id`, `location_id`, `orientation_id`, `location`) VALUES
	(4, 'root@panel.com', '$2a$10$F6EG4ySru.r9Mjt4kPNHSeKWIhlVZhPc6LIeXEJlfbYQA8rS5uUdu', 'root', NULL, NULL, NULL, '{"online": false,"presential": false}', '{"niños": false,"adolescentes": false, "adultos": false}', NULL, NULL, 0, 'inactive', 'admin', NULL, '0000-00-00', NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- Volcando estructura para tabla integrate.user_filters
CREATE TABLE IF NOT EXISTS `user_filters` (
  `id` char(36) NOT NULL DEFAULT uuid(),
  `user_id` char(36) NOT NULL,
  `category_id` char(36) NOT NULL,
  `option_id` char(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`,`category_id`,`option_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Volcando datos para la tabla integrate.user_filters: ~0 rows (aproximadamente)

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
