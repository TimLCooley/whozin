-- Duration of an activity in hours. Null means no duration set (falls back to
-- the previous implicit 2 hour default for calendar exports). Values are
-- sourced from chip picks in the UI: 1, 2, 3, 4 ("4+").
ALTER TABLE whozin_activity ADD COLUMN IF NOT EXISTS duration_hours int;
