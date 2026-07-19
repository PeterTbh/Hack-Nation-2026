# Intake Secretary agent — making the captured data actually reach the app

## Why the spoken-summary fix didn't take effect

Two rounds of prompt edits ("add a closing default-values note", "add a
default-values instruction") didn't change the agent's closing message — it
still ends with a natural-language "please check the information and end the
conversation" instead of anything the app can parse. Getting an LLM to
reliably recite one exact templated sentence, verbatim, as the very last
thing it says, turns out to be fragile in practice — it's easy for an
instruction like that to get lost among everything else the prompt already
asks the agent to do.

**We switched mechanisms instead of trying a third wording.** The app now
listens for a **client tool call** — a structured function call the agent
platform itself enforces, rather than a sentence it has to remember to say.
This is a hard platform mechanism, not a prompt suggestion: once the tool is
defined with required parameters, the agent calling it correctly is far more
reliable than reciting free text.

The spoken-summary parser and the Data Collection parser
(`lib/parse-intake-summary.ts`) are both still in place as fallbacks, but the
tool call below is now the primary, recommended path.

## What to configure in the ElevenLabs dashboard

### 1. Add a Client Tool to the agent

Agent settings → **Tools** → **Add tool** → type **Client**.

- **Name:** `submit_shipment_spec` (must match exactly — the app's code
  listens for this name)
- **Description:** "Call this once every shipment field has been gathered (or
  confirmed missing) from the user, to hand the completed spec to the app."
- **Parameters** (all type `string` except the three numeric ones — leave
  every one **required**, so the model is forced to supply a value, even if
  that value is the string `"not specified"`):

| Parameter | Type | Notes |
|---|---|---|
| `product_name` | string | |
| `origin` | string | city/place, not necessarily a port |
| `destination` | string | city/place, not necessarily a port |
| `weight_kg` | number | 0 if not specified |
| `pallet_count` | number | 0 if not specified |
| `cargo_value_eur` | number | 0 if not specified |
| `ready_date` | string | ISO-ish date, e.g. "2027-05-13"; "not specified" if unknown |
| `client_name` | string | "not specified" if not given |
| `cargo_description` | string | "not specified" if not given |
| `latest_arrival_date` | string | "not specified" if not given |
| `payment_terms` | string | "not specified" if not given |
| `benchmark_rate_usd` | number | 0 if not specified |
| `typical_transit_days` | string | "not specified" if not given |

### 2. Add ONE instruction to the existing system prompt

Don't change anything else. Add this as the very last paragraph:

```
Once you have gathered every field above (or the user could not provide a
specific one after being asked again — use "not specified" for text fields
and 0 for numeric fields in that case), call the submit_shipment_spec tool
with all parameters filled in. Call it exactly once, after your last question
to the user and before your closing remark. Never invent a value the user did
not give you.
```

That's the whole change: one tool definition + one paragraph appended to the
prompt you already have.

## Fallbacks that still work without any of the above

If the tool is never configured, the app falls back — in order — to:

1. A spoken **"SHIPMENT SPEC SUMMARY —"** line as the agent's last message
   (see the field list format further below), if your prompt happens to
   produce one.
2. ElevenLabs' post-call **Data Collection**, configured with one field per
   row in the table above, using the same parameter names as keys (Agent
   settings → Analysis → Data Collection).

Neither is required once the tool call above works — they're there so a
partially-configured agent still does something useful instead of failing
silently.

### Spoken summary format (fallback #1, optional)

```
"SHIPMENT SPEC SUMMARY — Product: [name]. Origin: [city]. Destination: [city].
Weight: [number] kg. Pallets: [number]. Cargo value: [number] EUR. Ready date:
[date]. Client: [company name, or 'not specified']. Cargo description: [text,
or 'not specified']. Latest arrival: [date, or 'not specified']. Payment
terms: [text, or 'not specified']. Benchmark rate: [number] USD, or 'not
specified'. Typical transit: [text, or 'not specified']."
```

Competing quotes are intentionally not part of either the tool schema or the
spoken summary — nested per-quote fields spoken in free-form speech are too
fragile to extract reliably. They stay editable in the confirmation form
after intake, same as today.
