-- Provision the single starter account used by the app's password sign-in.
-- Passwords are not stored: auth.php validates against the mobile number's last four digits.
INSERT INTO `tbl_trip_family` (`family_name`)
SELECT 'Vraj Family'
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_trip_family` WHERE `family_name` = 'Vraj Family' AND `is_deleted` = '1'
);

SET @vraj_family_id := (
  SELECT `family_id` FROM `tbl_trip_family`
  WHERE `family_name` = 'Vraj Family' AND `is_deleted` = '1'
  ORDER BY `family_id` LIMIT 1
);

INSERT INTO `tbl_trip_user` (`family_id`, `full_name`, `mobile`, `email`, `is_admin`)
SELECT @vraj_family_id, 'Vraj', '8200043151', 'vraj@pocket-trip-ledger.local', 1
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_trip_user` WHERE `mobile` = '8200043151'
);

SET @vraj_user_id := (
  SELECT `user_id` FROM `tbl_trip_user` WHERE `mobile` = '8200043151' LIMIT 1
);

UPDATE `tbl_trip_user`
SET `full_name` = 'Vraj', `is_admin` = 1,
    `family_id` = COALESCE(`family_id`, @vraj_family_id)
WHERE `user_id` = @vraj_user_id;

UPDATE `tbl_trip_family`
SET `head_user_id` = @vraj_user_id
WHERE `family_id` = @vraj_family_id AND `head_user_id` IS NULL;
