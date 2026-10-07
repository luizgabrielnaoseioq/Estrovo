export const addPhotoTimesSql = `
  ALTER TABLE activities ADD COLUMN start_photo_taken_at INTEGER;
  ALTER TABLE activities ADD COLUMN finish_photo_taken_at INTEGER;
`;
