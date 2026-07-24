-- Topic I.III's four subtopics ("Prioritising When Money Is Limited",
-- "Small Amounts Still Count", "Needs vs Wants, Applied", "Practice:
-- Deciding With a Fixed Amount") each got their slides inserted twice --
-- 17 rows total, every one confirmed to be an exact duplicate (same
-- heading and body, different id) of another row already present for the
-- same subtopic_id + order. `slides` inserts have never had an
-- `on conflict` guard (no natural unique key was given), so a retried
-- paste from the multi-attempt SQL Editor saga on July 24 left both
-- copies in place instead of silently no-op'ing.
--
-- This surfaced as duplicated slides in the Lesson flow's step list
-- (slide 1, 1, 2, 2, 3, 4, ...) when deep-linking into one of these
-- subtopics. The step-building code was fine -- it was faithfully
-- rendering two real rows per slide.
--
-- Deleting by fixed id (not a dedup query) since each id below was
-- verified content-identical to its surviving pair before this migration
-- was written -- safe to re-run, since a second run just deletes zero rows.
delete from slides where id in (
  '9935589b-ed77-40b9-825c-f165c30e6830',
  'e5d542d5-ef71-4233-8792-e4e28ba6b083',
  '14da7ec3-1718-4315-869a-d182abe9e591',
  '1dee7b52-2690-4987-9488-5cb9286a6f58',
  'da62e26e-896c-4e0d-9770-86ce2601ae92',
  'ffe4cbac-c8fa-42bc-b1e9-fee0b8560e02',
  'c59c14dd-d754-4158-b9ed-8cf48d567ba1',
  'd0b41d3d-98ba-4e29-8e08-2d7387fc04d2',
  '4ef90331-b00e-4805-ba03-f95d6dc5de90',
  'af510521-b8c6-4547-908c-44f8d2180586',
  'd9bcfc37-825d-4b5c-a3ed-474bc2a11de8',
  'cd57b35d-3bc2-400b-b9f4-bf92d997d439',
  '6ffbd8a1-5b1a-460f-8a35-85be4101dfa3',
  'ff9f43af-eba2-4b70-a898-4a8b4203fe90',
  '4c03b1be-7f1d-4e73-a9cb-7d313a32b808',
  'ed10f6ca-ffef-4b99-8043-d2640c91b239',
  '885ef952-d6c0-4ac9-9ea3-29438b17747c'
);
