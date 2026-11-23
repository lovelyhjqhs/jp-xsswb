-- Persist match suggestions and administrator decisions without exposing private item fields.
ALTER TABLE `items`
  ADD COLUMN `internal_note` TEXT NULL,
  ADD INDEX `items_type_area_status_happened_at_idx` (`type`, `area`, `status`, `happened_at`),
  ADD INDEX `items_category_id_happened_at_idx` (`category_id`, `happened_at`);

CREATE TABLE `lost_found_matches` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `source_item_id` INTEGER NOT NULL,
  `target_item_id` INTEGER NOT NULL,
  `score` INTEGER NOT NULL DEFAULT 0,
  `reasons` JSON NOT NULL,
  `status` ENUM('suggested', 'confirmed', 'ignored') NOT NULL DEFAULT 'suggested',
  `decision_note` VARCHAR(500) NULL,
  `decided_by` INTEGER NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `lost_found_matches_source_item_id_target_item_id_key` (`source_item_id`, `target_item_id`),
  INDEX `lost_found_matches_source_item_id_status_score_idx` (`source_item_id`, `status`, `score`),
  INDEX `lost_found_matches_target_item_id_status_score_idx` (`target_item_id`, `status`, `score`),
  INDEX `lost_found_matches_decided_by_idx` (`decided_by`),
  PRIMARY KEY (`id`),
  CONSTRAINT `lost_found_matches_source_item_id_fkey` FOREIGN KEY (`source_item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `lost_found_matches_target_item_id_fkey` FOREIGN KEY (`target_item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `lost_found_matches_decided_by_fkey` FOREIGN KEY (`decided_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
