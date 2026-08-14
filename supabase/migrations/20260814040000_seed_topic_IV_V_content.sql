-- Real Tier 4 content for Topic IV.V — Introduction to Crypto.
-- Same pattern as Tier 1/2/3: fixed UUIDs for topic/subtopic rows (safe to
-- re-run), slides/questions are a single-shot content load (no on-conflict
-- guard -- do not paste this file twice).

insert into topics (id, tier, "order", title, video_url)
values ('f3c13a4b-3d3a-4f89-b259-040b7dec2f14', 4, 5, 'Introduction to Crypto', null)
on conflict (id) do nothing;

insert into subtopics (id, topic_id, title, "order")
values
  ('4abf7146-935e-4e4a-8b9c-a7880dfd637c', 'f3c13a4b-3d3a-4f89-b259-040b7dec2f14', 'What Cryptocurrency Actually Is', 1),
  ('0fe181f9-2d30-45b8-b874-a94884c1ac83', 'f3c13a4b-3d3a-4f89-b259-040b7dec2f14', 'How It''s Different From Normal Money', 2),
  ('7281d4d8-c9a1-4b11-852d-e8786e75108b', 'f3c13a4b-3d3a-4f89-b259-040b7dec2f14', 'Why It''s Considered High Risk and Speculative', 3),
  ('ad125743-e1fd-4023-9483-c17feba7f7da', 'f3c13a4b-3d3a-4f89-b259-040b7dec2f14', 'What to Know Before Ever Getting Involved', 4)
on conflict (id) do nothing;

