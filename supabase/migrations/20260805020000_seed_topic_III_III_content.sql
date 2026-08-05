-- Real Tier 3 content for Topic III.III — Compound Interest, Intuitively.
-- Same pattern as Tier 1/2: fixed UUIDs for topic/subtopic rows (safe to
-- re-run), slides/questions are a single-shot content load (no on-conflict
-- guard -- do not paste this file twice).

insert into topics (id, tier, "order", title, video_url)
values ('c3de9a1c-2afd-4e36-8889-32f748272412', 3, 3, 'Compound Interest, Intuitively', null)
on conflict (id) do nothing;

insert into subtopics (id, topic_id, title, "order")
values
  ('2adb36e5-79e1-4c16-a4db-ac73a2bab23e', 'c3de9a1c-2afd-4e36-8889-32f748272412', 'The Penny Doubled Every Day', 1),
  ('453f0c49-f76b-484f-81e9-3b798d263cd6', 'c3de9a1c-2afd-4e36-8889-32f748272412', 'Why Compound Beats Simple', 2),
  ('c200ec6a-c7ac-4574-bc89-58a2757dfb55', 'c3de9a1c-2afd-4e36-8889-32f748272412', 'Compound Interest in Saving', 3),
  ('cc207238-cce2-4db6-82f8-7a1140526fcd', 'c3de9a1c-2afd-4e36-8889-32f748272412', 'Compound Interest in Debt', 4)
on conflict (id) do nothing;

