-- Real Tier 4 content for Topic IV.I — Build a Budget Calculator (Python).
-- Same pattern as Tier 1/2/3: fixed UUIDs for topic/subtopic rows (safe to
-- re-run), slides/questions are a single-shot content load (no on-conflict
-- guard -- do not paste this file twice).

insert into topics (id, tier, "order", title, video_url)
values ('003efec0-640e-4bd6-98b3-c0580c74fc28', 4, 1, 'Build a Budget Calculator (Python)', null)
on conflict (id) do nothing;

insert into subtopics (id, topic_id, title, "order")
values
  ('cb317355-53a7-4e03-9d64-dce7b8376c08', '003efec0-640e-4bd6-98b3-c0580c74fc28', 'Setting Up: What the Calculator Should Do', 1),
  ('9affaed4-0b4c-4ed0-9d71-46c462e0e82f', '003efec0-640e-4bd6-98b3-c0580c74fc28', 'Writing the Core Logic', 2),
  ('9c054985-085b-4050-832d-46400ba35aa6', '003efec0-640e-4bd6-98b3-c0580c74fc28', 'Adding Categories and Totals', 3),
  ('e8c1290d-4cac-4086-851b-45aa428ae5c5', '003efec0-640e-4bd6-98b3-c0580c74fc28', 'Testing It With Real Numbers', 4)
on conflict (id) do nothing;

