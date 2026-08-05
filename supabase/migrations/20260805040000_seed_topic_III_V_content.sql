-- Real Tier 3 content for Topic III.V — Why Some Choices Are Riskier Than Others.
-- Same pattern as Tier 1/2: fixed UUIDs for topic/subtopic rows (safe to
-- re-run), slides/questions are a single-shot content load (no on-conflict
-- guard -- do not paste this file twice).

insert into topics (id, tier, "order", title, video_url)
values ('1da28af2-7da1-4deb-8902-36ec81a09b4d', 3, 5, 'Why Some Choices Are Riskier Than Others', null)
on conflict (id) do nothing;

insert into subtopics (id, topic_id, title, "order")
values
  ('703fb985-d37b-416b-83dc-81cbe9aa767c', '1da28af2-7da1-4deb-8902-36ec81a09b4d', 'What "Risk" Actually Means With Money', 1),
  ('f37c246c-638a-44bd-abe8-991ab9bbf340', '1da28af2-7da1-4deb-8902-36ec81a09b4d', 'Low Risk vs High Risk', 2),
  ('de4d9723-f5d3-4112-8d72-ecbbf2854b9d', '1da28af2-7da1-4deb-8902-36ec81a09b4d', 'Why Reward Usually Comes With Risk', 3),
  ('a0ff16d0-2428-48a6-97a4-51102d2fc0dd', '1da28af2-7da1-4deb-8902-36ec81a09b4d', 'Setting Up What''s Next', 4)
on conflict (id) do nothing;

