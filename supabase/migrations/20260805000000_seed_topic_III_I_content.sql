-- Real Tier 3 content for Topic III.I — Percentages in Real Life.
-- Same pattern as Tier 1/2: fixed UUIDs for topic/subtopic rows (safe to
-- re-run), slides/questions are a single-shot content load (no on-conflict
-- guard -- do not paste this file twice).

insert into topics (id, tier, "order", title, video_url)
values ('c2206268-02d7-41ea-adf1-2e39399166f6', 3, 1, 'Percentages in Real Life', null)
on conflict (id) do nothing;

insert into subtopics (id, topic_id, title, "order")
values
  ('67f27e3f-11f4-4167-af2e-b0498ef07857', 'c2206268-02d7-41ea-adf1-2e39399166f6', 'What a Percentage Actually Means', 1),
  ('2c033380-1aad-425c-a3aa-109c8e056653', 'c2206268-02d7-41ea-adf1-2e39399166f6', 'Discounts and Sales', 2),
  ('f455667d-7d6c-43e1-8426-c6e1bd6b87fd', 'c2206268-02d7-41ea-adf1-2e39399166f6', 'Tax and Tips', 3),
  ('73a7725c-83e2-4063-9e7a-badbe02fe4cb', 'c2206268-02d7-41ea-adf1-2e39399166f6', 'Practice: Calculate It Yourself', 4)
on conflict (id) do nothing;

