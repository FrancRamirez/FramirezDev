-- Ejecutar una vez en TiDB Cloud (SQL Editor).
CREATE TABLE IF NOT EXISTS web_vitals (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pagina VARCHAR(120) NOT NULL,
  lcp FLOAT NULL,
  cls FLOAT NULL,
  inp FLOAT NULL,
  fcp FLOAT NULL,
  ttfb FLOAT NULL,
  dispositivo ENUM('mobile','tablet','desktop') NOT NULL,
  conexion VARCHAR(10) NULL,
  fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fecha (fecha_hora),
  INDEX idx_pagina_fecha (pagina, fecha_hora)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