insert into slides (subtopic_id, "order", heading, body)
values
  ('2adb36e5-79e1-4c16-a4db-ac73a2bab23e', 1, 'The offer', 'Two options for a month:

A — £1,000,000 today.
B — 1p today, doubling every day for 30 days.

Most people take A. Watch what B actually does.'),
  ('2adb36e5-79e1-4c16-a4db-ac73a2bab23e', 2, 'Day by day', 'Day 1: 1p
Day 10: £5.12
Day 20: £5,242.88
Day 30: £5,368,709.12

Over five million pounds, from a single penny.'),
  ('2adb36e5-79e1-4c16-a4db-ac73a2bab23e', 3, 'Look at where the growth happens', 'After ten days you have five pounds. After twenty, five thousand. The first two-thirds of the month produce almost nothing worth having.

Then day 29 alone adds more than every previous day combined — because it doubles a number that''s already enormous.

That shape is the entire lesson: flat, flat, flat, vertical. People give up during the flat part, which is exactly when it looks like it isn''t working.'),
  ('2adb36e5-79e1-4c16-a4db-ac73a2bab23e', 4, 'Compare it to adding a penny', 'If instead you got 1p added every day rather than doubled, thirty days would give you 30p.

Same starting amount, same time. 30p against £5.3 million. The difference between adding and multiplying, run thirty times.'),
  ('453f0c49-f76b-484f-81e9-3b798d263cd6', 1, 'One word of difference', 'Simple interest — calculated on the original amount only.
Compound interest — calculated on the original amount plus all the interest already earned.

Compounding means your interest earns interest. That''s the whole mechanism.'),
  ('453f0c49-f76b-484f-81e9-3b798d263cd6', 2, 'Three years, side by side', '£1,000 at 5%:

Simple — £50 each year. After 3 years: £1,150

Compound
Year 1: £1,000 × 1.05 = £1,050
Year 2: £1,050 × 1.05 = £1,102.50
Year 3: £1,102.50 × 1.05 = £1,157.63

A difference of £7.63. Underwhelming — which is exactly why people dismiss it.'),
  ('453f0c49-f76b-484f-81e9-3b798d263cd6', 3, 'Thirty years, side by side', 'Same £1,000, same 5%:

Simple: £1,000 + (£50 × 30) = £2,500
Compound: £1,000 × 1.05³⁰ = £4,321.94

The compound version is worth £1,821.94 more. The gap didn''t grow steadily — it grew the way the penny grew, slowly and then not slowly.'),
  ('453f0c49-f76b-484f-81e9-3b798d263cd6', 4, 'The Rule of 72', 'A shortcut for how long money takes to double: divide 72 by the interest rate.

At 6%: 72 ÷ 6 = 12 years
At 8%: 72 ÷ 8 = 9 years
At 2%: 72 ÷ 2 = 36 years

It''s an approximation, not exact, but it''s close enough to be genuinely useful in your head — and it makes the cost of a low rate immediately visible.'),
  ('c200ec6a-c7ac-4574-bc89-58a2757dfb55', 1, 'Time does more work than money', 'Two people each save £1,000 once and never touch it, both earning 5%:

Started at 15, left for 50 years → about £11,467
Started at 35, left for 30 years → about £4,322

Same amount saved. Same rate. The twenty extra years produced roughly two and a half times the result.'),
  ('c200ec6a-c7ac-4574-bc89-58a2757dfb55', 2, 'Which is why age is the advantage', 'You have more of the ingredient that matters most, and it''s the one that can''t be bought back later.

An adult who starts at 35 can compensate with more money. They can''t compensate with more time. That''s not a reason to feel pressure at 14 or any age — it''s a reason to know that a small amount started now isn''t trivial.'),
  ('c200ec6a-c7ac-4574-bc89-58a2757dfb55', 3, 'What the rate actually changes', '£1,000 left for 30 years:

At 2%: about £1,811
At 5%: about £4,322
At 8%: about £10,063

A rate four times higher produced a result more than five times bigger — because the rate compounds too. Small differences in rate are not small differences in outcome.'),
  ('c200ec6a-c7ac-4574-bc89-58a2757dfb55', 4, 'Frequency matters as well', 'Interest can be added yearly, monthly, or daily. More often means slightly more growth, because the interest starts earning sooner.

The effect is real but modest compared to time and rate — worth knowing about, not worth agonising over. (Mastery covers the formula that handles this properly.)'),
  ('cc207238-cce2-4db6-82f8-7a1140526fcd', 1, 'The same mechanism, aimed at you', 'Everything that makes compounding powerful for savings makes it dangerous for debt. Unpaid interest gets added to what you owe, and then that gets charged interest.

The debt grows on its own, without you spending anything more.'),
  ('cc207238-cce2-4db6-82f8-7a1140526fcd', 2, 'The asymmetry that catches people', 'Savings rates are typically low single figures. Credit card rates are frequently in the twenties.

At 5%, money takes about 14 years to double. At 24%, it takes about 3. Compounding takes decades to make you rich and months to make you stuck — not because the maths is different, but because the rates are.'),
  ('cc207238-cce2-4db6-82f8-7a1140526fcd', 3, 'Why minimum payments are designed the way they are', 'A minimum payment is usually set just above the interest charged that month.

Pay only that, and the balance barely moves while the interest keeps being charged on almost the full amount. The debt can survive for years on minimum payments alone — which is a feature of the product, not an accident.'),
  ('cc207238-cce2-4db6-82f8-7a1140526fcd', 4, 'What this means in practice', 'Paying more than the minimum, even slightly, changes the outcome dramatically — because every extra pound reduces the balance that all future interest is calculated from.

That''s the practical takeaway from this entire topic: with compounding, when you act matters as much as how much you act.');

insert into questions (subtopic_id, tier, "order", question_type, question_text, options, correct_answer, accepted_answers, tolerance, explanation)
values
  ('2adb36e5-79e1-4c16-a4db-ac73a2bab23e', 3, 1, 'mcq', 'Two options: £1,000,000 today, or 1p today doubling every day for 30 days. Which ends up larger?', '["The £1,000,000","The doubling penny, by a wide margin","They''re roughly equal","It depends on the interest rate"]'::jsonb, '1', null, null, 'The penny reaches £5,368,709.12 by day 30 — over five times the million. Almost everyone picks the million, which is exactly what makes it a useful demonstration.'),
  ('2adb36e5-79e1-4c16-a4db-ac73a2bab23e', 3, 2, 'mcq', 'In the doubling-penny example, after 20 days the total is £5,242.88. Where does almost all the growth happen?', '["Evenly across the 30 days","In the first few days, then it slows","In the final few days","It''s impossible to predict"]'::jsonb, '2', null, null, 'Day 29 alone adds more than every previous day combined, because it doubles a number that''s already enormous. The shape is flat, flat, flat, then vertical — and people give up during the flat part, which is exactly when it looks like it isn''t working.'),
  ('2adb36e5-79e1-4c16-a4db-ac73a2bab23e', 3, 3, 'num', 'If you received 1p added every day for 30 days, rather than doubled, how many pence would you have at the end?', '[]'::jsonb, '30', null, null, '30p, against £5,368,709.12 for the doubling version. Same starting amount, same time — the entire difference is adding versus multiplying, run thirty times.'),
  ('2adb36e5-79e1-4c16-a4db-ac73a2bab23e', 3, 4, 'mcq', 'What''s the practical lesson of the doubling-penny example?', '["Small amounts of money are worthless","Growth that multiplies looks like nothing for a long time, then becomes sudden","You should always take the larger amount up front","Doubling is unrealistic in real finance"]'::jsonb, '1', null, null, 'The rates are unrealistic; the shape isn''t. Real compounding follows the same curve, just stretched over years instead of days — which is why the flat early period is the part that puts people off.'),
  ('453f0c49-f76b-484f-81e9-3b798d263cd6', 3, 1, 'mcq', 'What''s the difference between simple and compound interest?', '["Compound interest uses a higher rate","Compound interest is calculated on the original amount plus interest already earned","Simple interest is only used for savings","Compound interest is added more frequently"]'::jsonb, '1', null, null, 'Your interest earns interest — that''s the entire mechanism. D describes compounding frequency, which is a separate detail; even yearly compounding still compounds.'),
  ('453f0c49-f76b-484f-81e9-3b798d263cd6', 3, 2, 'num', 'You invest £2,000 at 10% compound interest for 2 years. How many pounds do you have at the end?', '[]'::jsonb, '2420', null, null, 'Year 1: £2,000 × 1.1 = £2,200. Year 2: £2,200 × 1.1 = £2,420. Simple interest would have given £2,400 — the extra £20 is interest earned on year one''s interest.'),
  ('453f0c49-f76b-484f-81e9-3b798d263cd6', 3, 3, 'num', 'Using the Rule of 72, roughly how many years does money take to double at 9% interest?', '[]'::jsonb, '8', null, null, '72 ÷ 9 = 8 years. It''s an approximation rather than exact, but it''s close enough to be genuinely useful in your head — and it makes the cost of a low rate immediately visible.'),
  ('453f0c49-f76b-484f-81e9-3b798d263cd6', 3, 4, 'mcq', 'Over 3 years, £1,000 at 5% earns £1,150 with simple interest and £1,157.63 with compound — a difference of under £8. Why is this still worth knowing?', '["The difference is larger with bigger sums","The gap widens dramatically over longer periods","Compound interest is more common","Banks are required to use compound interest"]'::jsonb, '1', null, null, 'Over 30 years the same £1,000 at 5% gives £2,500 simple against £4,321.94 compound — a gap of over £1,800. The small early difference is exactly why people dismiss compounding, and exactly why they shouldn''t.'),
  ('453f0c49-f76b-484f-81e9-3b798d263cd6', 3, 5, 'mcq', 'What does the Rule of 72 estimate?', '["The interest rate needed to double your money in a year","How many years money takes to double at a given rate","The percentage of interest lost to inflation","The maximum safe interest rate on a loan"]'::jsonb, '1', null, null, 'Divide 72 by the rate. At 6% it''s 12 years; at 2% it''s 36. It works in both directions too — the same rule tells you how fast a debt doubles.'),
  ('c200ec6a-c7ac-4574-bc89-58a2757dfb55', 3, 1, 'mcq', 'Two people each save £1,000 once at 5% and never touch it. One starts at 15 and leaves it 50 years; the other starts at 35 and leaves it 30 years. What''s the outcome?', '["Roughly the same, since the amount and rate match","The earlier starter ends with about £11,467 against about £4,322","The earlier starter ends with about 20% more","The later starter does better by adding more later"]'::jsonb, '1', null, null, 'Same amount, same rate — the twenty extra years produced roughly two and a half times the result. Time is doing more work here than money.'),
  ('c200ec6a-c7ac-4574-bc89-58a2757dfb55', 3, 2, 'num', 'Using the Rule of 72, roughly how many years does money take to double at 6% interest?', '[]'::jsonb, '12', null, null, '72 ÷ 6 = 12 years. Worth comparing against 2%, where it''s 36 years — a rate three times higher doesn''t triple your speed, it cuts the doubling time to a third.'),
  ('c200ec6a-c7ac-4574-bc89-58a2757dfb55', 3, 3, 'mcq', '£1,000 left for 30 years gives about £1,811 at 2%, and about £10,063 at 8%. Why is the 8% result more than four times bigger, when the rate is only four times higher?', '["Higher rates are usually paid on larger balances","The rate compounds too, so the effect multiplies rather than adds","The 2% figure includes fees","It''s a rounding artefact over long periods"]'::jsonb, '1', null, null, 'Each year''s growth is calculated from a balance that grew faster last year, so a higher rate accelerates itself. Small differences in rate are not small differences in outcome.'),
  ('c200ec6a-c7ac-4574-bc89-58a2757dfb55', 3, 4, 'mcq', 'Interest can be added yearly, monthly or daily. What difference does frequency make?', '["None — the annual rate is what matters","Slightly more growth when added more often, since interest starts earning sooner","Substantially more growth, comparable to doubling the rate","Less growth, because of rounding"]'::jsonb, '1', null, null, 'Real but modest, especially compared to time and rate. Worth knowing about rather than agonising over — Mastery covers the formula that handles it precisely.'),
  ('c200ec6a-c7ac-4574-bc89-58a2757dfb55', 3, 5, 'mcq', 'Saving a small amount when you''re young is essentially pointless, because the amount is too small to matter.', '["True","False"]'::jsonb, '1', null, null, '£1,000 at 5% left for 50 years becomes about £11,467; left for 30 years it''s about £4,322. The amount is the same — time did the rest. That''s the one ingredient you have more of than any adult, and it can''t be bought back later.'),
  ('cc207238-cce2-4db6-82f8-7a1140526fcd', 3, 1, 'mcq', 'Why is compounding dangerous when it applies to debt rather than savings?', '["Debt interest rates are calculated differently","Unpaid interest is added to the balance, and then charged interest itself","Lenders can change the rate without notice","Debts have no time limit"]'::jsonb, '1', null, null, 'The debt grows on its own without you spending anything more. Same mechanism as savings, pointed the other way — which is why it''s worth understanding both sides.'),
  ('cc207238-cce2-4db6-82f8-7a1140526fcd', 3, 2, 'num', 'Using the Rule of 72, roughly how many years does a debt take to double at a 24% interest rate?', '[]'::jsonb, '3', null, null, '72 ÷ 24 = 3 years. Compare that with a savings rate of 5%, where doubling takes about 14 years. Compounding takes decades to make you rich and a few years to make you stuck — the maths is identical, the rates aren''t.'),
  ('cc207238-cce2-4db6-82f8-7a1140526fcd', 3, 3, 'mcq', 'Why does paying only the minimum on a credit card keep the debt alive for years?', '["Minimum payments are applied to fees first","The minimum is usually set just above the monthly interest, so the balance barely falls","Interest is charged twice on minimum payments","Card companies add a fee for paying the minimum"]'::jsonb, '1', null, null, 'Almost all of the payment goes on interest, leaving the balance nearly untouched — and next month''s interest is charged on almost the same amount again. That''s a feature of the product, not an accident.'),
  ('cc207238-cce2-4db6-82f8-7a1140526fcd', 3, 4, 'mcq', 'Why does paying slightly more than the minimum have a disproportionate effect?', '["Lenders reduce the rate for customers who overpay","Every extra pound reduces the balance all future interest is calculated from","It improves your credit score, lowering future rates","Overpayments are exempt from interest"]'::jsonb, '1', null, null, 'You''re not just paying off a pound — you''re removing that pound from every future interest calculation. With compounding, when you act matters as much as how much you act.');
