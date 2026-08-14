-- Real Tier 4 content for Topic IV.IV — Behavioural Finance.
-- Same pattern as Tier 1/2/3: fixed UUIDs for topic/subtopic rows (safe to
-- re-run), slides/questions are a single-shot content load (no on-conflict
-- guard -- do not paste this file twice).

insert into topics (id, tier, "order", title, video_url)
values ('f34c694f-1a0b-497e-9d3b-848b9462d296', 4, 4, 'Behavioural Finance', null)
on conflict (id) do nothing;

insert into subtopics (id, topic_id, title, "order")
values
  ('0f6382bd-27c1-47cf-81a4-e8eba5fdafcf', 'f34c694f-1a0b-497e-9d3b-848b9462d296', 'Loss Aversion', 1),
  ('fb155654-9808-4f51-8a14-33a8a88d900e', 'f34c694f-1a0b-497e-9d3b-848b9462d296', 'FOMO Spending', 2),
  ('d4784b25-62ca-48cd-b389-04038a5b16a3', 'f34c694f-1a0b-497e-9d3b-848b9462d296', 'The Sunk Cost Fallacy', 3),
  ('a8616ba9-7efc-42cd-8d69-577655d33632', 'f34c694f-1a0b-497e-9d3b-848b9462d296', 'Practice: Spotting These Biases in Yourself', 4)
on conflict (id) do nothing;

