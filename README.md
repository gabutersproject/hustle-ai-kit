# Sawhorse

Sawhorse is a quoting desk for a one-person furniture shop. Paste a client note. An open-weight model on this machine reads it into a job ticket. The shop's rate card, not the model, sets every dollar.

The sample shop is Mara Ellison's, in Hudson, New York. Priya writes from Catskill about a dining table, walnut if it fits, otherwise white oak, no gloss, before Thanksgiving, four to five thousand dollars. Sawhorse prices both woods from Mara's hours and board feet, recommends the one that lands in the budget, and says plainly that Thanksgiving is inside a 10 to 14 week lead time.

## Why the open model is the product

Qwen2.5-1.5B-Instruct (Q5_K_M, Apache-2.0) runs in [llama.cpp](https://github.com/ggml-org/llama.cpp) through `llama-cpp-python`. No API key. The reply is constrained to a JSON schema that has no price field, and the prompt does not include the hourly rate or the lumber prices. A general chat model, asked to "quote this table," reaches for retail prices and writes a number the shop cannot build for. It also does not know that Catskill is a forty-minute delivery, or that "not glossy" in this shop means hardwax oil.

A frontier API would read one note for less than a cent. That is not the bill that matters. The rate card is the margin, the note often includes a home and a budget, and a $40/month proposal tool still doesn't know a trestle from a pedestal. The weights are a file. The quotes are a JSON file. Electricity is the inference cost, on a machine with no GPU.

The glossary is the niche adjustment a shop will actually maintain. The same open weights can take a LoRA later. A closed API does not hand you either.

## Run it

You need Node 22, pnpm, Python 3.12, and a C++ toolchain if `llama-cpp-python` has no wheel for your platform (this repo was built with CMake).

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
bash scripts/download_model.sh
pnpm install
pnpm dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). The first start loads about 1.2 GB of weights into memory. Reading a note usually takes well under a minute on a 4-core CPU.

`pnpm test` checks the rate card math, the lead-time calendar, and the rule that every dollar in the letter comes from the ticket.

The model file is not in git. `scripts/download_model.sh` fetches `Qwen/Qwen2.5-1.5B-Instruct-GGUF` (`qwen2.5-1.5b-instruct-q5_k_m.gguf`).

Quotes and edits to the rate card stay in `data/` on this machine. Restore Mara's sample from the rate card page.
