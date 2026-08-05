-- Real Tier 3 content for Topic III.II — Simple Interest.
-- Same pattern as Tier 1/2: fixed UUIDs for topic/subtopic rows (safe to
-- re-run), slides/questions are a single-shot content load (no on-conflict
-- guard -- do not paste this file twice).

insert into topics (id, tier, "order", title, video_url)
values ('fc7840e9-d50d-441c-8ba9-022b7efafa86', 3, 2, 'Simple Interest', null)
on conflict (id) do nothing;

insert into subtopics (id, topic_id, title, "order")
values
  ('a71dbe8a-ee4e-479e-8ed4-caf3b0cf5dfc', 'fc7840e9-d50d-441c-8ba9-022b7efafa86', 'What Interest Actually Is', 1),
  ('d710af1a-4aa7-4b8f-8f8b-91f93504233e', 'fc7840e9-d50d-441c-8ba9-022b7efafa86', 'Simple Interest When You Save', 2),
  ('a68b84fa-dd87-4ad3-923e-6eaeeda185ff', 'fc7840e9-d50d-441c-8ba9-022b7efafa86', 'Simple Interest When You Borrow', 3),
  ('0bc5a755-a0a5-4378-bdf1-767aff7451b1', 'fc7840e9-d50d-441c-8ba9-022b7efafa86', 'Practice: Work Out Real Numbers', 4)
on conflict (id) do nothing;

