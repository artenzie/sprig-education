-- Fix: RLS policies alone weren't enough. Postgres requires the querying
-- role to hold a base table-level GRANT before RLS policies are even
-- evaluated -- these tables never got that grant when they were created,
-- so anon requests were failing with "permission denied for table X"
-- (a real privilege error, not RLS silently filtering rows).
--
-- Curriculum-only, same as the read policies -- no student data tables.
grant select on topics, subtopics, slides, questions to anon, authenticated;
