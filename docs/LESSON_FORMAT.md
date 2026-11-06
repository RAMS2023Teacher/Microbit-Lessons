# Lesson file format

Each lesson is one YAML file in `lessons/`, named `NN-short-name.yaml`
(e.g. `03-blink-external-led.yaml`). The site picks up new files on restart.
`lessons/03-blink-external-led.yaml` is the reference example — copy it.

Check your work with:

```bash
python tools/validate_lessons.py
```

## Design rules

* **35 minutes.** `duration_minutes: 35`, and the `agenda` minutes must add up to 35.
  Typical split: warm-up 3, learn 4, circuit 9, code 7, debug 5, quiz 2, challenge 5.
  Lessons without a circuit give that time to code/challenge.
* Audience: middle school (grades 6–8), first time with Python and electronics.
  Short sentences, friendly tone, **bold** the key words. One big idea per lesson.
* Hardware assumed: micro:bit **V2**, edge-connector breakout, half-size breadboard.
  Code is MicroPython for micro:bit (`from microbit import *`). Use only APIs that exist
  in micro:bit MicroPython V2 (`display`, `Image`, `button_a/b`, `pin0..pin20`
  `.write_digital/.read_digital/.write_analog/.read_analog/.set_analog_period/.is_touched/.set_pull`,
  `accelerometer`, `compass`, `temperature()`, `sleep`, `running_time`, `music`, `radio`,
  `speaker`, `microphone`, `log`, `random`). Remember pins 3, 4, 6, 7, 9, 10 are shared with the LED display — prefer P0, P1, P2, P8, P12–P16.
* Safety: never 3V→GND directly; motors and servos get their own battery pack with a
  **shared ground**; DC motors need a transistor or motor driver plus a flyback diode
  (drivers usually have one built in) — never power a motor straight from a pin.

## Top-level keys

| key | notes |
|---|---|
| `id` | url slug, lowercase-with-dashes, unique |
| `unit` | 1 Light It Up · 2 Sensing the World · 3 Making Things Move · 4 Robots |
| `order` | position across the whole course (1–16) |
| `title`, `subtitle`, `level` | strings |
| `duration_minutes` | always 35 |
| `big_idea` | one sentence |
| `objectives` | list of 3–4 "students will…" phrases |
| `vocabulary` | list of `{term, definition}` |
| `materials` | list of strings |
| `agenda` | list of `{key, name, minutes}`; keys from warmup, learn, circuit, code, debug, quiz, challenge |
| `video` | `{title, note}` — the teacher pastes a video URL later in the site |
| `warmup` | `{prompt}` — a quick-write question, no wrong answers |
| `learn` | list of Markdown blocks (each one is a "card"; start with a `###` heading). Students see one card at a time, so keep each to one idea and about 60 words |
| `circuit` | optional; see below |
| `code` | `{intro, starter, walkthrough: [{lines, explain}], try_it: [..]}` — `starter` must be valid Python |
| `debug` | see below |
| `quiz` | 3–6 items `{question, choices: [..], answer: <0-based index>, explain}` |
| `challenge` | `{title, prompt, levels: ["Mild: …", "Medium: …", "Spicy: …"], submit_prompt}` — open-ended and fun |
| `teacher_notes` | Markdown: common problems, troubleshooting, extensions |
| `standards` | Massachusetts DLCS (2016) grade 6–8 standards: a list of `{code, how}`. `code` must be in `app/standards.yaml` (e.g. `6-8.CT.b.1`); `how` is one sentence on what in the lesson meets it. Only list standards the lesson really teaches or assesses. |

## `debug`

Students get broken code and must fix it. The server checks their fix **without
running it**, so write checks that look at the code text:

```yaml
debug:
  story: Markdown — who wrote it and what goes wrong
  buggy_code: |        # 1-3 realistic bugs (typos, case, missing sleep, wrong pin, bad indentation, = vs ==, wrong range)
  hints: [hint 1, hint 2]
  checks:
    - {type: syntax}                                    # code must parse
    - {type: contains, pattern: "regex", message: "shown when it fails"}
    - {type: not_contains, pattern: "regex", message: "..."}
  solution: |          # must pass all checks
  reflection_prompt: "What was the bug and how did you find it?"
```

Comments are stripped before `contains`/`not_contains` run. Patterns use Python
`re` with MULTILINE. In YAML double-quoted strings, escape backslashes (`"sleep\\("`).
The validator makes sure the **solution passes** and the **buggy code fails** at least one check.
Keep patterns tolerant of spacing (`\\s*`) and of other correct answers.

## `circuit`

```yaml
circuit:
  intro: text
  safety: [..]
  steps:
    - title: Short title
      instruction: Markdown — exactly what to do, naming the holes
      check: A yes/no question the student checks before moving on
      tip: optional
      add: [parts added in this step]
  verify:                 # validator proves these
    connected: [[mb.P0, r1.a], ...]       # all points in a list are on the same net
    not_connected: [[led1.anode, led1.cathode]]
```

The site draws each step on a virtual breadboard, highlighting the newly added parts.

### Addresses

* Breadboard holes `a1`–`j30`. Holes **a–e in one column are connected**; **f–j in one column are connected**; the center gap separates them.
* Rails: `T+1..T+30`, `T-1..T-30` (top red/blue), `B+1..B+30`, `B-1..B-30` (bottom). Each rail is one long strip.
* micro:bit breakout pins: `mb.3V`, `mb.GND`, `mb.P0`, `mb.P1`, `mb.P2`, `mb.P8`, `mb.P12`, `mb.P13`, `mb.P14`, `mb.P15`, `mb.P16`, `mb.P19`, `mb.P20`.
* Part terminals: `<id>.<terminal>`, e.g. `led1.anode`, `servo1.sig`.

Each hole holds one thing (one leg or one wire end). Pins and off-board terminals accept many wires.

### Parts that go in holes

| type | terminals | extra |
|---|---|---|
| `led` | `anode`, `cathode` | `color`: red/green/yellow/blue/white/orange |
| `resistor` | `a`, `b` | `ohms` |
| `button` | `a`, `b` | a 4-leg pushbutton is modeled by the two legs that switch; put them in two different columns of the same half (e.g. e20/e22) and tell students to straddle the gap |
| `ldr` | `a`, `b` | photoresistor |
| `diode` | `anode`, `cathode` | e.g. 1N4001; the stripe is the cathode |
| `capacitor` | `a`, `b` | `label` |
| `buzzer` | `plus`, `minus` | piezo |
| `potentiometer` | `left`, `wiper`, `right` | three adjacent columns |
| `transistor` | `collector`, `base`, `emitter` | `label` (e.g. 2N2222); say the pin order in the instruction |

### Parts that sit off the board (wires go to their terminals)

| type | terminals |
|---|---|
| `servo` | `sig`, `vcc`, `gnd` |
| `dcmotor` | `a`, `b` |
| `battery` | `plus`, `minus` (`label`, e.g. "4×AA 6V") |
| `module` | you list them: `terminals: [VCC, GND, OUT]`, plus `label: "IR line sensor"` |

Wires: `{type: wire, from: <address>, to: <address>, color: red}` — colors red, black,
blue, green, yellow, orange, white, purple, brown, gray. Convention: red = power,
black = ground, other colors = signals. A part must be added in the same or an
earlier step than any wire that uses its terminals.

The validator automatically rejects a part whose legs are shorted together and any
3V-to-GND short.
