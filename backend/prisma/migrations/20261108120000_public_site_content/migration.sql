-- Public website content tables. Existing student/legacy item tables remain intact.

CREATE TABLE `department_profiles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `profile_key` VARCHAR(32) NOT NULL,
    `history` TEXT NOT NULL,
    `organization` TEXT NOT NULL,
    `spirit` TEXT NOT NULL,
    `status` ENUM('draft', 'pending_review', 'published', 'rejected', 'archived', 'deleted') NOT NULL DEFAULT 'draft',
    `published_at` DATETIME(3) NULL,
    `updated_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `department_profiles_profile_key_key`(`profile_key`),
    INDEX `department_profiles_status_published_at_idx`(`status`, `published_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `site_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kind` ENUM('news', 'mailbox', 'canteen') NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `site_categories_kind_name_key`(`kind`, `name`),
    UNIQUE INDEX `site_categories_kind_slug_key`(`kind`, `slug`),
    INDEX `site_categories_kind_enabled_sort_order_idx`(`kind`, `enabled`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `site_media` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `url` VARCHAR(255) NOT NULL,
    `alt_text` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `kind` ENUM('image', 'attachment') NOT NULL,
    `visibility` ENUM('public', 'private', 'admin_only') NOT NULL DEFAULT 'private',
    `byte_size` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `sha256` CHAR(64) NOT NULL,
    `uploaded_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    INDEX `site_media_visibility_kind_idx`(`visibility`, `kind`),
    INDEX `site_media_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `news` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(160) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `category_id` INTEGER NULL,
    `summary` VARCHAR(500) NOT NULL,
    `body` LONGTEXT NOT NULL,
    `cover_media_id` INTEGER NULL,
    `status` ENUM('draft', 'pending_review', 'published', 'rejected', 'archived', 'deleted') NOT NULL DEFAULT 'draft',
    `published_at` DATETIME(3) NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `news_slug_key`(`slug`),
    UNIQUE INDEX `news_cover_media_id_key`(`cover_media_id`),
    INDEX `news_status_published_at_idx`(`status`, `published_at`),
    INDEX `news_category_id_published_at_idx`(`category_id`, `published_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `canteen_monthly_reports` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `report_month` DATE NOT NULL,
    `survey_summary` LONGTEXT NOT NULL,
    `feedback_summary` LONGTEXT NOT NULL,
    `status` ENUM('draft', 'pending_review', 'published', 'rejected', 'archived', 'deleted') NOT NULL DEFAULT 'draft',
    `published_at` DATETIME(3) NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `canteen_monthly_reports_report_month_key`(`report_month`),
    INDEX `canteen_monthly_reports_status_report_month_idx`(`status`, `report_month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `canteen_feedback` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `report_month` DATE NULL,
    `submit_mode` ENUM('anonymous', 'signed') NOT NULL,
    `class_name` VARCHAR(80) NULL,
    `name` VARCHAR(80) NULL,
    `contact_type` ENUM('wechat', 'qq', 'phone', 'other') NULL,
    `contact_value` VARCHAR(160) NULL,
    `content` TEXT NOT NULL,
    `status` ENUM('pending_review', 'approved', 'rejected', 'processing', 'processed', 'archived', 'deleted') NOT NULL DEFAULT 'pending_review',
    `public_allowed` BOOLEAN NOT NULL DEFAULT false,
    `public_content` TEXT NULL,
    `admin_reply` TEXT NULL,
    `internal_note` TEXT NULL,
    `query_no` VARCHAR(32) NOT NULL,
    `query_credential_hash` CHAR(64) NOT NULL,
    `idempotency_key_hash` CHAR(64) NULL,
    `content_fingerprint` CHAR(64) NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `canteen_feedback_query_no_key`(`query_no`),
    INDEX `canteen_feedback_status_submitted_at_idx`(`status`, `submitted_at`),
    INDEX `canteen_feedback_public_allowed_status_report_month_idx`(`public_allowed`, `status`, `report_month`),
    INDEX `canteen_feedback_idempotency_key_hash_idx`(`idempotency_key_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lost_found_inquiries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `item_id` INTEGER NOT NULL,
    `message` TEXT NOT NULL,
    `contact_type` ENUM('wechat', 'qq', 'phone', 'other') NULL,
    `contact_value` VARCHAR(160) NULL,
    `status` ENUM('pending_review', 'approved', 'rejected', 'processing', 'processed', 'archived', 'deleted') NOT NULL DEFAULT 'pending_review',
    `admin_reply` TEXT NULL,
    `internal_note` TEXT NULL,
    `query_no` VARCHAR(32) NOT NULL,
    `query_credential_hash` CHAR(64) NOT NULL,
    `idempotency_key_hash` CHAR(64) NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `lost_found_inquiries_query_no_key`(`query_no`),
    INDEX `lost_found_inquiries_item_id_status_idx`(`item_id`, `status`),
    INDEX `lost_found_inquiries_status_submitted_at_idx`(`status`, `submitted_at`),
    INDEX `lost_found_inquiries_idempotency_key_hash_idx`(`idempotency_key_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `mailbox_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `submit_mode` ENUM('anonymous', 'signed') NOT NULL,
    `class_name` VARCHAR(80) NULL,
    `name` VARCHAR(80) NULL,
    `contact_type` ENUM('wechat', 'qq', 'phone', 'other') NULL,
    `contact_value` VARCHAR(160) NULL,
    `subject` VARCHAR(160) NOT NULL,
    `category_id` INTEGER NULL,
    `content` TEXT NOT NULL,
    `public_allowed` BOOLEAN NOT NULL DEFAULT false,
    `public_content` TEXT NULL,
    `admin_reply` TEXT NULL,
    `internal_note` TEXT NULL,
    `status` ENUM('pending_review', 'approved', 'rejected', 'processing', 'processed', 'archived', 'deleted') NOT NULL DEFAULT 'pending_review',
    `query_no` VARCHAR(32) NOT NULL,
    `query_credential_hash` CHAR(64) NOT NULL,
    `idempotency_key_hash` CHAR(64) NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `mailbox_messages_query_no_key`(`query_no`),
    INDEX `mailbox_messages_status_submitted_at_idx`(`status`, `submitted_at`),
    INDEX `mailbox_messages_public_allowed_status_submitted_at_idx`(`public_allowed`, `status`, `submitted_at`),
    INDEX `mailbox_messages_category_id_idx`(`category_id`),
    INDEX `mailbox_messages_idempotency_key_hash_idx`(`idempotency_key_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `canteen_report_media` (
    `report_id` INTEGER NOT NULL,
    `media_id` INTEGER NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `canteen_report_media_report_id_sort_order_idx`(`report_id`, `sort_order`),
    PRIMARY KEY (`report_id`, `media_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `news` ADD CONSTRAINT `news_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `site_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `news` ADD CONSTRAINT `news_cover_media_id_fkey` FOREIGN KEY (`cover_media_id`) REFERENCES `site_media`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `mailbox_messages` ADD CONSTRAINT `mailbox_messages_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `site_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `lost_found_inquiries` ADD CONSTRAINT `lost_found_inquiries_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `canteen_report_media` ADD CONSTRAINT `canteen_report_media_report_id_fkey` FOREIGN KEY (`report_id`) REFERENCES `canteen_monthly_reports`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `canteen_report_media` ADD CONSTRAINT `canteen_report_media_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `site_media`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Public lost-found filters are additive and remain nullable for legacy rows.
ALTER TABLE `items`
    ADD COLUMN `area` VARCHAR(1) NULL,
    ADD COLUMN `item_no` VARCHAR(40) NULL,
    ADD COLUMN `features` TEXT NULL,
    ADD COLUMN `public_allowed` BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX `items_item_no_key` ON `items`(`item_no`);
CREATE INDEX `items_area_idx` ON `items`(`area`);
CREATE INDEX `items_public_allowed_idx` ON `items`(`public_allowed`);
