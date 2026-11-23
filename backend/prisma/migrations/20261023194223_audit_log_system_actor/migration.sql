-- DropForeignKey
ALTER TABLE `audit_logs` DROP FOREIGN KEY `audit_logs_admin_id_fkey`;

-- AlterTable
ALTER TABLE `audit_logs` MODIFY `admin_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
