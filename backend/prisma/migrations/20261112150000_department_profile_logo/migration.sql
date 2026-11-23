-- Add a public media reference for the department identity image.
ALTER TABLE `department_profiles` ADD COLUMN `logo_media_id` INTEGER NULL;

CREATE UNIQUE INDEX `department_profiles_logo_media_id_key` ON `department_profiles`(`logo_media_id`);

ALTER TABLE `department_profiles`
  ADD CONSTRAINT `department_profiles_logo_media_id_fkey`
  FOREIGN KEY (`logo_media_id`) REFERENCES `site_media`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
