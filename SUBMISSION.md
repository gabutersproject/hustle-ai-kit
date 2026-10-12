# Sawhorse: a quoting desk that isn't allowed to invent a price

# What I Built

Sawhorse is a quoting desk for a one-person custom furniture shop.

A maker gets a text like this: "We just bought a place in Catskill. Table for six, maybe eight with a leaf. Walnut if it's not crazy, otherwise white oak. My partner hates glossy finishes. Before Thanksgiving if that's even possible. Budget is around 4–5k. We're about 40 minutes from Hudson."

The tedious part is not writing a polite reply. It is turning that note into hours, board feet, and an honest no. At this shop's rate card, black walnut is $5,592. White oak is $4,438. Thanksgiving falls inside a 10 to 14 week lead time, so the letter says that date is not a promise.

The person who pays is an independent furniture maker, or the same kind of one-person shop in another trade: someone who already has a rate card, quotes from messy client texts, and does not want that text or those rates in a chatbot. A $40/month proposal tool still does not know a trestle base from a pedestal. Pasting the note into a general model produces a retail-shaped number the shop cannot build for.

The sample shop is Mara Ellison Studio in Hudson, New York. Her card is $85 an hour, white oak at $14 a board foot, walnut at $32, and delivery zones for town, the mid-Hudson, and New York City. Two other notes are built in: Jonah's hard-maple desk with a cable hole, which lands at $1,913 against a $2,000 ceiling, and Andre's four-foot bookshelf to Brooklyn, which comes in at $1,837 against "under fifteen hundred."

## Demo

Sawhorse runs on the shop machine. A public hosted demo would send the client note off that machine, which is the thing the product refuses to do.

The walkthrough is Priya's note, from paste to priced letter: the model read, the ticket you can correct, then white oak marked as the one to send because walnut is over the range. Upload that recording with this post.

On a machine with the weights downloaded, `pnpm dev` serves the desk at `http://127.0.0.1:43123`. A short note usually reads in under a minute on a 4-core CPU with no GPU. You can change any field on the ticket before a dollar is calculated. The rate card and the glossary are editable. Saved tickets stay in a JSON file next to the app.

## Code

This project does not have a public GitHub repository yet. After you create one, embed it here:

```liquid
{% github YOUR_NAME/sawhorse %}
```

The split that matters:

- `engine/reader.py` asks the model for a job ticket. The JSON schema has a client, a piece, woods, a finish, a delivery zone, a budget, and the client's own words for the deadline. It has no price field.
- `engine/pricer.py` is ordinary arithmetic. Lumber is board feet times the species rate. Labor is hours times the shop rate. Delivery is a zone fee. A design drawing is added and, if the shop says so, credited back.
- `engine/letter.py` may print a dollar amount only after that math. A test fails if the letter contains any dollar figure that is not on the ticket.
- `data/pricebook.default.json` is Mara's rate card. Edits and saved quotes stay in `data/` on the machine and are not part of the repo.

```python
# engine/reader.py — the grammar the model is held to
properties = {
    "client_name": {"type": "string"},
    "piece": {"type": "string", "enum": pieces},
    "species_primary": {"type": "string", "enum": species + ["unspecified"]},
    "species_alternate": {"type": "string", "enum": species + ["none"]},
    "finish": {"type": "string", "enum": finishes + ["unspecified"]},
    "delivery": {"type": "string", "enum": zones + ["unspecified"]},
    "budget_low": {"type": "integer"},
    "budget_high": {"type": "integer"},
    "deadline_raw": {"type": "string"},
    # no price, no hours, no board feet
}
```

## How I Built It

The open-weight model is [Qwen2.5-1.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF), quantized Q5_K_M, Apache-2.0, about 1.2 GB. Inference is [llama.cpp](https://github.com/ggml-org/llama.cpp) through `llama-cpp-python`, on CPU. There is no API key.

`create_chat_completion` is called with `response_format` set to a JSON schema. llama.cpp compiles that schema into a grammar, so the reply cannot leave the ticket shape. The prompt lists piece ids, wood ids, finish ids, delivery zones, and the shop glossary. It does not include the hourly rate or the lumber prices. "Catskill" means the mid-Hudson zone. "Hates glossy" means hardwax oil. "Hard maple" means maple. The model cannot anchor on a number it was never shown.

A 1.5 billion parameter model still copies the shape of its examples. After the read, `apply_note_guards` fixes two high-confidence misses: if the word "leaf" is in the note, the ticket includes a leaf; if the note says the room is "9 feet by 11" and the model copies 9 and 11 into the furniture dimensions, those values are dropped, because that was the room. The maker still sees every field and can change it before pricing.

The desk is a Next.js app. A FastAPI process on localhost holds the weights. The browser talks only to Next, and Next proxies to that process, so a read never leaves the machine. The glossary is the niche list a shop will actually edit: towns, finish phrases, species nicknames. The next note uses it. The same weights can take a LoRA later, trained on quotes the shop really sent.

## Why Does Open Innovation Matter?

A frontier API would read one of these notes for less than a cent. That is not the bill that breaks a shop quoting fifteen small jobs in a month.

What breaks it is a wrong number, or a leaked one. A general chat model asked to "quote this walnut table" reaches for retail: a round number and a confident email, at a price the shop cannot build for. Sending that loses the job or gives away the margin. The same model does not know that Catskill is about forty minutes from this shop. You can paste a glossary into a hosted prompt. You also paste the client's town, their budget, and sometimes why they need the table by a certain Thursday. In a town this size that note is not anonymous, and the rate card is the business.

The open weight file is what makes the stricter design possible. llama.cpp will bind the reply to a grammar with no price field. The prompt is not given the rates, so there is nothing for the model to repeat. The weights are Apache-2.0, so the desk can be sold without renting the brain. They are small enough that a shop laptop with no GPU can run them. If the app disappeared, the rate card and the saved tickets would still be JSON files, and the model would still be a file beside them. Nobody gets to reprice the inference out from under a $4,000 job.

The glossary is not a fine-tune. It is the adjustment a one-person shop will keep. A closed API does not hand you the weights to train later, and it does not hand you a grammar that forbids a price.

## My Agent Session

I built Sawhorse in a Cursor cloud agent session:

https://cursor.com/agents/bc-020ab737-7d81-408c-8afc-5fa949413689

After you save that transcript with DevRelay and make the session public, replace the link with:

```liquid
{% agent_session YOUR_SESSION_SLUG %}
```

A private session only embeds for the owner. Judges need the public one.