insert into slides (subtopic_id, "order", heading, body, slide_type)
values
  ('4abf7146-935e-4e4a-8b9c-a7880dfd637c', 1, 'Before anything else', 'This topic is informational only. Nothing in it is a suggestion to buy, hold or trade cryptocurrency. Most crypto services in the UK require you to be 18 or over.

It''s here because you''ll encounter it — in ads, from people online, in conversation — and understanding what it actually is beats picking it up from someone who''s selling something.', 'text'),
  ('4abf7146-935e-4e4a-8b9c-a7880dfd637c', 2, 'A shared record with no owner', 'Normal money has a record-keeper: your bank knows what''s in your account, as Tier 1 covered.

Cryptocurrency replaces that single record-keeper with a copy of the record held by thousands of computers at once, all agreeing on it. That shared record is the blockchain.', 'text'),
  ('4abf7146-935e-4e4a-8b9c-a7880dfd637c', 3, 'Why it''s called a chain', 'Transactions get bundled into blocks, and each new block contains a fingerprint of the one before it.

That linking is what makes old entries hard to alter — changing one would break every fingerprint after it, on thousands of machines simultaneously. It''s genuinely clever engineering.', 'text'),
  ('4abf7146-935e-4e4a-8b9c-a7880dfd637c', 4, 'Clever isn''t the same as valuable', 'The technology working exactly as designed says nothing about whether any particular coin is worth anything.

Worth separating those two questions clearly, because they get blurred constantly — usually by people who own some.', 'text'),
  ('0fe181f9-2d30-45b8-b874-a94884c1ac83', 1, 'Nobody is steering it', 'The Bank of England targets 2% inflation and adjusts interest rates to get there — Tier 3 covered this.

No equivalent exists for a cryptocurrency. Nobody manages its supply toward a goal, and nobody intervenes when it moves violently. That''s the design, not an oversight.', 'text'),
  ('0fe181f9-2d30-45b8-b874-a94884c1ac83', 2, 'Transactions can''t be reversed', 'Tier 1''s argument that banked money is safer than cash rested on records and reversibility — a fraudulent card transaction can usually be undone.

A crypto transaction generally cannot. Send it to the wrong address, or to a scammer, and there is nobody to appeal to. This is the single most practically important difference on this slide.', 'text'),
  ('0fe181f9-2d30-45b8-b874-a94884c1ac83', 3, 'The price moves in ways normal money doesn''t', '£10 is £10 tomorrow. A cryptocurrency worth £10 today might be worth £6 or £15 next month.

That volatility isn''t a malfunction — it''s a market with no anchor, which makes it poor at the main job money does: being a stable measure of what things cost.', 'text'),
  ('0fe181f9-2d30-45b8-b874-a94884c1ac83', 4, 'Where UK rules currently stand', 'Crypto is in the middle of becoming regulated, and you''re learning about it mid-transition.

Parliament passed the cryptoasset regulations in February 2026, and the FCA finalised its rules in June 2026. Firms began applying for authorisation from September 2026, and the full regime takes effect in October 2027.

So: more regulated than it was, not yet fully regulated, and still changing.', 'text'),
  ('7281d4d8-c9a1-4b11-852d-e8786e75108b', 1, 'Where the "speculative" label comes from', 'A company share represents part of a business that sells things and makes profits. A bond is a loan being repaid with interest. Both produce something.

Most cryptocurrencies produce nothing. Their price is simply what the next person will pay — which can be a lot, or nothing, with no underlying activity anchoring it.', 'text'),
  ('7281d4d8-c9a1-4b11-852d-e8786e75108b', 2, 'Its place on Tier 3''s spectrum', 'Tier 3 put crypto at the far end: an extremely wide range of outcomes, a short history, and a price driven by sentiment.

That''s not a moral judgement. It''s a description of the shape — the range is enormous in both directions, which is exactly what "high risk" means.', 'text'),
  ('7281d4d8-c9a1-4b11-852d-e8786e75108b', 3, 'The protections that don''t apply', 'This matters more than any argument about price:

The FSCS does not cover cryptoassets — and the FCA confirmed in 2026 that it will not be extended to them, even under the new regime
If a platform collapses while holding your crypto, there is no compensation scheme equivalent to the one protecting bank deposits

Tier 1 gave FSCS protection as a concrete reason banks are safer than cash. That protection stops at the edge of this.', 'text'),
  ('7281d4d8-c9a1-4b11-852d-e8786e75108b', 4, 'The scam density is unusually high', 'Irreversible transactions, no central authority, and heavy hype make crypto attractive to scammers — everything Tier 2 taught applies here at higher intensity.

Fake giveaways, "guaranteed returns", recovery scams aimed at people who''ve already lost money. Tier 3''s rule holds absolutely: high return with no risk does not exist.', 'text'),
  ('ad125743-e1fd-4023-9483-c17feba7f7da', 1, 'The age line', 'UK crypto platforms generally require you to be 18 or over and to verify your identity.

Anyone offering a way around that — trading on your behalf, using their account, "I''ll invest it for you" — is doing something that will not end with you keeping your money.', 'text'),
  ('ad125743-e1fd-4023-9483-c17feba7f7da', 2, 'What the regulator actually says', 'The FCA''s standing warning is blunt: be prepared to lose all the money you put in.

Not "some." That''s the official position of the body regulating this, published in plain language — and it''s a fair summary of the risk.', 'text'),
  ('ad125743-e1fd-4023-9483-c17feba7f7da', 3, 'It''s taxable, and it''s tracked', 'Profits can be subject to Capital Gains Tax, and from the 2026/27 tax year UK platforms report user transaction data to HMRC automatically.

Worth knowing simply because "nobody can see it" is a persistent myth, and an expensive one.', 'text'),
  ('ad125743-e1fd-4023-9483-c17feba7f7da', 4, 'Where this leaves you', 'You now understand what a blockchain is, why transactions can''t be reversed, why the price moves as it does, which protections don''t apply, and what the regulator says.

That''s genuinely enough to have a sensible conversation about it — and to recognise when someone talking to you about it is selling rather than explaining.', 'text'),
  ('ad125743-e1fd-4023-9483-c17feba7f7da', 5, 'What you''ve built, across all four tiers', 'You can see your whole financial picture, spot how prices and products are engineered to steer you, do the arithmetic underneath saving and borrowing, explain why compounding is slow and then sudden, name the biases shaping your own decisions, and write a program that does a real job.

That''s Sprig. Not advice about what to do with your money — the tools to work it out yourself.', 'text');

insert into questions (subtopic_id, tier, "order", question_type, question_text, options, correct_answer, accepted_answers, tolerance, explanation)
values
  ('4abf7146-935e-4e4a-8b9c-a7880dfd637c', 4, 1, 'text', 'What''s the name for the shared record that cryptocurrency transactions are stored on?', '[]'::jsonb, 'blockchain', '["blockchain","the blockchain","block chain"]'::jsonb, null, 'The blockchain — a copy of the record held by thousands of computers at once, all agreeing on it, rather than by a single record-keeper like a bank.'),
  ('4abf7146-935e-4e4a-8b9c-a7880dfd637c', 4, 2, 'mcq', 'How does a blockchain differ from a bank''s record of your account?', '["It''s stored in more secure data centres","There''s no single record-keeper — thousands of computers hold the record","It updates faster","It can only be read by the account holder"]'::jsonb, '1', null, null, 'Tier 1 established that a bank account is a record of what the bank owes you. Crypto replaces that one keeper with many, which is the genuine innovation — and the source of most of its other differences.'),
  ('4abf7146-935e-4e4a-8b9c-a7880dfd637c', 4, 3, 'mcq', 'Why is it called a chain?', '["Transactions must be processed in a fixed order","Each block contains a fingerprint of the one before it","Users are linked together in a network","Coins are passed along a chain of owners"]'::jsonb, '1', null, null, 'That linking is what makes old entries hard to alter — changing one would break every fingerprint after it, on thousands of machines at once. Genuinely clever engineering.'),
  ('4abf7146-935e-4e4a-8b9c-a7880dfd637c', 4, 4, 'mcq', 'The blockchain is well-designed technology. What does that tell you about whether a particular cryptocurrency is worth anything?', '["Well-designed technology means the coin has real value","Nothing — those are two separate questions","It means the price will rise over time","It guarantees the coin is safe to hold"]'::jsonb, '1', null, null, 'Two questions that get blurred constantly, usually by people who own some. The technology working as designed says nothing about what any given coin is worth.'),
  ('0fe181f9-2d30-45b8-b874-a94884c1ac83', 4, 1, 'mcq', 'What''s the most practically important difference between a crypto transaction and a card payment?', '["Crypto transactions are faster","Crypto transactions generally can''t be reversed","Crypto transactions have lower fees","Crypto transactions are anonymous"]'::jsonb, '1', null, null, 'Tier 1''s whole argument for banked money being safer than cash rested on records and reversibility. Send crypto to the wrong address or to a scammer and there is nobody to appeal to.'),
  ('0fe181f9-2d30-45b8-b874-a94884c1ac83', 4, 2, 'mcq', 'The Bank of England targets 2% inflation and adjusts rates to get there. What''s the equivalent for a cryptocurrency?', '["The exchange it''s traded on manages its value","There isn''t one — nobody manages its supply toward a goal","The developers adjust supply as needed","International agreements set a target range"]'::jsonb, '1', null, null, 'That''s the design, not an oversight. It''s also why the price can move violently — there''s no mechanism, and nobody with a mandate, to steady it.'),
  ('0fe181f9-2d30-45b8-b874-a94884c1ac83', 4, 3, 'mcq', 'Why does volatility make a cryptocurrency poor at being money?', '["It makes transactions slower","Money needs to be a stable measure of what things cost","It increases transaction fees","It prevents it being accepted by shops"]'::jsonb, '1', null, null, '£10 is £10 tomorrow. A coin worth £10 today might be £6 or £15 next month — which makes it hard to price anything in, regardless of what else it''s good for.'),
  ('0fe181f9-2d30-45b8-b874-a94884c1ac83', 4, 4, 'mcq', 'True or false: cryptocurrency in the UK is completely unregulated.', '["True","False"]'::jsonb, '1', null, null, 'It''s mid-transition. Parliament passed the cryptoasset regulations in February 2026 and the FCA finalised its rules in June 2026, with the full regime taking effect in October 2027. More regulated than it was, not yet fully regulated, and still changing.'),
  ('7281d4d8-c9a1-4b11-852d-e8786e75108b', 4, 1, 'mcq', 'Why are most cryptocurrencies described as "speculative"?', '["They''re difficult to buy","They produce nothing — the price is what the next person will pay","They''re only traded by professionals","Their prices change frequently"]'::jsonb, '1', null, null, 'A share represents part of a business making profits; a bond is a loan being repaid. Both produce something. Most coins don''t, which means nothing anchors the price.'),
  ('7281d4d8-c9a1-4b11-852d-e8786e75108b', 4, 2, 'mcq', 'Does the FSCS protect money you hold in cryptocurrency?', '["Yes, up to the standard deposit limit","No — and the FCA confirmed it will not be extended to cryptoassets","Only on FCA-registered platforms","Only for amounts under £1,000"]'::jsonb, '1', null, null, 'Tier 1 gave FSCS protection as a concrete reason banks are safer than cash. That protection stops at the edge of this — if a platform collapses holding your crypto, there''s no equivalent compensation scheme.'),
  ('7281d4d8-c9a1-4b11-852d-e8786e75108b', 4, 3, 'mcq', 'Why is scam density unusually high in crypto?', '["Users tend to be inexperienced","Irreversible transactions, no central authority, and heavy hype","It''s illegal in most countries","Platforms don''t verify identity"]'::jsonb, '1', null, null, 'Everything Tier 2 taught about scams applies here at higher intensity. Irreversibility in particular means the usual route to recovery — reporting it and getting it reversed — simply doesn''t exist.'),
  ('7281d4d8-c9a1-4b11-852d-e8786e75108b', 4, 4, 'mcq', 'Someone promises guaranteed high returns from a crypto investment with no risk. What should you conclude?', '["It''s worth researching further","It''s either misunderstood or dishonest — that combination doesn''t exist","It''s plausible if the platform is regulated","It depends on which coin it is"]'::jsonb, '1', null, null, 'Tier 3''s rule holds absolutely, and holds hardest here. If a guaranteed high return with no risk existed, everyone would move their money there and the return would immediately disappear.'),
  ('7281d4d8-c9a1-4b11-852d-e8786e75108b', 4, 5, 'multi', 'Which of these describe cryptocurrency''s risk profile?', '["An extremely wide range of possible outcomes","A short history compared with other assets","Prices driven heavily by sentiment","Protected by the same compensation scheme as bank deposits"]'::jsonb, '[0,1,2]', null, null, 'A, B and C. D is the one to be sure about — the FSCS does not cover cryptoassets, and that''s settled in the final rules rather than merely current practice.'),
  ('ad125743-e1fd-4023-9483-c17feba7f7da', 4, 1, 'mcq', 'What''s the FCA''s standing warning about investing in cryptocurrency?', '["Invest only what you can afford to lose half of","Be prepared to lose all the money you put in","Only invest through regulated platforms","Diversify across several different coins"]'::jsonb, '1', null, null, 'Not "some" — all. That''s the official position of the body regulating this, published in plain language, and it''s a fair summary of the risk rather than a legal formality.'),
  ('ad125743-e1fd-4023-9483-c17feba7f7da', 4, 2, 'mcq', 'Someone offers to buy and hold crypto on your behalf because you''re under 18. What''s actually happening?', '["A reasonable workaround while you''re too young","Something that will not end with you keeping your money","A legal arrangement if they''re a family member","A standard practice on most platforms"]'::jsonb, '1', null, null, 'UK platforms require you to be 18 or over and to verify your identity. Anyone offering a route around that is offering something with no protection and no recourse — you''d have no claim to the money at all.'),
  ('ad125743-e1fd-4023-9483-c17feba7f7da', 4, 3, 'mcq', 'True or false: cryptocurrency profits are invisible to HMRC.', '["True","False"]'::jsonb, '1', null, null, 'Profits can be subject to Capital Gains Tax, and from the 2026/27 tax year UK platforms report user transaction data to HMRC automatically. "Nobody can see it" is a persistent myth and an expensive one.'),
  ('ad125743-e1fd-4023-9483-c17feba7f7da', 4, 4, 'mcq', 'What''s the most useful thing to take from this topic?', '["Cryptocurrency should be avoided entirely","Enough understanding to have a sensible conversation, and to spot when someone is selling rather than explaining","A method for choosing which coins to buy","That crypto is the same as any other investment"]'::jsonb, '1', null, null, 'This topic is informational only — the point isn''t to tell you what to do, it''s that you''ll encounter this and understanding it beats picking it up from someone with an interest in your answer.');