insert into slides (subtopic_id, "order", heading, body)
values
  ('67f27e3f-11f4-4167-af2e-b0498ef07857', 1, 'The word tells you the answer', 'Per cent means per hundred. That''s the whole definition.

25% is 25 out of every 100. Which also means it''s the fraction 25/100, and the decimal 0.25. Three ways of writing the same thing, and being able to move between them is most of what percentage questions actually test.'),
  ('67f27e3f-11f4-4167-af2e-b0498ef07857', 2, 'Finding a percentage of something', 'To find X% of a number: divide by 100, then multiply.

15% of £40 → 40 ÷ 100 = 0.4, then 0.4 × 15 = £6.

That works every time, but there''s a faster route worth knowing for anything you''re doing in your head.'),
  ('67f27e3f-11f4-4167-af2e-b0498ef07857', 3, 'Build from 10%', '10% is just dividing by 10, which you can do instantly. Everything else is built from it:

10% of £40 = £4
5% is half of 10% = £2
20% is 10% doubled = £8
15% is 10% + 5% = £6

Same answer as the formula, no calculator. This is how most people who are quick with percentages are actually doing it.'),
  ('67f27e3f-11f4-4167-af2e-b0498ef07857', 4, 'Percentages are always of something', '"20% off" means nothing on its own. 20% of £5 is £1. 20% of £500 is £100.

That sounds obvious written down, and it''s the single most common place people go wrong — particularly when two percentages in the same conversation are percentages of different amounts. Always ask: per cent of what?'),
  ('2c033380-1aad-425c-a3aa-109c8e056653', 1, 'Two routes to the same answer', 'An item is £60 with 30% off.

Route 1: find the discount, then subtract. 30% of £60 = £18. £60 − £18 = £42.

Route 2: find what you actually pay. If 30% comes off, you pay 70%. 70% of £60 = £42.'),
  ('2c033380-1aad-425c-a3aa-109c8e056653', 2, 'Route 2 is better', 'Same answer, but one step instead of two — and one step means one chance to make a mistake instead of two.

It also matches what you actually want to know. You don''t care what the discount is; you care what you''re paying. Working out the number you''ll hand over is more direct than working out the number you won''t.'),
  ('2c033380-1aad-425c-a3aa-109c8e056653', 3, 'Discounts don''t stack the way they look', 'A £100 item, 20% off, then a further 10% off. That''s not 30% off.

After 20% off: £100 → £80
10% off that: £80 − £8 = £72
But 30% off £100 would be £70

The second discount applies to the reduced price, not the original — so you pay £2 more than "30% off" would suggest. Same trap, bigger numbers, whenever you see discounts advertised as adding up.'),
  ('2c033380-1aad-425c-a3aa-109c8e056653', 4, 'Working backwards', 'You paid £42 after a 30% discount. What was the original price?

You paid 70%, so £42 is 70% of the original. Divide by 70 to get 1%: £42 ÷ 70 = £0.60. Multiply by 100: £60.

Worth being able to do, because it''s how you check whether a "was" price is real — which Tier 2 spent a whole topic on.'),
  ('f455667d-7d6c-43e1-8426-c6e1bd6b87fd', 1, 'VAT, and where it already is', 'VAT is a tax added to most things you buy. In the UK the standard rate is 20%, and it''s been 20% since 2011.

Here''s the part that saves confusion: prices displayed to consumers in UK shops already include it. The £12 on the shelf is £12 at the till. You''re paying VAT, but you''re not adding it — that''s mostly a business calculation.'),
  ('f455667d-7d6c-43e1-8426-c6e1bd6b87fd', 2, 'Adding a percentage', 'To add 20% to £50: find 20% (£10), then add it. £50 + £10 = £60.

The shortcut: multiplying by 1.2 does both steps at once. £50 × 1.2 = £60. The 1 keeps the original, the 0.2 adds the 20%.'),
  ('f455667d-7d6c-43e1-8426-c6e1bd6b87fd', 3, 'The mistake almost everyone makes going backwards', 'A price is £60 including 20% VAT. What was it before VAT?

The instinct is to take 20% off £60, giving £48. That''s wrong.

£60 is 120% of the original price, so you divide by 1.2: £60 ÷ 1.2 = £50.

Check it forwards: £50 + 20% = £60. ✓ Whereas £48 + 20% = £57.60, which isn''t where you started.

Adding a percentage and removing it are not opposite operations — that''s the trap.'),
  ('f455667d-7d6c-43e1-8426-c6e1bd6b87fd', 4, 'Tips and service charges', 'Common rates are 10% or 12.5%, sometimes added automatically as a "service charge."

12.5% of a £48 bill, using the 10% trick:
10% = £4.80
2.5% is a quarter of 10% = £1.20
Total = £6

Worth checking whether a service charge has already been added before you tip on top — paying it twice is common and entirely avoidable.'),
  ('73a7725c-83e2-4063-9e7a-badbe02fe4cb', 1, 'What you''re about to do', 'Real percentage calculations — discounts, working backwards from a sale price, adding and removing VAT, and a tip or two.

The two things worth watching for: stacked discounts don''t add up, and removing a percentage isn''t the reverse of adding one. Both appear in what follows.');

insert into questions (subtopic_id, tier, "order", question_type, question_text, options, correct_answer, accepted_answers, tolerance, explanation)
values
  ('67f27e3f-11f4-4167-af2e-b0498ef07857', 3, 1, 'text', 'What does the word "per cent" literally mean?', '[]'::jsonb, 'per hundred', '["per hundred","out of a hundred","out of 100","per 100"]'::jsonb, null, 'Per hundred. That''s the entire definition — 25% is 25 out of every 100, which is also the fraction 25/100 and the decimal 0.25. Three ways of writing the same thing.'),
  ('67f27e3f-11f4-4167-af2e-b0498ef07857', 3, 2, 'num', 'What is 30% of £70? Give your answer in pounds.', '[]'::jsonb, '21', null, null, '£70 ÷ 100 = £0.70, × 30 = £21. Or faster: 10% is £7, so 30% is £21. Building from 10% is how most people who are quick at this actually do it.'),
  ('67f27e3f-11f4-4167-af2e-b0498ef07857', 3, 3, 'mcq', 'Which of these is 25% written as a decimal?', '["25.0","2.5","0.25","0.025"]'::jsonb, '2', null, null, 'Per cent means per hundred, so 25% is 25 ÷ 100 = 0.25. D is the most common slip — that''s 2.5%, ten times smaller.'),
  ('67f27e3f-11f4-4167-af2e-b0498ef07857', 3, 4, 'mcq', 'Why does "20% off" tell you nothing on its own?', '["The discount might not apply to every item","A percentage is always a percentage of something","Shops often exaggerate discounts","It depends on how long the sale lasts"]'::jsonb, '1', null, null, '20% of £5 is £1. 20% of £500 is £100. Same percentage, completely different amount — which is why "per cent of what?" is the first question to ask, especially when two percentages in one conversation refer to different amounts.'),
  ('2c033380-1aad-425c-a3aa-109c8e056653', 3, 1, 'num', 'An item costs £80 with 25% off. How many pounds do you actually pay?', '[]'::jsonb, '60', null, null, 'If 25% comes off, you pay 75%. £80 × 0.75 = £60. Going straight to what you pay is one step instead of two — and one chance to make a mistake instead of two.'),
  ('2c033380-1aad-425c-a3aa-109c8e056653', 3, 2, 'mcq', 'An item is £40 with 30% off. Which approach is less error-prone?', '["Work out 30% of £40, then subtract it","Work out 70% of £40 directly","They''re identical in difficulty","Divide £40 by 30"]'::jsonb, '1', null, null, 'Both give £28, but B is one step rather than two — and it answers what you actually want to know. You don''t care what the discount is; you care what you''re handing over.'),
  ('2c033380-1aad-425c-a3aa-109c8e056653', 3, 3, 'num', 'An item costs £200. It has 20% off, then a further 10% off the reduced price. How many pounds do you pay?', '[]'::jsonb, '144', null, null, '£200 × 0.8 = £160, then £160 × 0.9 = £144. The second discount applies to the reduced price, not the original.'),
  ('2c033380-1aad-425c-a3aa-109c8e056653', 3, 4, 'mcq', 'An item costs £200. "20% off, then a further 10% off" — is that the same as 30% off?', '["Yes, the discounts add together","No — it comes to £144, whereas 30% off would be £140","No — it comes to £140, whereas 30% off would be £144","It depends on the order the discounts are applied"]'::jsonb, '1', null, null, 'Stacked discounts always come out slightly worse than the sum suggests, because the second one applies to an already-reduced price. D is a good instinct but wrong here — 20% then 10% and 10% then 20% both give £144.'),
  ('2c033380-1aad-425c-a3aa-109c8e056653', 3, 5, 'num', 'You paid £36 for an item after a 40% discount. What was the original price in pounds?', '[]'::jsonb, '60', null, null, 'You paid 60% of the original, so £36 ÷ 0.6 = £60. Check it forwards: 40% of £60 is £24, and £60 − £24 = £36. ✓ This is exactly how you test whether a "was" price is real.'),
  ('f455667d-7d6c-43e1-8426-c6e1bd6b87fd', 3, 1, 'num', 'A business adds 20% VAT to a £45 price. What is the total in pounds?', '[]'::jsonb, '54', null, null, '£45 × 1.2 = £54. Multiplying by 1.2 does both steps at once — the 1 keeps the original, the 0.2 adds the 20%.'),
  ('f455667d-7d6c-43e1-8426-c6e1bd6b87fd', 3, 2, 'num', 'A price is £90 including 20% VAT. What was the price before VAT was added, in pounds?', '[]'::jsonb, '75', null, null, '£90 is 120% of the original, so divide by 1.2: £90 ÷ 1.2 = £75. Check forwards: £75 × 1.2 = £90. ✓'),
  ('f455667d-7d6c-43e1-8426-c6e1bd6b87fd', 3, 3, 'mcq', 'A price is £90 including 20% VAT. Someone works out the pre-VAT price by taking 20% off £90, getting £72. Why is that wrong?', '["VAT is charged at a different rate on some items","£90 is 120% of the original, so you divide by 1.2 rather than subtracting 20%","VAT should be taken off before the discount","It isn''t wrong — £72 is correct"]'::jsonb, '1', null, null, 'Adding a percentage and removing it are not opposite operations. Check the wrong answer forwards: £72 × 1.2 = £86.40, which isn''t £90. The right answer is £90 ÷ 1.2 = £75, and £75 × 1.2 = £90. ✓'),
  ('f455667d-7d6c-43e1-8426-c6e1bd6b87fd', 3, 4, 'num', 'A restaurant bill is £64 and a 12.5% service charge is added. How many pounds is the service charge?', '[]'::jsonb, '8', null, null, '10% of £64 is £6.40, and 2.5% is a quarter of that, £1.60. £6.40 + £1.60 = £8. Building from 10% handles awkward percentages without a calculator.'),
  ('f455667d-7d6c-43e1-8426-c6e1bd6b87fd', 3, 5, 'mcq', 'In UK shops, the price displayed on the shelf usually already includes VAT.', '["True","False"]'::jsonb, '0', null, null, 'The £12 on the shelf is £12 at the till. You''re paying VAT, but you''re not adding it — that''s mostly a business calculation. The UK standard rate has been 20% since 2011.'),
  ('73a7725c-83e2-4063-9e7a-badbe02fe4cb', 3, 1, 'num', 'An item costs £150 with 30% off. How many pounds do you pay?', '[]'::jsonb, '105', null, null, '£150 × 0.7 = £105. Going straight to the 70% you''ll pay beats working out the 30% you won''t.'),
  ('73a7725c-83e2-4063-9e7a-badbe02fe4cb', 3, 2, 'num', 'You paid £51 for an item after a 15% discount. What was the original price in pounds?', '[]'::jsonb, '60', null, null, 'You paid 85%, so £51 ÷ 0.85 = £60. Check: 15% of £60 is £9, and £60 − £9 = £51. ✓'),
  ('73a7725c-83e2-4063-9e7a-badbe02fe4cb', 3, 3, 'num', 'An item costs £250. It has 10% off, then a further 20% off the reduced price. How many pounds do you pay?', '[]'::jsonb, '180', null, null, '£250 × 0.9 = £225, then £225 × 0.8 = £180. Note that 30% off £250 would be £175 — stacked discounts land above the sum, not at it.'),
  ('73a7725c-83e2-4063-9e7a-badbe02fe4cb', 3, 4, 'multi', 'Which of these statements about percentages are correct?', '["20% off followed by 10% off is the same as 30% off","To remove 20% VAT from a total, divide by 1.2","15% of a number is 10% of it plus half of that","A percentage always needs an amount to be a percentage of"]'::jsonb, '[1,2,3]', null, null, 'B, C and D. A is the stacking trap — the second discount applies to a reduced price, so the total is always slightly less generous than adding the percentages suggests.');
