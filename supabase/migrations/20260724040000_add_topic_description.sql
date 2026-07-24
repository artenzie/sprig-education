-- The Topic screen (ported from Lovable) shows a short blurb under the
-- title, above the video. That never had a column to live in -- topics
-- only had a title. Adding it here rather than fabricating copy client-side.

alter table topics
  add column if not exists description text;

update topics set description =
  'Why we buy what we buy — the quiet nudges from ads, friends and our own brains that shape almost every purchase.'
  where id = 'b14567dc-5f0b-4dd3-9e95-9fd54ea4c949';

update topics set description =
  'Work isn''t the only door money comes through. What actually decides how much reaches your hands, and why comparing your situation to anyone else''s was never a fair fight.'
  where id = '74756132-b771-4829-9543-b3dea39d7065';

update topics set description =
  'Prioritising isn''t about having more money — it''s about deciding on purpose, with whatever amount you''ve actually got.'
  where id = '8411e144-bebf-4a31-9173-f159988abf67';

update topics set description =
  'What a bank account is actually doing behind the scenes, why it beats a shoebox of cash, and the real difference between a debit card and a credit card.'
  where id = '22f62d11-54ea-42f6-b31b-3f473393b716';

update topics set description =
  'Why a specific goal beats "just saving", and how to build one that''s realistic enough to actually finish.'
  where id = '39fc0bdd-a692-49de-b7be-73f6928e44b6';
