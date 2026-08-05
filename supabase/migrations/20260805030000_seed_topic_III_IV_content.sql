-- Real Tier 3 content for Topic III.IV — Inflation Basics.
-- Same pattern as Tier 1/2: fixed UUIDs for topic/subtopic rows (safe to
-- re-run), slides/questions are a single-shot content load (no on-conflict
-- guard -- do not paste this file twice).

insert into topics (id, tier, "order", title, video_url)
values ('75230ca1-c6d6-4167-9593-01367eeaa4aa', 3, 4, 'Inflation Basics', null)
on conflict (id) do nothing;

insert into subtopics (id, topic_id, title, "order")
values
  ('bd814062-cb27-4900-947f-083459d96568', '75230ca1-c6d6-4167-9593-01367eeaa4aa', 'Why Things Cost More Over Time', 1),
  ('ea95a4a0-34c2-4bb4-a1e3-aac1488ce045', '75230ca1-c6d6-4167-9593-01367eeaa4aa', 'A Real Example', 2),
  ('3c50a8f1-d933-4842-9055-74f607e64d6e', '75230ca1-c6d6-4167-9593-01367eeaa4aa', 'What Inflation Means for Saved Money', 3),
  ('838c5943-0bf8-4982-a4c2-5a2b2ce125bb', '75230ca1-c6d6-4167-9593-01367eeaa4aa', 'Practice: Spot Inflation in Everyday Life', 4)
on conflict (id) do nothing;

