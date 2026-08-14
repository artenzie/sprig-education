-- Real Tier 4 content for Topic IV.III — Present Value & Future Value.
-- Same pattern as Tier 1/2/3: fixed UUIDs for topic/subtopic rows (safe to
-- re-run), slides/questions are a single-shot content load (no on-conflict
-- guard -- do not paste this file twice).

insert into topics (id, tier, "order", title, video_url)
values ('5345d9af-7ea3-44b8-b643-cc7b6a6f60db', 4, 3, 'Present Value & Future Value', null)
on conflict (id) do nothing;

insert into subtopics (id, topic_id, title, "order")
values
  ('e1065541-d482-45a2-a7be-74c8527f4dde', '5345d9af-7ea3-44b8-b643-cc7b6a6f60db', 'What "Value Over Time" Means', 1),
  ('1d191b69-ba52-4f27-946e-fb507afd5ee9', '5345d9af-7ea3-44b8-b643-cc7b6a6f60db', 'Future Value', 2),
  ('5254b417-5dd3-42b1-8255-114d0d037fd1', '5345d9af-7ea3-44b8-b643-cc7b6a6f60db', 'Present Value', 3),
  ('872cb8e4-3c6e-4cdf-8756-174a72c94ba4', '5345d9af-7ea3-44b8-b643-cc7b6a6f60db', 'Practice: Real Examples', 4)
on conflict (id) do nothing;

