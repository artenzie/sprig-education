-- Real Tier 4 content for Topic IV.II — The Real Compound Interest Formula.
-- Same pattern as Tier 1/2/3: fixed UUIDs for topic/subtopic rows (safe to
-- re-run), slides/questions are a single-shot content load (no on-conflict
-- guard -- do not paste this file twice).

insert into topics (id, tier, "order", title, video_url)
values ('864552b5-a884-4d70-a772-d885b9bb0ebd', 4, 2, 'The Real Compound Interest Formula', null)
on conflict (id) do nothing;

insert into subtopics (id, topic_id, title, "order")
values
  ('ecb89bf3-2b22-48ed-9191-f19a473b7076', '864552b5-a884-4d70-a772-d885b9bb0ebd', 'Introducing the Formula', 1),
  ('b4fc7d56-e48d-46bb-ae82-aa20fb58e1f4', '864552b5-a884-4d70-a772-d885b9bb0ebd', 'Breaking Down Each Part', 2),
  ('a7b75d0c-ea89-4cb9-805a-68584c34999d', '864552b5-a884-4d70-a772-d885b9bb0ebd', 'Plugging In Real Numbers', 3),
  ('09d94e54-14ba-4243-84e7-a0b78c9e512a', '864552b5-a884-4d70-a772-d885b9bb0ebd', 'Comparing Simple vs Compound', 4)
on conflict (id) do nothing;