insert into slides (subtopic_id, "order", heading, body)
values
  ('bd814062-cb27-4900-947f-083459d96568', 1, 'Inflation is a rate, not an event', 'Inflation is the general rise in prices across an economy, measured as a percentage per year.

3% inflation means something costing £100 today costs about £103 in a year. Not one specific thing — the average across a huge basket of them.'),
  ('bd814062-cb27-4900-947f-083459d96568', 2, 'How the UK actually measures it', 'The Office for National Statistics collects around 180,000 prices for roughly 700 items every single month. That basket becomes the Consumer Prices Index — CPI — which is what "the inflation rate" usually refers to.

The basket changes over time as what people buy changes, which is itself a small window into how the country''s habits shift.'),
  ('bd814062-cb27-4900-947f-083459d96568', 3, 'Someone is aiming at a number', 'The government sets the Bank of England a target of 2% inflation, and the Bank raises or lowers interest rates to steer toward it.

Not zero — a small, predictable amount of inflation is considered healthier than none, because falling prices tend to make people delay spending, which slows the economy down.'),
  ('bd814062-cb27-4900-947f-083459d96568', 4, 'There''s a letter involved', 'If inflation misses the target by more than 1 percentage point in either direction — above 3% or below 1% — the Governor of the Bank of England must write to the Chancellor explaining why and what they''ll do about it.

A useful detail, because it tells you what counts as normal. Anything outside 1%–3% is officially unusual.'),
  ('ea95a4a0-34c2-4bb4-a1e3-aac1488ce045', 1, 'What it looked like recently', 'UK inflation was under 1% in early 2021. By October 2022 it hit 11.1% — the highest in 41 years — driven largely by energy and food prices.

It fell back to around the 2% target by mid-2024, then rose again through 2025. In June 2026 it was around 2.6%.

(That last figure moves every month. The pattern is the lesson, not the number.)'),
  ('ea95a4a0-34c2-4bb4-a1e3-aac1488ce045', 2, 'What 11.1% actually meant', 'Something costing £100 in October 2021 cost about £111 a year later.

A £50 weekly shop became roughly £55.55 for the same items. Nothing improved; the number just got bigger. That''s the year a lot of people learned what inflation feels like rather than what it means.'),
  ('ea95a4a0-34c2-4bb4-a1e3-aac1488ce045', 3, 'Inflation compounds too', 'This is the part people miss. Three years at 3% isn''t 9%.

Year 1: £100 → £103
Year 2: £103 → £106.09
Year 3: £106.09 → £109.27

Over ten years at 3%, £100 of prices becomes about £134. The same mechanism as compound interest, working on prices instead of savings.'),
  ('ea95a4a0-34c2-4bb4-a1e3-aac1488ce045', 4, 'Which is why old prices sound absurd', 'When someone says a chocolate bar cost 20p, they''re not describing a better world — they''re describing compounding run over decades.

Prices roughly doubling every 24 years at 3% is just the Rule of 72 again: 72 ÷ 3 = 24.'),
  ('3c50a8f1-d933-4842-9055-74f607e64d6e', 1, 'Two different returns', 'Nominal return — the number on your account. 3%.
Real return — what you actually gained in buying power, after inflation.

Roughly: real ≈ nominal − inflation.'),
  ('3c50a8f1-d933-4842-9055-74f607e64d6e', 2, 'The uncomfortable arithmetic', 'Savings paying 3%, inflation at 4%.

Your balance grows. Your buying power shrinks by about 1% a year. The account statement looks like progress and isn''t.

This is why "my money is safe in the bank" is only half true — safe from loss, not safe from inflation.'),
  ('3c50a8f1-d933-4842-9055-74f607e64d6e', 3, 'Cash under a mattress is the worst case', 'Money held as cash earns 0%. So its real return is roughly minus the inflation rate, every year, guaranteed.

£100 hidden away for ten years at 3% inflation has the buying power of about £74 by the end. Nothing was stolen. It just quietly stopped being able to buy as much.

Tier 1 mentioned this in passing; this is the arithmetic underneath it.'),
  ('3c50a8f1-d933-4842-9055-74f607e64d6e', 4, 'What it means for choosing where money sits', 'Money you''ll spend soon should be somewhere safe and reachable — inflation barely touches it over a few months.

Money you won''t need for years faces a different question: whether a rate below inflation is really "no risk," given it guarantees a slow loss. That''s not an argument for anything in particular — it''s the reason the next topic exists.'),
  ('838c5943-0bf8-4982-a4c2-5a2b2ce125bb', 1, 'What you''re about to do', 'Calculations using inflation as a rate — what a price becomes over several years, what a fixed amount is really worth later, and whether a given savings rate is actually keeping up.

The one to watch: inflation compounds. Three years at 3% is not 9%.');

insert into questions (subtopic_id, tier, "order", question_type, question_text, options, correct_answer, accepted_answers, tolerance, explanation)
values
  ('bd814062-cb27-4900-947f-083459d96568', 3, 1, 'num', 'What inflation rate, as a percentage, does the UK government set as the Bank of England''s target?', '[]'::jsonb, '2', null, null, '2% CPI. Not zero — a small, predictable amount of inflation is considered healthier than none, because falling prices tend to make people delay spending, which slows the economy down.'),
  ('bd814062-cb27-4900-947f-083459d96568', 3, 2, 'mcq', 'What is the Consumer Prices Index (CPI)?', '["The price of a fixed list of essential goods","A measure built from around 180,000 prices across roughly 700 items, collected monthly","The average price increase agreed by major retailers","The Bank of England''s forecast for next year''s prices"]'::jsonb, '1', null, null, 'The Office for National Statistics collects those prices every month to build it. The basket changes over time as what people buy changes — itself a small window into how the country''s habits shift.'),
  ('bd814062-cb27-4900-947f-083459d96568', 3, 3, 'mcq', 'Why does the UK target 2% inflation rather than 0%?', '["Zero inflation is impossible to achieve","Falling or flat prices can make people delay spending, slowing the economy","It allows the government to collect more tax","Other countries target 2%, so it aids comparison"]'::jsonb, '1', null, null, 'Small, predictable inflation is considered healthier than none. If prices are expected to fall, delaying a purchase becomes rational — and if enough people delay, businesses suffer and jobs go with them.'),
  ('bd814062-cb27-4900-947f-083459d96568', 3, 4, 'mcq', 'When must the Governor of the Bank of England write to the Chancellor about inflation?', '["Every quarter, regardless of the rate","Whenever inflation rises above the 2% target","When inflation is more than 1 percentage point from target — above 3% or below 1%","Only when inflation exceeds 5%"]'::jsonb, '2', null, null, 'Useful because it tells you what officially counts as normal: anything outside 1%–3% is unusual enough to require a written explanation.'),
  ('ea95a4a0-34c2-4bb4-a1e3-aac1488ce045', 3, 1, 'mcq', 'UK inflation peaked at 11.1% in October 2022. How unusual was that?', '["Fairly common — it happens most decades","The highest in 41 years","The highest since records began","Slightly above average for the period"]'::jsonb, '1', null, null, 'A 41-year high, driven largely by energy and food prices. It fell back to around the 2% target by mid-2024 before rising again — which is the pattern worth remembering, more than any single figure.'),
  ('ea95a4a0-34c2-4bb4-a1e3-aac1488ce045', 3, 2, 'num', 'Prices rise by 3% in a year. Something that cost £400 at the start of the year costs how many pounds at the end?', '[]'::jsonb, '412', null, null, '£400 × 1.03 = £412. Same multiply-by-1-point-something shortcut as adding VAT — inflation is just a percentage increase applied to prices generally.'),
  ('ea95a4a0-34c2-4bb4-a1e3-aac1488ce045', 3, 3, 'mcq', 'Is three years of 3% inflation the same as a total increase of 9%?', '["Yes, the rates add up","No — it comes to about 9.27%, because inflation compounds","No — it comes to less than 9%","It depends which items you measure"]'::jsonb, '1', null, null, '£100 → £103 → £106.09 → £109.27. The same compounding mechanism as interest, working on prices instead of savings. Over ten years at 3%, £100 of prices becomes about £134.'),
  ('ea95a4a0-34c2-4bb4-a1e3-aac1488ce045', 3, 4, 'num', 'Using the Rule of 72, roughly how many years does it take for prices to double at 3% inflation?', '[]'::jsonb, '24', null, null, '72 ÷ 3 = 24 years. That''s why old prices sound absurd — someone describing a 20p chocolate bar isn''t describing a better world, they''re describing compounding run over decades.'),
  ('ea95a4a0-34c2-4bb4-a1e3-aac1488ce045', 3, 5, 'mcq', 'Inflation of 11.1% means a £50 weekly shop becomes roughly what a year later, for the same items?', '["£51.11","£55.55","£61.10","£56.10"]'::jsonb, '1', null, null, '£50 × 1.111 = £55.55. Nothing improved and nothing changed about the shopping — the number just got bigger. That''s the year a lot of people learned what inflation feels like rather than what it means.'),
  ('3c50a8f1-d933-4842-9055-74f607e64d6e', 3, 1, 'text', 'What''s the term for the return on savings after inflation has been accounted for?', '[]'::jsonb, 'real return', '["real return","real rate of return","real interest rate","real"]'::jsonb, null, 'The real return, as opposed to the nominal return — the number printed on your account. Roughly: real ≈ nominal − inflation.'),
  ('3c50a8f1-d933-4842-9055-74f607e64d6e', 3, 2, 'num', 'Savings pay 5% and inflation is 2%. Approximately what is the real return, as a percentage?', '[]'::jsonb, '3', null, null, 'Roughly nominal minus inflation: 5 − 2 = 3%. That''s the figure that tells you whether your buying power actually grew, which the 5% on its own doesn''t.'),
  ('3c50a8f1-d933-4842-9055-74f607e64d6e', 3, 3, 'mcq', 'Savings pay 3% while inflation runs at 4%. What''s actually happening?', '["The savings are growing in real terms, just slowly","The balance grows but buying power shrinks by about 1% a year","The balance shrinks","The two cancel out exactly"]'::jsonb, '1', null, null, 'The account statement looks like progress and isn''t. This is why "my money is safe in the bank" is only half true — safe from loss, not safe from inflation.'),
  ('3c50a8f1-d933-4842-9055-74f607e64d6e', 3, 4, 'mcq', 'Money kept as cash at home earns 0% interest. What''s its real return when inflation is 3%?', '["0% — the amount doesn''t change","About −3%, every year","It depends where the cash is kept","About +3%, since cash holds its value"]'::jsonb, '1', null, null, '£100 hidden away for ten years at 3% inflation has the buying power of about £74 by the end. Nothing was stolen — it just quietly stopped being able to buy as much.'),
  ('3c50a8f1-d933-4842-9055-74f607e64d6e', 3, 5, 'mcq', 'Given inflation, where should money you''ll need within a few months sit?', '["Somewhere with the highest possible return","Somewhere safe and reachable — inflation barely touches it over a few months","As cash, to avoid any risk at all","It doesn''t matter for short periods"]'::jsonb, '1', null, null, 'Over a few months, inflation''s effect is negligible, so accessibility and safety win. The question changes entirely for money you won''t need for years — which is exactly what the next topic is about.'),
  ('838c5943-0bf8-4982-a4c2-5a2b2ce125bb', 3, 1, 'num', 'Prices rise by 2% in a year. Something costing £500 at the start of the year costs how many pounds at the end?', '[]'::jsonb, '510', null, null, '£500 × 1.02 = £510. The same calculation as adding a percentage to any price — inflation just applies it across the economy rather than to one item.'),
  ('838c5943-0bf8-4982-a4c2-5a2b2ce125bb', 3, 2, 'mcq', 'A savings account pays 1% while inflation runs at 4%. What''s the approximate real return?', '["About +3%","About −3%","About +5%","About 0%"]'::jsonb, '1', null, null, 'Roughly 1 − 4 = −3%. The balance rises each year and buys less each year — both at the same time, which is what makes it easy to miss.'),
  ('838c5943-0bf8-4982-a4c2-5a2b2ce125bb', 3, 3, 'num', 'Using the Rule of 72, roughly how many years would it take for prices to double at 4% inflation?', '[]'::jsonb, '18', null, null, '72 ÷ 4 = 18 years. The same shortcut works for savings growth, debt growth and price rises — one rule, three uses, which is why it''s worth memorising.'),
  ('838c5943-0bf8-4982-a4c2-5a2b2ce125bb', 3, 4, 'mcq', 'Which statement about inflation is correct?', '["Three years at 3% inflation totals exactly 9%","Inflation compounds, so three years at 3% totals about 9.27%","Inflation only affects luxury goods","Cash is unaffected by inflation because the amount stays the same"]'::jsonb, '1', null, null, 'Inflation compounds exactly like interest does. D is the most common misunderstanding — the amount is unaffected, which is precisely why the loss in buying power goes unnoticed.');
