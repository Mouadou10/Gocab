-- Reset all previously-moved leads to use their created_at as status_changed_at
-- This way only leads moved TODAY (after the fix) will have today's date
UPDATE Lead SET status_changed_at = created_at WHERE board_column != 'NEW_LEADS';