insert into slides (subtopic_id, "order", heading, body, slide_type)
values
  ('ecb89bf3-2b22-48ed-9191-f19a473b7076', 1, 'The formula you''ve been using without seeing', 'Tier 3 showed compounding by multiplying year after year. That works, but it''s slow, and it only handles interest added once a year.

Here''s the whole thing at once:

$$A = P\left(1 + \frac{r}{n}\right)^{nt}$$

Five letters. It looks worse than it is.', 'text'),
  ('ecb89bf3-2b22-48ed-9191-f19a473b7076', 2, 'What each letter means', '$A$ — the Amount at the end. What you''re solving for
$P$ — the Principal. What you started with
$r$ — the annual interest rate, as a decimal (5% becomes $0.05$)
$n$ — how many times per year interest is added
$t$ — the number of years', 'text'),
  ('ecb89bf3-2b22-48ed-9191-f19a473b7076', 3, 'The two parts doing the work', '$\frac{r}{n}$ is the rate for one compounding period. At 6% added monthly, each month gets $\frac{0.06}{12} = 0.005$.

$nt$ is how many periods there are in total. Twelve times a year for ten years is $12 \times 10 = 120$.

So the formula reads: take one period''s growth, and apply it as many times as there are periods.', 'text'),
  ('ecb89bf3-2b22-48ed-9191-f19a473b7076', 4, 'Where the "1 +" comes from', 'Multiplying by $1.05$ rather than $0.05$ is the difference between keeping your money and adding 5% and replacing it with 5% of itself.

The $1$ preserves what you had; the $\frac{r}{n}$ adds the growth on top. Exactly the same trick as multiplying by $1.2$ to add VAT in Tier 3.', 'text'),
  ('b4fc7d56-e48d-46bb-ae82-aa20fb58e1f4', 1, 'What n actually changes', 'Yearly: $n = 1$
Quarterly: $n = 4$
Monthly: $n = 12$
Daily: $n = 365$

A larger $n$ divides the rate into smaller pieces but applies it more often. Those two effects don''t cancel out — applying it more often wins, slightly.', 'text'),
  ('b4fc7d56-e48d-46bb-ae82-aa20fb58e1f4', 2, 'Why more often wins, in one sentence', 'Interest added in month one starts earning interest in month two.

Wait until the end of the year to add it and it earned nothing in the meantime. That''s the entire advantage, and it''s why the gain is real but modest.', 'text'),
  ('b4fc7d56-e48d-46bb-ae82-aa20fb58e1f4', 3, 'Order of operations matters', 'Work through it in this order:

1. $\frac{r}{n}$ — divide
2. $1 + \frac{r}{n}$ — add
3. Raise that to the power $nt$
4. Multiply by $P$

Multiply by $P$ first and you''ll get a badly wrong answer. A calculator follows this order automatically if you type the brackets in.', 'text'),
  ('b4fc7d56-e48d-46bb-ae82-aa20fb58e1f4', 4, 'Getting r wrong is the usual mistake', '$r$ is a decimal, not a percentage. 5% is $0.05$.

Type $5$ instead and you''re calculating 500% interest. The number that comes out is absurd rather than subtly wrong, which at least makes it easy to catch.', 'text'),
  ('a7b75d0c-ea89-4cb9-805a-68584c34999d', 1, 'A worked example, start to finish', '£500 at 4%, compounded quarterly, for 3 years.

$P = 500$
$r = 0.04$
$n = 4$
$t = 3$', 'text'),
  ('a7b75d0c-ea89-4cb9-805a-68584c34999d', 2, 'Step by step', '1. $\frac{r}{n} = \frac{0.04}{4} = 0.01$
2. $1 + 0.01 = 1.01$
3. $nt = 4 \times 3 = 12$
4. $1.01^{12} = 1.126825$
5. $500 \times 1.126825 = 563.41$

So £500 becomes £563.41 — £63.41 of interest.', 'text'),
  ('a7b75d0c-ea89-4cb9-805a-68584c34999d', 3, 'The same money, three ways', '£1,000 at 5% for 10 years:

Simple interest: £1,500
Compounded yearly ($n = 1$): $1000 \times 1.05^{10} \approx 1628.89$ → £1,628.89
Compounded monthly ($n = 12$): $1000 \times \left(1 + \frac{0.05}{12}\right)^{120} \approx 1647.01$ → £1,647.01', 'text'),
  ('a7b75d0c-ea89-4cb9-805a-68584c34999d', 4, 'What that comparison tells you', 'Simple to yearly compounding is a gap of £128.89. Yearly to monthly is £18.12.

Compounding at all matters far more than compounding often. Worth remembering when a savings account advertises daily compounding as though it were the main event — it''s real, and it''s the smallest of the three effects here.', 'text'),
  ('09d94e54-14ba-4243-84e7-a0b78c9e512a', 1, 'The two formulas together', 'Simple interest:
$$A = P(1 + rt)$$

Compound interest:
$$A = P\left(1 + \frac{r}{n}\right)^{nt}$$

In simple interest, time multiplies. In compound interest, time is an exponent. That single structural difference is the whole story.', 'text'),
  ('09d94e54-14ba-4243-84e7-a0b78c9e512a', 2, 'Why the shape differs', 'Multiplying by time gives a straight line — the same amount added every year, forever.

Raising to the power of time gives a curve that bends upward, because each year''s growth is calculated from a larger number than the year before.', 'text'),
  ('09d94e54-14ba-4243-84e7-a0b78c9e512a', 3, 'Which is why 30 years looks the way it does', 'At 3 years, £1,000 at 5% gives £1,150 simple and £1,157.63 compound. Barely different.

At 30 years: £2,500 simple, and $1000 \times 1.05^{30} \approx 4321.94$ — £4,321.94 compound.

The formula didn''t change between those two examples. Only $t$ did, and it''s sitting in the exponent.', 'text'),
  ('09d94e54-14ba-4243-84e7-a0b78c9e512a', 4, 'Using it in both directions', 'The same formula tells you what a debt becomes if you leave it alone.

A £500 credit card balance at 22%, compounded monthly, untouched for 3 years:

$$500\left(1 + \frac{0.22}{12}\right)^{36} \approx 962$$

Nearly double — £962 — without buying anything else. Same maths, different sign on how you feel about it.', 'text');

insert into questions (subtopic_id, tier, "order", question_type, question_text, options, correct_answer, accepted_answers, tolerance, explanation)
values
  ('ecb89bf3-2b22-48ed-9191-f19a473b7076', 4, 1, 'mcq', 'In the compound interest formula A = P(1 + r/n)^(nt), what does P stand for?', '["The percentage rate","The principal — the amount you started with","The number of payments","The final amount"]'::jsonb, '1', null, null, 'P is where you began; A is where you end up. Mixing those two is the most common way to get the formula backwards.'),
  ('ecb89bf3-2b22-48ed-9191-f19a473b7076', 4, 2, 'mcq', 'In A = P(1 + r/n)^(nt), what does n represent?', '["The number of years","How many times per year interest is added","The total number of interest payments","The nominal interest rate"]'::jsonb, '1', null, null, 'Yearly is n = 1, monthly is n = 12, daily is n = 365. C is close but describes n × t, not n on its own.'),
  ('ecb89bf3-2b22-48ed-9191-f19a473b7076', 4, 3, 'mcq', 'An account pays 7% interest. What value should r take in the formula?', '["7","0.07","0.7","107"]'::jsonb, '1', null, null, 'r is a decimal, always. Use 7 and you''re calculating 700% interest — the answer comes out absurd rather than subtly wrong, which at least makes it easy to spot.'),
  ('ecb89bf3-2b22-48ed-9191-f19a473b7076', 4, 4, 'mcq', 'Why is the formula (1 + r/n) rather than just (r/n)?', '["To stop the answer being negative","The 1 keeps your original money; r/n adds the growth on top","It makes the exponent work correctly","It''s a convention with no mathematical effect"]'::jsonb, '1', null, null, 'Multiplying by 1.05 keeps your money and adds 5%. Multiplying by 0.05 would replace it with 5% of itself. Same trick as multiplying by 1.2 to add VAT.'),
  ('b4fc7d56-e48d-46bb-ae82-aa20fb58e1f4', 4, 1, 'num', 'Interest is compounded monthly for 5 years. What is the value of nt?', '[]'::jsonb, '60', null, null, 'Monthly means n = 12, so nt = 12 × 5 = 60. That''s the total number of times interest gets added over the whole period.'),
  ('b4fc7d56-e48d-46bb-ae82-aa20fb58e1f4', 4, 2, 'num', 'Interest is compounded quarterly for 3 years. What is the value of nt?', '[]'::jsonb, '12', null, null, 'Quarterly means n = 4, so nt = 4 × 3 = 12. Note this is the same nt as monthly compounding for one year — but the r/n would differ, so the results aren''t identical.'),
  ('b4fc7d56-e48d-46bb-ae82-aa20fb58e1f4', 4, 3, 'mcq', 'In the formula A = P(1 + r/n)^(nt), which step comes first?', '["Multiply by P","Divide r by n","Raise to the power nt","Add 1"]'::jsonb, '1', null, null, 'Work outwards from the innermost bracket: divide, then add 1, then raise to the power, then multiply by P. Multiplying by P first produces a badly wrong answer.'),
  ('b4fc7d56-e48d-46bb-ae82-aa20fb58e1f4', 4, 4, 'mcq', 'Why does compounding more frequently produce slightly more growth?', '["The interest rate itself increases","Interest added earlier starts earning interest sooner","More frequent compounding avoids rounding losses","Banks charge less on frequently-compounded accounts"]'::jsonb, '1', null, null, 'Add interest in month one and it''s earning by month two. Wait until the year''s end and it earned nothing in the meantime. That''s the entire advantage — real, but modest.'),
  ('a7b75d0c-ea89-4cb9-805a-68584c34999d', 4, 1, 'num', '£1,000 is invested at 10% compounded yearly for 2 years. How many pounds is it worth at the end?', '[]'::jsonb, '1210', null, null, 'Year 1: 1000 × 1.1 = 1100. Year 2: 1100 × 1.1 = 1210. Simple interest would have given £1,200 — the extra £10 is interest earned on year one''s interest.'),
  ('a7b75d0c-ea89-4cb9-805a-68584c34999d', 4, 2, 'num', '£2,000 is invested at 5% compounded yearly for 2 years. How many pounds is it worth at the end?', '[]'::jsonb, '2205', null, null, '2000 × 1.05 = 2100, then 2100 × 1.05 = 2205. Simple interest gives £2,200, so compounding added £5 over two years — small now, and the gap widens sharply over longer periods.'),
  ('a7b75d0c-ea89-4cb9-805a-68584c34999d', 4, 3, 'num', '£500 is invested at 20% compounded yearly for 2 years. How many pounds is it worth at the end?', '[]'::jsonb, '720', null, null, '500 × 1.2 = 600, then 600 × 1.2 = 720. Simple interest would give £700 — a bigger gap than the previous examples, because a higher rate compounds harder.'),
  ('a7b75d0c-ea89-4cb9-805a-68584c34999d', 4, 4, 'mcq', '£1,000 at 5% for 10 years gives £1,500 with simple interest, £1,628.89 compounded yearly, and £1,647.01 compounded monthly. What does that comparison show?', '["Monthly compounding roughly doubles the return","Compounding at all matters far more than compounding often","Simple interest is better over shorter periods","The compounding frequency makes no meaningful difference"]'::jsonb, '1', null, null, 'Simple to yearly is a £128.89 gap. Yearly to monthly is £18.12. Worth remembering when an account advertises daily compounding as its headline feature — it''s real, and it''s the smallest of the three effects.'),
  ('a7b75d0c-ea89-4cb9-805a-68584c34999d', 4, 5, 'mcq', 'Working out £500 at 4% compounded quarterly for 3 years, what is r/n?', '["0.04","0.01","0.16","0.12"]'::jsonb, '1', null, null, 'Quarterly means n = 4, so r/n = 0.04 ÷ 4 = 0.01 — the growth applied in each individual quarter. It then gets applied nt = 12 times.'),
  ('09d94e54-14ba-4243-84e7-a0b78c9e512a', 4, 1, 'mcq', 'Simple interest is A = P(1 + rt); compound is A = P(1 + r/n)^(nt). What''s the key structural difference?', '["Compound interest uses a higher rate","In simple interest time multiplies; in compound interest time is an exponent","Simple interest can''t be used for borrowing","Compound interest requires monthly payments"]'::jsonb, '1', null, null, 'That one difference produces everything else — a straight line versus a curve that bends upward. Nothing else about the two formulas matters nearly as much.'),
  ('09d94e54-14ba-4243-84e7-a0b78c9e512a', 4, 2, 'mcq', 'Why does the gap between simple and compound interest grow so much over long periods?', '["Interest rates rise over time","Each year''s compound growth is calculated from a larger balance than the year before","Simple interest stops being applied after a certain point","Inflation affects the two differently"]'::jsonb, '1', null, null, 'At 3 years, £1,000 at 5% differs by under £8 between the two. At 30 years it''s over £1,800. The formula didn''t change — only t did, and it sits in the exponent.'),
  ('09d94e54-14ba-4243-84e7-a0b78c9e512a', 4, 3, 'mcq', 'True or false: the compound interest formula can also be used to work out how much a debt will grow if it''s left unpaid.', '["True","False"]'::jsonb, '0', null, null, 'Identical maths, opposite feeling. A £500 credit card balance at 22% compounded monthly reaches about £962 in three years — nearly double, without buying anything else.'),
  ('09d94e54-14ba-4243-84e7-a0b78c9e512a', 4, 4, 'mcq', 'A £500 credit card balance at 22%, compounded monthly and left untouched, reaches roughly £962 after 3 years. What''s the most useful thing to take from that?', '["Credit cards should never be used","Compounding works against you just as powerfully as it works for you","22% is an unusually high rate","The balance would be lower with yearly compounding"]'::jsonb, '1', null, null, 'The mechanism that grows savings is the mechanism that grows debt — and debt rates are typically far higher than savings rates, which is why it bites faster. D is technically true but a minor detail beside the main point.');
