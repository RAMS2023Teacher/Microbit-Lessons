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
| `challenge` | `{title, prompt, levels: ["Bronze: …", "Silver: …", "Gold: …"], hints: {Bronze: [..], Silver: [..], Gold: [..]}, submit_prompt}` — open-ended and fun. Give each level 1–3 `hints`, each **≤ 20 words**, that nudge without solving it |
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

## Keep screens light (readability rules)

Students see one small piece of a lesson at a time, so keep each piece short.
Check your lesson with `python tools/readability_report.py --detail`. It counts
the words on every screen and estimates a reading grade level.

| Piece | Limit |
|---|---|
| Any one screen | **≤ 80 words**, reading grade **≤ 6.5** |
| Learn card | **≤ 60 words**, one idea, a `###` heading, short sentences, bullets over paragraphs. Most cards should have a `visual`. |
| Objectives | 3–4 items, **≤ 10 words** each, starting with a verb ("Wire an LED to pin 0") |
| Circuit step | **≤ 45 words** of instruction; `tip` and `check` one short sentence each |
| Code `walkthrough` explain / `try_it` idea | **≤ 20 words** each, at most 4 walkthrough items and 3 ideas |
| Quiz question + choices | **≤ 50 words** together; choices ≤ 10 words each |
| Challenge `prompt` | **≤ 35 words**; each level **≤ 25 words** |
| Debug `story` | **≤ 45 words** |

Write for a 6th grader: everyday words, one idea per sentence, and define a
technical word in the sentence where it first appears.

## Visual aids (`visual:`)

A Learn card can be plain Markdown, or a mapping with `text` and `visual`:

```yaml
learn:
  - text: |
      ### Pins are switches
      ...
    visual:
      type: compare
      items:
        - {icon: "💡", title: "write_digital(1)", text: "ON: 3 volts"}
        - {icon: "⚫", title: "write_digital(0)", text: "OFF: 0 volts"}
```

Quiz questions (`quiz[n].visual`) and the challenge (`challenge.visual`) can have one too.
Every visual can have a `caption` (≤ 14 words) and an `alt` (screen-reader text).
Pick the visual that shows the idea; a picture that only decorates doesn't help.

| type | shows | fields |
|---|---|---|
| `leds` | the micro:bit 5×5 display | `image: HEART` (a name, **quoted if it's "YES" or "NO"**) or a pattern `"09090:99999:99999:09990:00900"` (0-9 brightness per LED); or `frames: [...]` (up to 4) for an animation |
| `part` | one component, large, with labeled legs | `part:` led, resistor, button, ldr, potentiometer, transistor, diode, buzzer, servo, dcmotor, battery. Extras: `color` (led), `ohms` (resistor), `pins: [E, B, C]` + `label` (transistor), `label` (battery), `labels: {...}` to override a callout (e.g. `labels: {left: "3V", wiper: "P2", right: "GND"}` for a potentiometer) |
| `circuit` | a small breadboard picture, cropped to the parts used | `add: [...]`: the same parts and wires as circuit steps (checked by the validator) |
| `flow` | boxes and arrows | `steps: [{icon, label}]` (2-5, labels ≤ 26 characters), `loop: true` and `loop_label` to draw a repeat arrow |
| `wave` | PWM on/off signals and how bright they look | `duty: [10, 50, 100]` (percent), optional `values: [102, 512, 1023]` |
| `scale` | a number line, with zones or a mapping to a smaller range | `min`, `max`, `marks: [{at, label, pointer}]`, `zones: [{from, to, label, color}]`, `map: [0, 5]` + `map_label` |
| `compare` | 2-4 side-by-side cards | `items: [{icon, title, text}]` (text ≤ 12 words) |
| `bits` | a number in binary | `value`, `bits` (1-10) |
| `dial` | a servo angle | `marks: [{angle, label, pointer}]` (0-180) |
| `graph` | a line chart of readings | `points: [...]`, optional `line: {y, label}` for a threshold, `x_label`, `y_label`, `min`, `max` |

The validator checks every visual. Look at the lesson in a browser after adding one.