insert into slides (subtopic_id, "order", heading, body, slide_type)
values
  ('0f6382bd-27c1-47cf-81a4-e8eba5fdafcf', 1, 'Losing £10 hurts more than finding £10 feels good', 'Same amount, same day, and the feelings don''t cancel out.

This is loss aversion, one of the most consistently reproduced findings in psychology and economics. Research suggests losses feel roughly twice as powerful as equivalent gains.', 'text'),
  ('0f6382bd-27c1-47cf-81a4-e8eba5fdafcf', 2, 'Where it comes from', 'It isn''t irrational — it''s older than money. Losing a day''s food mattered more to survival than gaining a spare one, so being more alert to loss than to gain is a sensible instinct to have inherited.

The instinct just doesn''t translate cleanly into decisions about numbers on a screen.', 'text'),
  ('0f6382bd-27c1-47cf-81a4-e8eba5fdafcf', 3, 'What it makes people do', 'Hold onto something that''s losing value, because selling makes the loss real
Refuse a reasonable risk with a genuinely good expected outcome
Pay over the odds for a guarantee against something unlikely

The middle one is worth noticing. Tier 3''s risk premium exists because most people are loss-averse — that''s precisely why higher-risk options have to offer more to attract anyone at all.', 'text'),
  ('0f6382bd-27c1-47cf-81a4-e8eba5fdafcf', 4, 'What to do about it', 'You can''t switch it off, and you probably shouldn''t want to.

What helps is noticing when a decision is being framed as a loss rather than a gain. "Don''t miss out on £20 off" and "pay £20 more" describe the same transaction and land completely differently.', 'text'),
  ('fb155654-9808-4f51-8a14-33a8a88d900e', 1, 'Fear of missing out, applied to money', 'The pull to buy because not buying feels like losing something.

Notice the shape of that: it''s loss aversion again, pointed at an opportunity rather than an object. Sales, countdown timers, limited editions and "only 2 left" are all built to convert a purchase into a potential loss.', 'text'),
  ('fb155654-9808-4f51-8a14-33a8a88d900e', 2, 'Why it works on everyone', 'Two instincts pulling at once — loss aversion, plus the belonging pressure from Tier 1. An offer expiring is a small loss; everyone else having it is a social one.

Stacking those is why the technique is so common. It isn''t one nudge, it''s two.', 'text'),
  ('fb155654-9808-4f51-8a14-33a8a88d900e', 3, 'The tell', 'FOMO produces a want with no history. You didn''t want it yesterday, you''d forgotten it existed, and now it feels urgent.

Tier 1''s question still works and gets sharper here: what did I know about this ten minutes ago? If the answer is nothing, the urgency came from the offer, not from you.', 'text'),
  ('fb155654-9808-4f51-8a14-33a8a88d900e', 4, 'What actually helps', 'Missing an opportunity costs you the opportunity. Buying something you didn''t want costs you the money.

Those two aren''t equivalent — and FOMO is precisely the feeling that insists they are.', 'text'),
  ('d4784b25-62ca-48cd-b389-04038a5b16a3', 1, 'Money already spent shouldn''t affect what you do next', 'You paid £15 for a game you don''t enjoy. Do you keep playing to "get your money''s worth"?

The £15 is gone either way. Playing on doesn''t recover it — it just spends your time as well.', 'text'),
  ('d4784b25-62ca-48cd-b389-04038a5b16a3', 2, 'What "sunk" means', 'A sunk cost is one you''ve already paid and cannot get back, whatever you do now.

The fallacy is letting it influence a decision it genuinely can''t affect. The only honest question is what''s best from here — and past spending isn''t part of that answer.', 'text'),
  ('d4784b25-62ca-48cd-b389-04038a5b16a3', 3, 'Why it''s so hard to ignore', 'Walking away means admitting the money was wasted, and admitting it makes the loss feel real.

Which is loss aversion once more. All three biases in this topic are the same instinct wearing different clothes — that''s the actual insight, not three unrelated quirks to memorise.', 'text'),
  ('d4784b25-62ca-48cd-b389-04038a5b16a3', 4, 'The question that cuts through it', 'If I hadn''t already paid, would I choose this now?

If no, the only thing keeping you there is money you''ve already lost. Stopping doesn''t waste the £15 — the £15 was spent the moment you paid it.', 'text'),
  ('a8616ba9-7efc-42cd-8d69-577655d33632', 1, 'What you''re about to do', 'Real scenarios, naming which bias is doing the work — and noticing where more than one is at once.

The point isn''t to eliminate these. You can''t, and people who believe they have are usually the easiest to influence. The point is to notice them while they''re happening, which is enough to change what you do next.', 'text');

insert into questions (subtopic_id, tier, "order", question_type, question_text, options, correct_answer, accepted_answers, tolerance, explanation)
values
  ('0f6382bd-27c1-47cf-81a4-e8eba5fdafcf', 4, 1, 'text', 'What''s the term for losing something feeling worse than gaining the same thing feels good?', '[]'::jsonb, 'loss aversion', '["loss aversion","loss-aversion","aversion to loss"]'::jsonb, null, 'Loss aversion — one of the most consistently reproduced findings in psychology and economics. Research suggests losses feel roughly twice as powerful as equivalent gains.'),
  ('0f6382bd-27c1-47cf-81a4-e8eba5fdafcf', 4, 2, 'mcq', 'Why do humans have loss aversion at all?', '["It''s learned from experience with money","It''s an old survival instinct — losing food mattered more than gaining spare food","It''s caused by advertising","It only affects people who have experienced financial difficulty"]'::jsonb, '1', null, null, 'It''s older than money, which is exactly why it doesn''t translate cleanly to decisions about numbers on a screen. Not irrational — just aimed at a different problem than the one you''re facing.'),
  ('0f6382bd-27c1-47cf-81a4-e8eba5fdafcf', 4, 3, 'mcq', '"Don''t miss out on £20 off" and "pay £20 more" describe the same transaction. Why does the first work better?', '["It sounds more polite","It frames the decision as avoiding a loss rather than accepting a cost","It mentions a specific number","It implies the offer is temporary"]'::jsonb, '1', null, null, 'Framing is the practical application of loss aversion. You can''t switch the instinct off, but you can notice when a choice has been deliberately worded as a loss.'),
  ('0f6382bd-27c1-47cf-81a4-e8eba5fdafcf', 4, 4, 'mcq', 'Tier 3 explained that riskier investments have to offer higher potential returns. How does loss aversion relate to that?', '["It has no connection — risk premiums are set by regulators","Because most people are loss-averse, riskier options must offer more to attract anyone","Loss aversion makes people prefer riskier options","It applies only to guaranteed returns"]'::jsonb, '1', null, null, 'The risk premium exists because of how humans feel about losses. If people weighed gains and losses equally, riskier options wouldn''t need to pay extra to attract money.'),
  ('fb155654-9808-4f51-8a14-33a8a88d900e', 4, 1, 'mcq', 'What''s the underlying mechanism behind FOMO spending?', '["Wanting things other people have","Loss aversion, pointed at an opportunity rather than an object","Not having a budget","Impulsive personality traits"]'::jsonb, '1', null, null, 'Not buying gets reframed as losing something. That''s why countdown timers, "only 2 left," and limited editions all work — they convert a purchase into a potential loss.'),
  ('fb155654-9808-4f51-8a14-33a8a88d900e', 4, 2, 'mcq', 'What''s the clearest sign that a want is FOMO rather than a genuine preference?', '["The item is expensive","The want has no history — you''d forgotten it existed until just now","Other people have already bought it","You''ve thought about it for several days"]'::jsonb, '1', null, null, 'Tier 1''s question works even better here: what did I know about this ten minutes ago? If the answer''s nothing, the urgency came from the offer, not from you.'),
  ('fb155654-9808-4f51-8a14-33a8a88d900e', 4, 3, 'mcq', 'What''s the honest comparison between missing an opportunity and buying something you didn''t want?', '["They cost roughly the same","Missing an opportunity costs the opportunity; buying costs the money","Missing an opportunity is always worse","Neither has a real cost"]'::jsonb, '1', null, null, 'Those aren''t equivalent — and FOMO is precisely the feeling that insists they are. One leaves you where you started; the other leaves you with less.'),
  ('d4784b25-62ca-48cd-b389-04038a5b16a3', 4, 1, 'text', 'What''s the term for money you''ve already spent and cannot get back, whatever you decide next?', '[]'::jsonb, 'sunk cost', '["sunk cost","sunk costs","a sunk cost"]'::jsonb, null, 'A sunk cost. The fallacy is letting it influence a decision it genuinely can''t affect — the only honest question is what''s best from here.'),
  ('d4784b25-62ca-48cd-b389-04038a5b16a3', 4, 2, 'mcq', 'You paid £15 for a game you''re not enjoying. Why is "I should keep playing to get my money''s worth" a mistake?', '["The game might get better later","The £15 is gone either way — playing on just spends your time too","You could sell the game instead","£15 is too small an amount to worry about"]'::jsonb, '1', null, null, 'Continuing doesn''t recover the money; it adds a second cost on top of the first. C is a reasonable separate idea, but it doesn''t address the reasoning error.'),
  ('d4784b25-62ca-48cd-b389-04038a5b16a3', 4, 3, 'mcq', 'Why is the sunk cost fallacy so hard to resist?', '["People are bad at arithmetic","Walking away means admitting the money was wasted, which makes the loss feel real","It''s usually the correct decision anyway","Most people don''t know the term"]'::jsonb, '1', null, null, 'It''s loss aversion again — all three biases in this topic are the same instinct in different clothes. That connection is the actual insight, not three separate quirks to memorise.'),
  ('d4784b25-62ca-48cd-b389-04038a5b16a3', 4, 4, 'mcq', 'What question cuts through the sunk cost fallacy most effectively?', '["How much have I already spent on this?","If I hadn''t already paid, would I choose this now?","Can I get a refund?","How much longer would it take to finish?"]'::jsonb, '1', null, null, 'It strips out the part that can''t be changed and asks only about the decision that''s actually in front of you. A is the question that creates the fallacy.'),
  ('a8616ba9-7efc-42cd-8d69-577655d33632', 4, 1, 'mcq', 'A shopping app shows "Sale ends in 9:58" beside an item you''d never considered before. Which biases are being used?', '["Sunk cost only","Loss aversion and FOMO — the timer converts not buying into a loss","Loss aversion only, since no purchase has been made yet","None — a countdown is neutral information"]'::jsonb, '1', null, null, 'Most countdown timers reset when you reload the page. Worth knowing that in the UK, misleading countdown timers were explicitly banned under the DMCCA — though the effect works whether or not the timer is honest.'),
  ('a8616ba9-7efc-42cd-8d69-577655d33632', 4, 2, 'mcq', 'Someone keeps paying for a subscription they never use, because they''ve "already spent so much on it." Which bias is this?', '["FOMO","The sunk cost fallacy","Loss aversion about the monthly cost","Default bias"]'::jsonb, '1', null, null, 'Past payments can''t be recovered by making more of them. The only relevant question is whether the next payment is worth it — and the answer here is plainly no.'),
  ('a8616ba9-7efc-42cd-8d69-577655d33632', 4, 3, 'mcq', 'What''s the realistic goal when it comes to these biases?', '["Eliminate them through practice","Notice them while they''re happening","Avoid situations where they might occur","Rely on rules rather than judgement"]'::jsonb, '1', null, null, 'You can''t eliminate them, and people who believe they have are usually the easiest to influence. Noticing in the moment is enough to change what you do next.'),
  ('a8616ba9-7efc-42cd-8d69-577655d33632', 4, 4, 'multi', 'Which of these statements about loss aversion, FOMO and the sunk cost fallacy are true?', '["All three are versions of the same underlying instinct","They can appear together in a single decision","Understanding them makes you immune to them","They affect people regardless of how clever they are"]'::jsonb, '[0,1,3]', null, null, 'A, B and D. C is the dangerous one — knowing the name of a bias doesn''t switch it off, and believing otherwise makes you less likely to check yourself.');
