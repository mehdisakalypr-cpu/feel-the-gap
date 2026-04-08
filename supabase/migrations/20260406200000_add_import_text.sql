ALTER TABLE countries 
  ADD COLUMN IF NOT EXISTS top_import_text text,
  ADD COLUMN IF NOT EXISTS top_export_text text;