insert into slides (subtopic_id, "order", heading, body)
values
  ('703fb985-d37b-416b-83dc-81cbe9aa767c', 1, 'Risk isn''t the same as danger', 'In everyday speech, risk means something bad might happen. In finance it means something more specific and more useful:

Risk is the range of possible outcomes.

Wider range, higher risk — in both directions. A high-risk option can end better than a low-risk one, not just worse. That''s precisely why anyone chooses it.'),
  ('703fb985-d37b-416b-83dc-81cbe9aa767c', 2, 'A worked comparison', '£100 in a protected savings account: in a year you''ll have roughly £102–£105. Narrow range, highly predictable.

£100 in shares of one small company: in a year you might have £40, or £250, or anything between. Wide range, unpredictable.

Neither is right or wrong. They''re different shapes of outcome, suited to different situations.'),
  ('703fb985-d37b-416b-83dc-81cbe9aa767c', 3, 'Nothing is actually risk-free', 'Cash feels like the zero-risk option, and it isn''t — it carries inflation risk, which is the guaranteed slow loss the last topic described.

So the real question is never "risk or no risk." It''s which risk, and does it suit what this money is for.'),
  ('f37c246c-638a-44bd-abe8-991ab9bbf340', 1, 'The spectrum', 'Roughly, from narrow range to wide:

Protected savings account — very predictable, protected up to a legal limit if the bank fails
Government bonds — lending to a government, historically low risk
Shares in many large companies at once — moderate, moves with the whole market
Shares in one company — higher, everything rides on one business
Cryptocurrency — very wide range, highly speculative'),
  ('f37c246c-638a-44bd-abe8-991ab9bbf340', 2, 'Why "one thing" is riskier than "many things"', 'One company can fail entirely. A hundred companies failing simultaneously is a different kind of event.

Spreading money across many things is called diversification, and it''s the closest thing to a free improvement in finance — it narrows the range of outcomes without necessarily lowering the average.'),
  ('f37c246c-638a-44bd-abe8-991ab9bbf340', 3, 'Time changes what counts as risky', 'Money you need next month in something that swings 30% either way is genuinely risky, because you might have to sell at the bottom.

The same choice for money you won''t touch for twenty years is a different proposition — the swings have time to matter less. Risk is partly a question of when you need it, not just what it is.'),
  ('f37c246c-638a-44bd-abe8-991ab9bbf340', 4, 'On crypto specifically', 'It sits at the far end of this spectrum: extremely wide range of outcomes, short history, prices driven heavily by speculation rather than by anything producing value.

Mastery covers it properly. For now: it belongs in this conversation as an example of high risk, and it''s for over-18s, and nothing here is a suggestion to go near it.'),
  ('de4d9723-f5d3-4112-8d72-ecbbf2854b9d', 1, 'Nobody accepts uncertainty for free', 'If two options offered identical returns and one was riskier, nobody would pick the riskier one.

So to attract money, riskier options have to offer the possibility of more. That extra is called the risk premium — payment for accepting a wider range of outcomes.'),
  ('de4d9723-f5d3-4112-8d72-ecbbf2854b9d', 2, 'Possibility, not promise', 'This is the sentence that matters: higher risk offers higher potential return, not higher guaranteed return.

If the higher return were guaranteed, it wouldn''t be risk. The premium exists precisely because sometimes you don''t get it.'),
  ('de4d9723-f5d3-4112-8d72-ecbbf2854b9d', 3, 'The rule this gives you', 'High return with no risk does not exist.

Not "is rare." Does not exist. If it did, everyone would move their money there, and the return would immediately fall.'),
  ('de4d9723-f5d3-4112-8d72-ecbbf2854b9d', 4, 'Which makes it a scam detector', 'Anything promising large, guaranteed, risk-free returns is either misunderstanding itself or lying to you.

That''s the same instinct Tier 2 built for scams — an offer better than it should be is the signal — arriving here with the arithmetic to explain why it can''t be true, rather than just a feeling that it isn''t.'),
  ('a0ff16d0-2428-48a6-97a4-51102d2fc0dd', 1, 'What investing actually is', 'Buying something now because you expect it to be worth more later — a share of a company, a bond, property.

It differs from saving in one respect that matters: the outcome isn''t guaranteed. You''re accepting a range in exchange for a higher expected result.'),
  ('a0ff16d0-2428-48a6-97a4-51102d2fc0dd', 2, 'The three ideas that do most of the work', 'Diversification — many things rather than one, to narrow the range
Time horizon — how long until you need it, which decides what''s appropriate
Cost — fees compound too, in the wrong direction

None of these are complicated. Nearly everything else in investing is detail layered on top of them.'),
  ('a0ff16d0-2428-48a6-97a4-51102d2fc0dd', 3, 'What this course won''t do', 'Sprig explains how these things work. It doesn''t tell you what to do with your money, and it never recommends anything specific.

Most investing requires being 18 anyway. The point of learning it at a younger age is that you''ll meet these decisions eventually, and understanding them beforehand is considerably better than meeting them cold.'),
  ('a0ff16d0-2428-48a6-97a4-51102d2fc0dd', 4, 'What you''ve built this tier', 'You can now work out percentages in both directions, calculate what borrowing actually costs, explain why compounding is slow then sudden, see why money sitting still loses value, and say precisely why a risk-free high return can''t exist.

That''s Mathematics — the numbers underneath everything Tiers 1 and 2 described.

Mastery is what''s left: the real compound interest formula, what money is worth across time, the psychology behind your own worst decisions, an honest look at crypto, and a budgeting tool you build yourself in Python.');

insert into questions (subtopic_id, tier, "order", question_type, question_text, options, correct_answer, accepted_answers, tolerance, explanation)
values
  ('703fb985-d37b-416b-83dc-81cbe9aa767c', 3, 1, 'mcq', 'In finance, what does "risk" actually mean?', '["The chance of losing money","The range of possible outcomes","How likely something is to fail","The amount you could lose"]'::jsonb, '1', null, null, 'Wider range, higher risk — in both directions. A high-risk option can end better than a low-risk one, not just worse, which is precisely why anyone chooses it. A is the everyday meaning, and it''s only half the picture.'),
  ('703fb985-d37b-416b-83dc-81cbe9aa767c', 3, 2, 'mcq', '£100 in a protected savings account might be worth £102–£105 in a year. £100 in one small company''s shares might be worth £40 or £250. Which is the better choice?', '["The savings account — the outcome is predictable","The shares — the potential return is higher","Neither is inherently better; they suit different situations","The savings account, unless you''re an expert"]'::jsonb, '2', null, null, 'They''re different shapes of outcome, not better and worse options. Which one fits depends on what the money is for and when you need it.'),
  ('703fb985-d37b-416b-83dc-81cbe9aa767c', 3, 3, 'mcq', 'Why isn''t holding cash actually risk-free?', '["Cash can be lost or stolen","It carries inflation risk — a guaranteed slow loss of buying power","Banks may refuse to accept old notes","It is genuinely risk-free"]'::jsonb, '1', null, null, 'A is true but it''s a different kind of risk. The financial answer is inflation: cash earns 0%, so its real return is minus the inflation rate, every year, guaranteed. The real question is never "risk or no risk" — it''s which risk, and does it suit the job.'),
  ('f37c246c-638a-44bd-abe8-991ab9bbf340', 3, 1, 'text', 'What''s the term for spreading money across many different investments to narrow the range of outcomes?', '[]'::jsonb, 'diversification', '["diversification","diversifying","diversify"]'::jsonb, null, 'Diversification — the closest thing to a free improvement in finance, because it narrows the range of outcomes without necessarily lowering the average.'),
  ('f37c246c-638a-44bd-abe8-991ab9bbf340', 3, 2, 'mcq', 'Why are shares in one company riskier than shares in many companies at once?', '["Individual companies have higher fees","One company can fail entirely; a hundred failing at once is a different kind of event","Small companies are always riskier than large ones","Single shares are harder to sell"]'::jsonb, '1', null, null, 'Everything rides on one business, so one bad outcome takes everything with it. Spreading across many means no single failure is decisive.'),
  ('f37c246c-638a-44bd-abe8-991ab9bbf340', 3, 3, 'mcq', 'Why might the same investment be risky for one person and reasonable for another?', '["Some people are better at picking investments","It depends when they need the money back","Risk levels vary by how much is invested","Experienced investors face lower risk"]'::jsonb, '1', null, null, 'Something swinging 30% either way is genuinely risky for money you need next month — you might be forced to sell at the bottom. For money untouched for twenty years, the swings have time to matter less.'),
  ('f37c246c-638a-44bd-abe8-991ab9bbf340', 3, 4, 'multi', 'Which of these describe cryptocurrency''s place on the risk spectrum?', '["An extremely wide range of possible outcomes","A short history compared with other assets","Prices driven heavily by speculation","A guaranteed long-term increase in value"]'::jsonb, '[0,1,2]', null, null, 'A, B and C. D is the claim to be most sceptical of — nothing guarantees a long-term increase, and anything promising one is describing something other than an investment.'),
  ('de4d9723-f5d3-4112-8d72-ecbbf2854b9d', 3, 1, 'text', 'What''s the term for the extra potential return offered to compensate someone for accepting more risk?', '[]'::jsonb, 'risk premium', '["risk premium","the risk premium","premium"]'::jsonb, null, 'The risk premium. Nobody accepts a wider range of outcomes for free — if two options offered identical returns and one was riskier, nobody would choose the riskier one.'),
  ('de4d9723-f5d3-4112-8d72-ecbbf2854b9d', 3, 2, 'mcq', 'What does higher risk actually offer?', '["A higher guaranteed return","A higher potential return","A faster return","Protection against inflation"]'::jsonb, '1', null, null, 'Potential, not promise. If the higher return were guaranteed, it wouldn''t be risk — the premium exists precisely because sometimes you don''t get it.'),
  ('de4d9723-f5d3-4112-8d72-ecbbf2854b9d', 3, 3, 'mcq', 'Someone offers an investment with large, guaranteed returns and no risk. What should you conclude?', '["It''s worth investigating carefully","It''s either misunderstood or dishonest — that combination doesn''t exist","It''s probably legitimate but low-return","It depends on who''s offering it"]'::jsonb, '1', null, null, 'High return with no risk does not exist — not "is rare," does not exist. If it did, everyone would move their money there and the return would immediately fall. That makes this one of the most reliable scam detectors there is.'),
  ('a0ff16d0-2428-48a6-97a4-51102d2fc0dd', 3, 1, 'mcq', 'What distinguishes investing from saving?', '["Investing always produces higher returns","The outcome isn''t guaranteed — you accept a range in exchange for a higher expected result","Investing requires much larger amounts","Saving is only for short-term goals"]'::jsonb, '1', null, null, 'You''re buying something now expecting it to be worth more later, and accepting that it might not be. That single difference explains most of what follows in investing.'),
  ('a0ff16d0-2428-48a6-97a4-51102d2fc0dd', 3, 2, 'multi', 'Which ideas do most of the work in investing?', '["Diversification — many things rather than one","Time horizon — how long until you need the money","Cost — fees compound too, in the wrong direction","Timing — predicting when markets will rise and fall"]'::jsonb, '[0,1,2]', null, null, 'A, B and C. D is what most people assume investing is about, and it''s the one professionals consistently struggle with — which is why the first three matter far more.'),
  ('a0ff16d0-2428-48a6-97a4-51102d2fc0dd', 3, 3, 'mcq', 'Why do investment fees matter more than their size suggests?', '["They''re charged whether you gain or lose","They compound over time, in the wrong direction","They''re often hidden in the small print","They increase as your balance grows"]'::jsonb, '1', null, null, 'A fee taken today isn''t just that money gone — it''s that money never compounding for you again. The same mechanism that grows savings works against you here, which is why a small percentage difference matters over decades.'),
  ('a0ff16d0-2428-48a6-97a4-51102d2fc0dd', 3, 4, 'mcq', 'What does Sprig do, and not do, about investing?', '["Recommends suitable investments for your age","Explains how these things work, without recommending anything specific","Provides investment advice once you turn 16","Avoids the topic entirely"]'::jsonb, '1', null, null, 'The point of learning this now is that you''ll meet these decisions eventually, and understanding them beforehand beats meeting them cold. Most investing requires being 18 anyway.');