insert into slides (subtopic_id, "order", heading, body)
values
  ('a71dbe8a-ee4e-479e-8ed4-caf3b0cf5dfc', 1, 'The price of using someone else''s money', 'That''s the whole idea, and it works in both directions.

Saving: you leave money with a bank. They use it, and pay you for the privilege.
Borrowing: you use their money. You pay them for the privilege.

Same concept, opposite sides of the table.'),
  ('a71dbe8a-ee4e-479e-8ed4-caf3b0cf5dfc', 2, 'The rate is a percentage per period', 'An interest rate is written as a percentage — 4%, 22% — and it applies over a period of time.

Unless it says otherwise, that period is one year. This matters more than it sounds: "2% per month" and "2% per year" look almost identical written down and are wildly different in practice.'),
  ('a71dbe8a-ee4e-479e-8ed4-caf3b0cf5dfc', 3, 'Two words worth knowing', 'Principal — the original amount, before any interest.
Simple interest — interest calculated only on the principal, no matter how long it runs.

That second definition is doing quiet work. It means the interest is the same every single year, because the amount it''s calculated from never changes.'),
  ('a71dbe8a-ee4e-479e-8ed4-caf3b0cf5dfc', 4, 'Why anyone lends at all', 'A bank paying you 3% on savings is lending that money out at more than 3%. The gap is their business.

Tier 1 covered this from the banking side; here it''s the arithmetic underneath it. You''re being paid for waiting, and the borrower is paying for not waiting.'),
  ('d710af1a-4aa7-4b8f-8f8b-91f93504233e', 1, 'The formula', 'Interest = Principal × Rate × Time

Rate as a decimal, time in years. That''s it — three numbers multiplied together.'),
  ('d710af1a-4aa7-4b8f-8f8b-91f93504233e', 2, 'Worked example', '£200 saved at 4% simple interest for 3 years.

One year''s interest: 4% of £200 = £8
Three years: £8 × 3 = £24
Total after 3 years: £200 + £24 = £224

Notice each year earns exactly £8. The £8 from year one doesn''t itself earn anything in year two — that''s what makes it simple.'),
  ('d710af1a-4aa7-4b8f-8f8b-91f93504233e', 3, 'It grows in a straight line', 'Plot simple interest over time and you get a straight line. Year 5 has exactly five times the interest of year 1, always.

Hold onto that, because the next topic is about what happens when the line stops being straight — and the difference turns out to be enormous.'),
  ('d710af1a-4aa7-4b8f-8f8b-91f93504233e', 4, 'Simple interest is rarer than you''d think', 'Most real savings accounts and most real debts compound rather than staying simple.

Simple interest is worth learning anyway for two reasons: some products genuinely use it, and you can''t see what''s remarkable about compounding until you know what it''s being compared against.'),
  ('a68b84fa-dd87-4ad3-923e-6eaeeda185ff', 1, 'Same maths, pointing the other way', 'Borrow £300 at 8% simple interest for 2 years.

One year: 8% of £300 = £24
Two years: £48
Total repaid: £300 + £48 = £348

Identical calculation to saving. The only difference is which direction the money moves.'),
  ('a68b84fa-dd87-4ad3-923e-6eaeeda185ff', 2, 'The number that matters is the total', '£48 is the cost of borrowing — what the loan charged you for existing.

That''s the figure to compare between options, not the rate on its own. A lower rate over a longer time can easily cost more than a higher rate over a shorter one, and the only way to see that is to work out both totals.'),
  ('a68b84fa-dd87-4ad3-923e-6eaeeda185ff', 3, 'APR, and why it exists', 'APR stands for Annual Percentage Rate. It''s a standardised figure that folds in interest and compulsory fees, expressed as a yearly percentage.

The point is comparison. Two lenders can describe the same loan in flattering but incompatible ways; APR forces them onto one scale. It''s the number to look for, and lenders are generally required to show it.'),
  ('a68b84fa-dd87-4ad3-923e-6eaeeda185ff', 4, 'Longer isn''t cheaper, it just feels cheaper', 'Stretching a loan over more time lowers each payment and raises the total.

That''s the same framing effect Tier 2 covered in Buy Now Pay Later — a smaller number in front of you, a bigger number overall. The arithmetic here is what lets you actually see it rather than just suspect it.'),
  ('0bc5a755-a0a5-4378-bdf1-767aff7451b1', 1, 'What you''re about to do', 'Simple interest calculations in both directions — saving and borrowing — plus working out the total cost of a loan rather than just its rate.

One thing to carry in: the rate is per year unless it says otherwise.');

insert into questions (subtopic_id, tier, "order", question_type, question_text, options, correct_answer, accepted_answers, tolerance, explanation)
values
  ('a71dbe8a-ee4e-479e-8ed4-caf3b0cf5dfc', 3, 1, 'text', 'What''s the term for the original amount of money, before any interest is added?', '[]'::jsonb, 'principal', '["principal","the principal"]'::jsonb, null, 'The principal. With simple interest, it''s the only figure the interest is ever calculated from — which is exactly what makes it simple.'),
  ('a71dbe8a-ee4e-479e-8ed4-caf3b0cf5dfc', 3, 2, 'mcq', 'What is simple interest calculated on?', '["The original amount plus interest already earned","The original amount only","The average balance over the period","Whatever the balance is at the end"]'::jsonb, '1', null, null, 'Only the principal, no matter how long it runs. That''s why the interest is identical every year — the amount it''s calculated from never changes. A describes compound interest, which is the next topic.'),
  ('a71dbe8a-ee4e-479e-8ed4-caf3b0cf5dfc', 3, 3, 'mcq', 'An account advertises "4% interest" with no time period mentioned. What should you assume?', '["4% per month","4% per year","4% over the whole term","It''s impossible to know"]'::jsonb, '1', null, null, 'Per year, unless stated otherwise. This matters more than it looks — "2% per month" and "2% per year" look nearly identical written down and are wildly different in practice.'),
  ('a71dbe8a-ee4e-479e-8ed4-caf3b0cf5dfc', 3, 4, 'mcq', 'Why does a bank pay you interest on savings?', '["It''s a legal requirement","They lend your money out at a higher rate and keep the difference","To compensate for inflation","To encourage you to use their other products"]'::jsonb, '1', null, null, 'That gap is their business. You''re being paid for waiting; the borrower is paying for not waiting. C is a real effect but not the reason — a savings rate below inflation still gets paid.'),
  ('d710af1a-4aa7-4b8f-8f8b-91f93504233e', 3, 1, 'num', 'You save £500 at 3% simple interest for 4 years. How many pounds of interest do you earn in total?', '[]'::jsonb, '60', null, null, '3% of £500 = £15 each year, × 4 = £60. Each year earns exactly the same, because the £15 from year one never itself earns anything.'),
  ('d710af1a-4aa7-4b8f-8f8b-91f93504233e', 3, 2, 'num', 'You save £500 at 3% simple interest for 4 years. How many pounds do you have in total at the end?', '[]'::jsonb, '560', null, null, '£500 principal + £60 interest = £560. Worth separating the two figures in your head — the interest earned and the total balance answer different questions.'),
  ('d710af1a-4aa7-4b8f-8f8b-91f93504233e', 3, 3, 'mcq', 'What is the formula for simple interest?', '["Principal × Rate","Principal × Rate × Time","Principal × (1 + Rate)","Principal ÷ Rate × Time"]'::jsonb, '1', null, null, 'Three numbers multiplied together, with the rate as a decimal and time in years. C is the compound formula for a single period, which is a useful contrast to notice.'),
  ('d710af1a-4aa7-4b8f-8f8b-91f93504233e', 3, 4, 'mcq', 'With simple interest, why does each year earn exactly the same amount?', '["The interest rate is fixed by law","The interest is always calculated from the original amount","Banks round the interest each year","The balance doesn''t actually change"]'::jsonb, '1', null, null, 'The principal never changes, so the calculation produces the same figure every time. D is close but wrong — the balance does grow, the interest just isn''t calculated from the grown balance.'),
  ('d710af1a-4aa7-4b8f-8f8b-91f93504233e', 3, 5, 'mcq', 'Plotted on a graph over time, simple interest grows in a straight line.', '["True","False"]'::jsonb, '0', null, null, 'Year 5 has exactly five times the interest of year 1, always. Worth holding onto — the next topic is about what happens when that line stops being straight, and the difference turns out to be enormous.'),
  ('a68b84fa-dd87-4ad3-923e-6eaeeda185ff', 3, 1, 'num', 'You borrow £400 at 6% simple interest for 3 years. How many pounds does the borrowing cost you in interest?', '[]'::jsonb, '72', null, null, '6% of £400 = £24 a year, × 3 = £72. Identical calculation to saving — the only difference is which direction the money moves.'),
  ('a68b84fa-dd87-4ad3-923e-6eaeeda185ff', 3, 2, 'num', 'You borrow £400 at 6% simple interest for 3 years. How many pounds do you repay in total?', '[]'::jsonb, '472', null, null, '£400 borrowed + £72 interest = £472. The total repaid is the number that actually matters when comparing loans, not the rate on its own.'),
  ('a68b84fa-dd87-4ad3-923e-6eaeeda185ff', 3, 3, 'text', 'What does APR stand for?', '[]'::jsonb, 'annual percentage rate', '["annual percentage rate","apr","annual percentage rate of charge"]'::jsonb, null, 'Annual Percentage Rate. It''s a standardised figure so that loans described in flattering but incompatible ways can be compared on one scale.'),
  ('a68b84fa-dd87-4ad3-923e-6eaeeda185ff', 3, 4, 'mcq', 'What does APR include that a headline interest rate might not?', '["The total amount you''ll repay","Compulsory fees as well as interest","Any late payment penalties","The lender''s profit margin"]'::jsonb, '1', null, null, 'Interest plus compulsory fees, expressed as one yearly percentage. That''s the whole point of it — a lender can''t make a loan look cheaper by moving cost from the rate into a mandatory fee.'),
  ('a68b84fa-dd87-4ad3-923e-6eaeeda185ff', 3, 5, 'mcq', 'Two loans are for the same amount. Loan A has a lower rate over five years; Loan B has a higher rate over two years. Which costs more?', '["Loan A, always","Loan B, always","It depends — you have to work out both totals","They''ll be identical if the APRs match"]'::jsonb, '2', null, null, 'A lower rate over a longer time can easily cost more overall than a higher rate over a shorter one. The only way to see it is to calculate both totals — which is exactly why the total, not the rate, is the number to compare.'),
  ('0bc5a755-a0a5-4378-bdf1-767aff7451b1', 3, 1, 'num', 'You save £250 at 5% simple interest for 6 years. How many pounds of interest do you earn?', '[]'::jsonb, '75', null, null, '5% of £250 = £12.50 a year, × 6 = £75. Simple interest is always this shape: one year''s interest, multiplied by the number of years.'),
  ('0bc5a755-a0a5-4378-bdf1-767aff7451b1', 3, 2, 'num', 'You borrow £600 at 9% simple interest for 2 years. How many pounds do you repay in total?', '[]'::jsonb, '708', null, null, '9% of £600 = £54 a year, × 2 = £108 of interest. £600 + £108 = £708. The £108 is what the loan charged you for existing.'),
  ('0bc5a755-a0a5-4378-bdf1-767aff7451b1', 3, 3, 'mcq', 'When comparing two borrowing options, which figure tells you the most?', '["The interest rate","The monthly payment","The total amount repaid","The length of the loan"]'::jsonb, '2', null, null, 'Rate, payment and length each describe one aspect; the total repaid folds all three together. B is the number most likely to be advertised prominently, and it''s the one that makes a longer, costlier loan look cheaper.'),
  ('0bc5a755-a0a5-4378-bdf1-767aff7451b1', 3, 4, 'mcq', 'A loan is advertised at "1.5% interest" with no period stated. What should you assume, and why does it matter?', '["Per month — most short-term loans are monthly","Per year, since that''s the default unless stated otherwise","Over the whole loan term","It''s not possible to assume anything"]'::jsonb, '1', null, null, 'Per year is the standard assumption. It matters enormously: 1.5% per month is roughly 18% per year before any compounding, which is a completely different loan from the one it appears to be.');