insert into slides (subtopic_id, "order", heading, body, slide_type)
values
  ('e1065541-d482-45a2-a7be-74c8527f4dde', 1, '£100 now and £100 in five years are not the same thing', 'Almost everyone would take the money now, and they''d be right — but the reason matters.

It isn''t impatience. Money you have now can be doing something — earning interest, or buying something you need today — and money arriving in five years may buy less by then because of inflation.', 'text'),
  ('e1065541-d482-45a2-a7be-74c8527f4dde', 2, 'Two questions, one idea', 'Future value — I have money now; what will it be worth later?

Present value — I''m promised money later; what''s it worth to me now?

The same relationship read in opposite directions. One multiplies forward; the other divides back.', 'text'),
  ('e1065541-d482-45a2-a7be-74c8527f4dde', 3, 'The rate is doing the work', 'Both need a rate — what your money could reasonably grow by if you had it. When working backwards it''s called the discount rate.

It isn''t a fact about the world; it''s an assumption. Change the rate and the answer changes — which is why anyone showing you a present-value figure should tell you what rate they used.', 'text'),
  ('1d191b69-ba52-4f27-946e-fb507afd5ee9', 1, 'The formula', '$$FV = PV \times (1 + r)^{t}$$

The same structure as compound interest, because it is compound interest — asked as a question about time rather than about savings.', 'text'),
  ('1d191b69-ba52-4f27-946e-fb507afd5ee9', 2, 'Worked example', '£200 today, at 6%, for 5 years.

$1.06^{5} = 1.338226$

$200 \times 1.338226 = 267.65$

So £200 today grows into £267.65 in five years.', 'text'),
  ('1d191b69-ba52-4f27-946e-fb507afd5ee9', 3, 'What this is actually for', 'It''s the honest comparison when someone offers you a choice.

Offered £200 now or £250 in five years, at 6%: the £200 becomes £267.65, which beats £250. Take the money now — not on instinct, but because you worked it out.', 'text'),
  ('1d191b69-ba52-4f27-946e-fb507afd5ee9', 4, 'The rate you assume changes the answer', 'Same £200, same five years, but at 2%:

$200 \times 1.02^{5} = 220.82$

Now £250 later wins comfortably. Neither answer is wrong — they''re answers to different assumptions, which is exactly why the rate has to be stated rather than buried.', 'text'),
  ('5254b417-5dd3-42b1-8255-114d0d037fd1', 1, 'Running it backwards', '$$PV = \frac{FV}{(1 + r)^{t}}$$

Instead of growing money forward, you''re shrinking a future amount back to what it''s worth today. Same numbers, opposite operation.', 'text'),
  ('5254b417-5dd3-42b1-8255-114d0d037fd1', 2, 'Worked example', 'You''ll be given £1,000 in 8 years. Your money could otherwise grow at 5%. What''s that promise worth today?

$1.05^{8} = 1.477455$

$\frac{1000}{1.477455} = 676.84$

So £1,000 in eight years is worth about £676.84 to you now. If someone offered you £700 today instead, you should take it.', 'text'),
  ('5254b417-5dd3-42b1-8255-114d0d037fd1', 3, 'Discounting', 'That shrinking-back is called discounting, and the further away the money is, the harder it shrinks.

£1,000 at 5% is worth about £952 in one year, £784 in five years, and £377 in twenty. Same £1,000 — the distance is what''s doing it.', 'text'),
  ('5254b417-5dd3-42b1-8255-114d0d037fd1', 4, 'Why anyone bothers', 'This is the arithmetic underneath a lot of adult decisions: whether to take a lump sum or instalments, whether a deal is worth what it claims.

It''s also why "pay later" offers feel generous. A payment far away genuinely is worth less than one today — the real question is whether it''s enough less to be worth the borrowing.', 'text'),
  ('872cb8e4-3c6e-4cdf-8756-174a72c94ba4', 1, 'What you''re about to do', 'Both directions — growing amounts forward, discounting promised amounts back, and comparing two options honestly rather than by instinct.

Two things to watch: $r$ is a decimal, and the rate you assume changes the answer. State it, don''t hide it.', 'text');

insert into questions (subtopic_id, tier, "order", question_type, question_text, options, correct_answer, accepted_answers, tolerance, explanation)
values
  ('e1065541-d482-45a2-a7be-74c8527f4dde', 4, 1, 'mcq', 'Why is £100 today worth more than £100 in five years?', '["Because people are naturally impatient","Money now can be earning, and money later may buy less","Because banks charge fees on delayed payments","It isn''t — £100 is £100"]'::jsonb, '1', null, null, 'Two real reasons, not one: what you could do with it in the meantime, and inflation eroding what it buys by the time it arrives. Impatience is a feeling; these are arithmetic.'),
  ('e1065541-d482-45a2-a7be-74c8527f4dde', 4, 2, 'mcq', 'What''s the difference between future value and present value?', '["Future value applies to investments, present value to savings","One grows an amount forward; the other shrinks a future amount back to today","Present value only applies to money you already have","They''re two names for the same calculation"]'::jsonb, '1', null, null, 'The same relationship read in opposite directions — one multiplies, the other divides. They''re not different concepts, just different questions asked of the same idea.'),
  ('e1065541-d482-45a2-a7be-74c8527f4dde', 4, 3, 'mcq', 'Someone shows you a present-value figure without saying what rate they used. Why does that matter?', '["The calculation is invalid without a rate","The rate is an assumption, and changing it changes the answer","Rates are legally required to be disclosed","It doesn''t — present value is fixed for a given amount"]'::jsonb, '1', null, null, 'The discount rate isn''t a fact about the world; it''s a judgement about what your money could otherwise do. Two honest people can produce different figures from the same amount, which is exactly why the rate has to be stated.'),
  ('1d191b69-ba52-4f27-946e-fb507afd5ee9', 4, 1, 'num', 'Using FV = PV × (1 + r)^t, what is the future value of £1,000 at 10% for 2 years? Give your answer in pounds.', '[]'::jsonb, '1210', null, null, '1.1 squared is 1.21, and 1000 × 1.21 = 1210. Same structure as compound interest, because it is compound interest — asked as a question about time rather than savings.'),
  ('1d191b69-ba52-4f27-946e-fb507afd5ee9', 4, 2, 'num', 'What is the future value of £2,000 at 10% for 1 year? Give your answer in pounds.', '[]'::jsonb, '2200', null, null, '2000 × 1.1 = 2200. One year makes the arithmetic obvious — the formula''s usefulness shows up once t gets larger and mental arithmetic stops working.'),
  ('1d191b69-ba52-4f27-946e-fb507afd5ee9', 4, 3, 'mcq', 'You''re offered £200 now or £250 in five years, and your money could grow at 6%. £200 at 6% for five years becomes £267.65. Which should you take?', '["The £250 later — it''s more money","The £200 now, since it grows to more than £250","Either — they''re equivalent","There isn''t enough information to decide"]'::jsonb, '1', null, null, '£267.65 beats £250, so taking it now wins. The point isn''t the answer, it''s that you can work it out rather than guessing — "more money later" is exactly the instinct this calculation exists to check.'),
  ('1d191b69-ba52-4f27-946e-fb507afd5ee9', 4, 4, 'mcq', '£200 at 6% for five years becomes £267.65, but at 2% it becomes only £220.82. What does that show?', '["Higher rates are always available if you look","The assumed rate can flip which option is better","Future value calculations are unreliable","Short time periods make rates irrelevant"]'::jsonb, '1', null, null, 'At 6% the £200 beats £250 later; at 2% it doesn''t. Neither answer is wrong — they answer different assumptions, which is why the rate has to be stated rather than buried.'),
  ('5254b417-5dd3-42b1-8255-114d0d037fd1', 4, 1, 'text', 'What''s the term for shrinking a future amount back to what it''s worth today?', '[]'::jsonb, 'discounting', '["discounting","discount","discounted"]'::jsonb, null, 'Discounting. The further away the money is, the harder it shrinks — £1,000 at 5% is worth about £952 in one year, but only about £377 in twenty.'),
  ('5254b417-5dd3-42b1-8255-114d0d037fd1', 4, 2, 'num', 'Using PV = FV ÷ (1 + r)^t, what is the present value of £1,210 received in 2 years, at 10%? Give your answer in pounds.', '[]'::jsonb, '1000', null, null, '1.1 squared is 1.21, and 1210 ÷ 1.21 = 1000. Notice this is the exact reverse of growing £1,000 forward for two years — the two formulas undo each other.'),
  ('5254b417-5dd3-42b1-8255-114d0d037fd1', 4, 3, 'num', 'What is the present value of £1,100 received in 1 year, at 10%? Give your answer in pounds.', '[]'::jsonb, '1000', null, null, '1100 ÷ 1.1 = 1000. So being promised £1,100 next year is worth exactly £1,000 to you today, if 10% is what your money could otherwise do.'),
  ('5254b417-5dd3-42b1-8255-114d0d037fd1', 4, 4, 'mcq', 'You''ll receive £1,000 in eight years. At 5%, that''s worth about £676.84 today. Someone offers you £700 now instead. What should you do?', '["Take the £1,000 later — it''s more money","Take the £700 now, since it beats the present value of £676.84","Neither — they''re equivalent","Take the £1,000 later, but only if inflation is low"]'::jsonb, '1', null, null, '£700 today is worth more than a promise of £1,000 in eight years, given a 5% rate. This is the arithmetic behind a lot of adult decisions — lump sum versus instalments, and whether a deal is worth what it claims.'),
  ('872cb8e4-3c6e-4cdf-8756-174a72c94ba4', 4, 1, 'num', 'What is the future value of £500 at 10% for 2 years? Give your answer in pounds.', '[]'::jsonb, '605', null, null, '500 × 1.1 = 550, then 550 × 1.1 = 605. Or directly: 500 × 1.21 = 605.'),
  ('872cb8e4-3c6e-4cdf-8756-174a72c94ba4', 4, 2, 'num', 'What is the present value of £2,420 received in 2 years, at 10%? Give your answer in pounds.', '[]'::jsonb, '2000', null, null, '2420 ÷ 1.21 = 2000. Check it forwards: 2000 × 1.1 × 1.1 = 2420.'),
  ('872cb8e4-3c6e-4cdf-8756-174a72c94ba4', 4, 3, 'mcq', 'Why do "pay later" offers often feel more generous than they are?', '["They usually include a hidden discount","A payment far away genuinely is worth less — the question is whether it''s enough less","They''re always more expensive overall","The total is usually displayed incorrectly"]'::jsonb, '1', null, null, 'The instinct that later money is cheaper is correct. What present value gives you is the ability to check whether the difference actually covers what you''re paying for the delay.'),
  ('872cb8e4-3c6e-4cdf-8756-174a72c94ba4', 4, 4, 'multi', 'Which of these are true about present and future value calculations?', '["Both need an assumed rate","The rate should be stated, not hidden","Present value divides where future value multiplies","Present value only works for amounts under a year away"]'::jsonb, '[0,1,2]', null, null, 'A, B and C. D is wrong and the misconception is worth catching — discounting works over any period, and it matters more over long ones, not less.');