insert into slides (subtopic_id, "order", heading, body, slide_type)
values
  ('cb317355-53a7-4e03-9d64-dce7b8376c08', 1, 'What you''re going to build', 'A program that asks how much money you have coming in, asks what you''re spending it on, and tells you what''s left.

Everything you''ve done in Sprig so far, you''ve done on paper or in your head. This does the same job, except you built the tool.', 'text'),
  ('cb317355-53a7-4e03-9d64-dce7b8376c08', 2, 'You don''t need to know how to code', 'This assumes you''ve never written a line of anything. Every piece of code is shown in full and explained line by line.

Type it yourself rather than copying it. Typing is what makes it stick — and the typos you make along the way teach you more than clean code ever does.', 'text'),
  ('cb317355-53a7-4e03-9d64-dce7b8376c08', 3, 'Installing Python', 'Go to python.org, click Downloads, and it will offer the right version for your computer. Run the installer.

One thing that matters on Windows: the first installer screen has a checkbox reading "Add Python to PATH" or "Add python.exe to PATH". Tick it before clicking Install. Miss it and Python still installs, but your computer won''t be able to find it — which produces a confusing error much later, with no obvious cause. Mac users don''t have this step.', 'text'),
  ('cb317355-53a7-4e03-9d64-dce7b8376c08', 4, 'Where you''ll write the code', 'Python comes with a free editor called IDLE, installed alongside it. Nothing else to download.

Open it — on Windows, search "IDLE" in the Start menu; on Mac, look in Applications or search Spotlight.

You''ll see a window with >>> in it. That''s the shell, which runs one line at a time. Useful for quick tests, but we want to save files, which is the next step.

Fancier editors exist — VS Code, Thonny, PyCharm — and any of them work. IDLE is already on your machine, so start there.', 'text'),
  ('cb317355-53a7-4e03-9d64-dce7b8376c08', 5, 'Your first program', 'In IDLE, go to File → New File. An empty window opens.

Type exactly this into it:', 'text'),
  ('cb317355-53a7-4e03-9d64-dce7b8376c08', 6, 'Your first line of code', 'print("Hello, world!")', 'code'),
  ('cb317355-53a7-4e03-9d64-dce7b8376c08', 7, 'Save it and run it', 'Save with File → Save, naming it hello.py. The .py matters — it''s what tells the computer this is Python.

Then press F5 to run it. The shell window shows:

Hello, world!

That''s a program. A short one, but the process is identical for every program you will ever write: type it, save it, run it.', 'text'),
  ('cb317355-53a7-4e03-9d64-dce7b8376c08', 8, 'What print actually does', 'print is a function — a named piece of work someone else already wrote, which you use by typing its name.

The brackets ( ) hold what you''re giving it. The quote marks " " mean "this is text, not a command." So print("Hello, world!") means: take this text and show it on screen.

Get any of it wrong — a missing bracket, a missing quote — and Python complains rather than guessing. That''s a feature, not the language being difficult.', 'text'),
  ('9affaed4-0b4c-4ed0-9d71-46c462e0e82f', 1, 'Getting information from the person using it', 'A calculator that can''t be asked anything is just a message.

input() waits for someone to type something and press Enter. Try this in a new file:', 'text'),
  ('9affaed4-0b4c-4ed0-9d71-46c462e0e82f', 2, 'Try it: input and concatenation', 'name = input("What is your name? ")
print("Hello, " + name)', 'code'),
  ('9affaed4-0b4c-4ed0-9d71-46c462e0e82f', 3, 'What the = is doing', 'name = input(...) means: run input, take whatever comes back, and store it under the label name.

That label is a variable — a name for a piece of information so you can use it later. The = isn''t "equals" in the maths sense; it''s "put this in here."

The + glues two pieces of text together. That''s why there''s a space after "Hello," — without it you''d get Hello,Artem.', 'text'),
  ('9affaed4-0b4c-4ed0-9d71-46c462e0e82f', 4, 'The trap that catches everyone once', 'Now try this one. It looks reasonable and it does not work:', 'text'),
  ('9affaed4-0b4c-4ed0-9d71-46c462e0e82f', 5, 'The trap in code', 'age = input("How old are you? ")
print(age + 1)', 'code'),
  ('9affaed4-0b4c-4ed0-9d71-46c462e0e82f', 6, 'Why it crashed', 'You get TypeError: can only concatenate str (not "int") to str.

The reason: input() always hands back text, even when what you typed looked like a number. Python won''t add the number 1 to the text "14", because those are different kinds of thing and it refuses to guess which you meant.

This is the single most common error a beginner meets. Meeting it deliberately, with the explanation ready, beats meeting it alone at midnight.', 'text'),
  ('9affaed4-0b4c-4ed0-9d71-46c462e0e82f', 7, 'Turning text into a number', 'Wrap the input in int() for whole numbers, or float() for numbers with decimals:', 'text'),
  ('9affaed4-0b4c-4ed0-9d71-46c462e0e82f', 8, 'Fixed with int()', 'age = int(input("How old are you? "))
print(age + 1)', 'code'),
  ('9affaed4-0b4c-4ed0-9d71-46c462e0e82f', 9, 'Reading it inside out', 'Work from the innermost bracket outwards: input() runs first and asks the question, then int() converts what came back, then = stores the result.

Money needs decimals, so from here on it''s float() rather than int().', 'text'),
  ('9affaed4-0b4c-4ed0-9d71-46c462e0e82f', 10, 'The core of the calculator', 'Two questions and one subtraction. This is Tier 2''s entire budgeting idea, in five lines:', 'text'),
  ('9affaed4-0b4c-4ed0-9d71-46c462e0e82f', 11, 'The core calculator', 'income = float(input("How much money comes in? "))
spending = float(input("How much money goes out? "))

left = income - spending

print("You have", left, "left over.")', 'code'),
  ('9affaed4-0b4c-4ed0-9d71-46c462e0e82f', 12, 'Try it', 'Run it. Enter 40, then 25.

It prints: You have 15.0 left over.

Money in, money out, look at the gap — the same thing Tier 2 said was the only number that matters, now calculated by something you wrote.', 'text'),
  ('9c054985-085b-4050-832d-46400ba35aa6', 1, 'Making the output look like money', '15.0 isn''t how money is written. Replace the last line of your program with this:', 'text'),
  ('9c054985-085b-4050-832d-46400ba35aa6', 2, 'Formatting it as money', 'print(f"You have £{left:.2f} left over.")', 'code'),
  ('9c054985-085b-4050-832d-46400ba35aa6', 3, 'Decoding that line', 'It now prints You have £15.00 left over. Three new things are doing that:

The f before the quote mark makes it an f-string — Python looks inside for { } and substitutes values in
{left} means "put the value of left here"
:.2f means "show it as a number with exactly two decimal places"

So £{left:.2f} reads: a pound sign, then the value of left, to two decimal places.', 'text'),
  ('9c054985-085b-4050-832d-46400ba35aa6', 4, 'One spending total isn''t enough', 'Real spending has parts — transport, food, subscriptions.

To store several named amounts you need a dictionary: a set of labels, each with a value attached. Try this on its own first:', 'text'),
  ('9c054985-085b-4050-832d-46400ba35aa6', 5, 'Dictionaries, on their own', 'categories = {}
categories["Transport"] = 12
categories["Snacks"] = 8
print(categories["Transport"])', 'code'),
  ('9c054985-085b-4050-832d-46400ba35aa6', 6, 'What that did', '{} creates an empty dictionary. Each line after it adds a label and its amount. The last line looks up Transport and prints 12.

A dictionary is the right tool whenever you have names attached to values — exactly what a budget is.', 'text'),
  ('9c054985-085b-4050-832d-46400ba35aa6', 7, 'Asking for them instead of typing them in', 'You don''t want to edit the code every time your spending changes.

A loop repeats a block of instructions until told to stop:', 'text'),
  ('9c054985-085b-4050-832d-46400ba35aa6', 8, 'Asking in a loop', 'categories = {}

while True:
    name = input("Category name (or press Enter to finish): ")
    if name == "":
        break
    amount = float(input(f"How much for {name}? "))
    categories[name] = amount', 'code'),
  ('9c054985-085b-4050-832d-46400ba35aa6', 9, 'How that loop works, and why the spaces matter', 'while True: means "keep going." if name == "": checks whether they pressed Enter without typing anything, and break stops the loop when they did.

The indentation is not decoration. In Python, those four spaces are how the language knows which lines are inside the loop and which come after it. Get them wrong and the program breaks or does something you didn''t ask for. IDLE indents automatically after a line ending in :.', 'text'),
  ('9c054985-085b-4050-832d-46400ba35aa6', 10, 'Adding it all up', 'for name in categories: walks through every label in turn, so you can total them.

Here''s the finished calculator — save it as budget.py:', 'text'),
  ('9c054985-085b-4050-832d-46400ba35aa6', 11, 'budget.py, the finished calculator', 'income = float(input("How much money comes in? "))

categories = {}

while True:
    name = input("Category name (or press Enter to finish): ")
    if name == "":
        break
    amount = float(input(f"How much for {name}? "))
    categories[name] = amount

total_spent = 0
for name in categories:
    total_spent = total_spent + categories[name]

print("")
print("--- Your budget ---")

for name in categories:
    print(f"{name}: £{categories[name]:.2f}")

print(f"Total spent: £{total_spent:.2f}")
print(f"Money left over: £{income - total_spent:.2f}")', 'code'),
  ('9c054985-085b-4050-832d-46400ba35aa6', 12, 'A shortcut, now that you''ve done it the long way', 'Those three lines that total everything up can be replaced by one:

total_spent = sum(categories.values())

It does exactly the same job. Worth writing the loop first, though — the shortcut only makes sense once you can see what it''s replacing, and plenty of problems have no shortcut available.', 'text'),
  ('e8c1290d-4cac-4086-851b-45aa428ae5c5', 1, 'Test it against something you can check', 'Run it with income 50, then Transport 12, Snacks 8, Subscriptions 5.

Work out the answer by hand first: 12 + 8 + 5 = 25, so 25 left over. Then check the program agrees.

Predicting the answer before you look is the actual skill. A program that runs isn''t the same as a program that''s right, and the only way to tell them apart is to already know what it should say.', 'text'),
  ('e8c1290d-4cac-4086-851b-45aa428ae5c5', 2, 'Try to break it', 'Now deliberately do the awkward things:

Type a category name but leave the amount blank — it crashes
Type twelve instead of 12 — it crashes with ValueError
Press Enter immediately at the first category — total is 0, everything''s left over

The first two crash because float() can''t convert those into numbers. That''s not exactly a bug in your code — it''s an unhandled case, which is a completely normal thing for a first program to have.', 'text'),
  ('e8c1290d-4cac-4086-851b-45aa428ae5c5', 3, 'Spending more than you have', 'Run it again with income 20 and 35 of spending.

You get: Money left over: £-15.00

Negative, and correct. That''s Tier 2''s point that the gap is the only number that matters — and the program states it plainly, which is more than most people''s mental arithmetic does.', 'text'),
  ('e8c1290d-4cac-4086-851b-45aa428ae5c5', 4, 'Making it say so', 'A negative number is easy to skim past. Add this to the very end of the file:', 'text'),
  ('e8c1290d-4cac-4086-851b-45aa428ae5c5', 5, 'Flagging a negative balance', 'if income - total_spent < 0:
    print("Careful — you are spending more than you have coming in.")', 'code'),
  ('e8c1290d-4cac-4086-851b-45aa428ae5c5', 6, 'How if works', 'if runs the indented line underneath it only when the condition is true. When the gap isn''t negative, Python skips straight past it.

Same indentation rule as the loop: the four spaces are what mark the line as belonging to the if.', 'text'),
  ('e8c1290d-4cac-4086-851b-45aa428ae5c5', 7, 'What you''ve actually done', 'You installed a programming language, wrote a program from nothing, hit real errors and understood why they happened, and built a tool that does a genuine job.

You now know variables, input, type conversion, f-strings, dictionaries, loops, and if. That''s most of the basic vocabulary of programming — not a tour of it, but the working parts, used for something real.', 'text');

insert into questions (subtopic_id, tier, "order", question_type, question_text, options, correct_answer, accepted_answers, tolerance, explanation)
values
  ('cb317355-53a7-4e03-9d64-dce7b8376c08', 4, 1, 'mcq', 'When installing Python on Windows, there''s a checkbox on the first installer screen reading "Add Python to PATH." What happens if you don''t tick it?', '["Python won''t install at all","Python installs, but your computer can''t find it when you try to run it","Python installs without the IDLE editor","Nothing — it''s optional either way"]'::jsonb, '1', null, null, 'It installs fine, which is what makes this confusing: the failure shows up later, with no obvious connection to the checkbox. Mac users don''t have this step at all.'),
  ('cb317355-53a7-4e03-9d64-dce7b8376c08', 4, 2, 'mcq', 'What is IDLE?', '["A website where you run Python in your browser","A free code editor that comes bundled with Python","A separate program you download after installing Python","The name of Python''s programming language version"]'::jsonb, '1', null, null, 'It installs alongside Python itself, so there''s nothing extra to download. Other editors exist — VS Code, Thonny, PyCharm — but IDLE is already on your machine.'),
  ('cb317355-53a7-4e03-9d64-dce7b8376c08', 4, 3, 'mcq', 'Why does a Python file need to be saved with .py at the end of its name?', '["It makes the file smaller","It''s what tells the computer the file is Python","Python won''t let you save it otherwise","It stops other programs from opening the file"]'::jsonb, '1', null, null, 'The extension is how the computer knows what kind of file it''s looking at. Save the same code as budget.txt and it''s just text — nothing will run it.'),
  ('cb317355-53a7-4e03-9d64-dce7b8376c08', 4, 4, 'mcq', 'In the line print("Hello, world!"), what are the quote marks doing?', '["Making the text appear in bold","Marking the text as text, rather than as a command","Separating the text from the brackets","They''re optional and can be left out"]'::jsonb, '1', null, null, 'Without them, Python would try to interpret Hello, world! as instructions and fail. The quotes say: don''t read this, just show it.'),
  ('9affaed4-0b4c-4ed0-9d71-46c462e0e82f', 4, 1, 'text', 'What''s the programming term for a name that stores a piece of information so you can use it later?', '[]'::jsonb, 'variable', '["variable","a variable","variables"]'::jsonb, null, 'A variable. The = sign that creates one doesn''t mean "equals" in the maths sense — it means "put this in here."'),
  ('9affaed4-0b4c-4ed0-9d71-46c462e0e82f', 4, 2, 'mcq', 'What kind of thing does input() always give back?', '["A number","Text, even if what was typed looked like a number","Whatever type was typed","It depends on the question asked"]'::jsonb, '1', null, null, 'This is the single most common trip-up for beginners. Type 14 and you get the text "14", not the number 14 — which is why adding 1 to it fails.'),
  ('9affaed4-0b4c-4ed0-9d71-46c462e0e82f', 4, 3, 'mcq', 'A student writes age = input("How old are you? ") and then print(age + 1). It crashes with a TypeError. Why?', '["print can only display one thing at a time","You can''t add the number 1 to text","The variable name age is reserved by Python","input() needs a number as its question"]'::jsonb, '1', null, null, 'input() handed back text, and Python refuses to guess whether you meant to do maths or join two pieces of text together. It errors rather than picking one — which is a feature, not the language being awkward.'),
  ('9affaed4-0b4c-4ed0-9d71-46c462e0e82f', 4, 4, 'text', 'Which function converts text into a number that can have decimal places?', '[]'::jsonb, 'float', '["float","float()","the float function"]'::jsonb, null, 'float(). Use int() when you only want whole numbers — but money needs decimals, so a budget calculator uses float() throughout.'),
  ('9affaed4-0b4c-4ed0-9d71-46c462e0e82f', 4, 5, 'mcq', 'In the line age = int(input("How old are you? ")), what runs first?', '["int(), then input()","input(), then int(), then the storing","The storing, then input(), then int()","All three happen simultaneously"]'::jsonb, '1', null, null, 'Read nested brackets from the inside out. input() asks the question, int() converts what came back, and only then does = store the result.'),
  ('9c054985-085b-4050-832d-46400ba35aa6', 4, 1, 'mcq', 'In print(f"You have £{left:.2f} left over."), what does the f before the quote mark do?', '["Formats the number as a float","Tells Python to look inside for { } and substitute values in","Stands for \"final,\" marking the last line","Forces the text onto a new line"]'::jsonb, '1', null, null, 'It makes it an f-string. Without the f, Python would print the characters {left:.2f} literally rather than the value stored in left.'),
  ('9c054985-085b-4050-832d-46400ba35aa6', 4, 2, 'mcq', 'What does :.2f do inside an f-string?', '["Rounds the number to 2 significant figures","Displays it with exactly 2 decimal places","Multiplies the number by 2","Converts the number to text"]'::jsonb, '1', null, null, 'It''s what turns 15.0 into 15.00 — which matters when you''re showing money, since £15.0 doesn''t look like a price.'),
  ('9c054985-085b-4050-832d-46400ba35aa6', 4, 3, 'mcq', 'What is a dictionary used for in Python?', '["Checking the spelling of words","Storing labels with values attached to them","Storing a list of numbers in order","Translating between programming languages"]'::jsonb, '1', null, null, 'Labels with values is exactly the shape a budget has — "Transport" attached to 12, "Snacks" attached to 8. That''s why it''s the right tool here.'),
  ('9c054985-085b-4050-832d-46400ba35aa6', 4, 4, 'mcq', 'In Python, what does indentation (the spaces at the start of a line) actually do?', '["Nothing — it just makes code easier to read","It tells Python which lines are inside a loop or an if","It marks lines as comments","It''s required only in files, not in the shell"]'::jsonb, '1', null, null, 'Python is one of the few languages where whitespace changes meaning. Get the indentation wrong and the program either breaks or quietly does something you didn''t ask for. IDLE indents automatically after a line ending in :.'),
  ('9c054985-085b-4050-832d-46400ba35aa6', 4, 5, 'mcq', 'In a loop that keeps asking for category names, what does break do?', '["Crashes the program deliberately","Skips to the next time round the loop","Stops the loop and carries on with the rest of the program","Deletes everything entered so far"]'::jsonb, '2', null, null, 'It''s the exit. while True: would otherwise run forever — break is what lets pressing Enter on an empty line end the questioning and move on to the totals.'),
  ('e8c1290d-4cac-4086-851b-45aa428ae5c5', 4, 1, 'mcq', 'Before running your finished calculator with test numbers, why work out the expected answer by hand first?', '["To check the program runs without crashing","Because a program that runs isn''t the same as a program that''s right","Because Python rounds differently to a calculator","It isn''t necessary if the code has no errors"]'::jsonb, '1', null, null, 'If you don''t already know what it should say, you can''t tell a correct answer from a confident wrong one. Predicting first is what turns "it ran" into "it works."'),
  ('e8c1290d-4cac-4086-851b-45aa428ae5c5', 4, 2, 'num', 'A budget calculator is given income of 50, and spending of 12, 8 and 5. How many pounds does it report as left over?', '[]'::jsonb, '25', null, null, '12 + 8 + 5 = 25 spent, and 50 − 25 = 25 left. Working this out by hand before running it is the whole point of the test.'),
  ('e8c1290d-4cac-4086-851b-45aa428ae5c5', 4, 3, 'mcq', 'You type twelve instead of 12 when the calculator asks for an amount, and it crashes with a ValueError. What does this tell you?', '["There''s a bug in your code that needs fixing immediately","It''s an unhandled case — normal for a first program","float() is the wrong function to use","The program needs to be rewritten from scratch"]'::jsonb, '1', null, null, 'float() genuinely can''t turn the word "twelve" into a number, so it stops rather than guessing. Handling that properly needs try/except, which roughly doubles the concepts involved — a first program having rough edges is expected.'),
  ('e8c1290d-4cac-4086-851b-45aa428ae5c5', 4, 4, 'mcq', 'What does if income - total_spent < 0: do?', '["Sets the leftover amount to zero when spending is too high","Runs the indented line beneath it only when spending exceeds income","Prevents the user entering more spending than income","Displays an error message and stops the program"]'::jsonb, '1', null, null, 'if is a gate, not a fix. When the condition isn''t true, Python skips straight past the indented line — the program carries on either way.');
