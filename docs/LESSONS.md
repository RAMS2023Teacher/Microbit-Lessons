# Writing a lesson

One YAML file per lesson in `course/lessons/`, named like `06-dodge-the-drop.yaml`. The lesson's number, icon, color,
Python idea and hardware come from its row in `course/rules.py` (`COURSE`). `python tools/build.py` checks every lesson
and refuses to build if something is missing. `course/lessons/06-dodge-the-drop.yaml` is the model to copy.

Text fields are Markdown: `**bold**`, `` `code` ``, lists.

```yaml
id: dodge-the-drop              # must match a row in rules.COURSE
title: Dodge the Drop
tagline: Tilt to dodge the falling raindrops
minutes: 90

mission:
  big_question: How do games keep running until something happens?   # ≤ 15 words: the enduring understanding, shown as the class display's question of the day
  goal: What they'll build, in 2-3 sentences (≤ 70 words)
  picture: {type: leds, frames: [...]}       # optional: any visual (leds, part, circuit, compare...)
  you_need: [A partner, A micro:bit and USB cable]
  learn: ["**while loops** repeat as long as something is True"]
  talk: A question to talk over with their partner (they write what they decided)

build:                          # 3-16 steps, one per screen
  - part: "Part 1: Warm-ups"    # optional group label (shown above the title, and as a divider in the step dots)
    title: A loop that counts
    say: The one idea for this step (≤ 80 words)
    wiring: [{text: "Clip **3V** to the VCC row"}]   # optional: wiring steps (marks the lesson as a circuit lesson)
    breadboard:                                      # optional: a wiring picture under the wiring steps (see "Wiring pictures")
      add: [...]
    do: [Type this code exactly., Run it and check the boxes.]
    code: |
      count = 0
      while count < 5:
          basic.show_number(count)
          count += 1
    new: "2-4"                  # optional: lines to highlight as new (like the yellow lines in the slides)
    what: What the code does
    tip: A "watch out" note
    stuck: [Things to check when it doesn't work]
    test: [It shows 0, 1, 2, 3, 4]               # 1-4 checkboxes: the step counts when all are ticked
    fields: [Tilt left, Flat, Tilt right]        # optional small blanks to fill in
    ask: One question (≤ 40 words); they must answer it to go on

quiz:                           # 3-6 questions; pass at 75%
  - question: Which way does `player.change(LedSpriteProperty.X, -1)` move?
    choices: [Left, Right, Up, Down]
    answer: 0                   # 0-based
    why: Shown after they answer

ship:
  extensions:                   # they must add at least one
    - title: Press A to start
      level: Easier             # Easier, Medium or Challenge
      goal: ...
      where: Where the code goes
      code: |
        ...
      new: "1-3"
      hints: [...]
  reflect: [1-3 questions they answer before shipping]

teacher_notes: |
  Shown only to the teacher, with the quiz answers.
standards:
  - code: 6-8.CT.b.1            # MA DLCS codes from course/standards.yaml
    how: What in the lesson meets it
```

MakeCode Python, not MicroPython: `basic.show_string`, `basic.pause`, `input.button_is_pressed(Button.A)`,
`pins.digital_write_pin(DigitalPin.P0, 1)`, `game.create_sprite`, `music.play_tone`.

## 6th grade: MakeCode Blocks

6th grade lessons live in `course/lessons/g6/` (plan: `COURSE_6` in `course/rules.py`). Students build with
**MakeCode Blocks** on the micro:bit, so steps use `blocks:` instead of `code:`. The site draws them as colored
MakeCode-style blocks. Write the block text the way it reads in the editor:

```yaml
    blocks: |
      on start:
        show icon [heart]
        set [score] to [0]
      on button [A] pressed:
        change [score] by [1]
        show number (score)
      forever:
        if (button [B] is pressed) then:
          {music} play tone [Middle C] for [1 beat]
        else:
          clear screen
        pause (ms) [100]
    new: "2-3"
```

- One block per line, **2 spaces** of indent per level. A line ending in `:` holds the indented lines below it
  (`on start:`, `forever:`, `on button [A] pressed:`, `repeat [4] times:`, `if (…) then:`, `else:`, `while (…):`).
- `[x]` is a value students type or pick from a dropdown (numbers, text, icons, notes). `(x)` is a round or
  pointy block that snaps into a slot (`(pick random [1] to [3])`, `(acceleration (mg) [x])`, `(score)`).
- The color comes from the first words (show/pause/clear → Basic, on button/on shake/acceleration → Input,
  repeat/while → Loops, if/else → Logic, set/change → Variables, play/tone → Music, plot/unplot → Led,
  radio → Radio, sprite/game over/score → Game, pick random → Math, ML → Machine learning). When it could be
  wrong, start the line with the drawer name in braces: `{game} change [player] [x] by [1]`.
  Drawers: basic, input, music, led, radio, loops, logic, variables, math, game, functions, ml, text.
- `new:` highlights lines, like the Python lessons.


## Wiring pictures (`breadboard:` on a build step)

Any step with `wiring:` can have a picture of the breadboard, drawn by `apps_script/client/lib/breadboard.js`.
Every picture is checked when the site is built (`course/circuits.py`): parts must sit in real holes, nothing may be
shorted, and each group in `check` must really be connected. A wrong picture stops the build.

```yaml
    breadboard:
      before:                      # optional: parts built in an earlier step (drawn dimmed)
        - {type: wire, color: black, from: mb.GND, to: T-1}
      add:                         # this step's parts (they glow when there is a `before`)
        - {type: wire, color: green, from: mb.P0, to: e5}
        - {type: resistor, id: r1, ohms: 220, a: c5, b: c9}
        - {type: led, id: led1, color: red, anode: a9, cathode: T-10}
      check: [[mb.P0, r1.a], [r1.b, led1.anode], [led1.cathode, mb.GND]]   # groups that must be connected
      caption: "A sentence under the picture."
      board: false                 # optional: no breadboard (clips or wires straight to the pins)
      mb_title: "micro:bit pins"   # optional: the label on the pin block
```

Addresses: holes `a1`..`j30` (the number is the row number printed on the breadboard; `a`-`e` in a row are joined, and
`f`-`j`), rails `T+1`, `T-1`, `B+1`, `B-1` (each rail is one long strip), micro:bit pins `mb.3V`, `mb.GND`, `mb.P0`,
`mb.P1`, `mb.P2`, `mb.P8`, `mb.P12`..`mb.P16`, `mb.P19`, `mb.P20`, and a part's legs as `id.leg`.

Parts on the board: `led` (anode, cathode, color), `resistor` (a, b, ohms), `button` (a, b), `ldr`, `diode`,
`capacitor`, `buzzer` (plus, minus), `potentiometer` (left, wiper, right), `transistor`, `hcsr04` (vcc, trig, echo,
gnd: the distance sensor). Parts beside the board: `servo` (sig, vcc, gnd), `dcmotor`, `battery` (plus, minus) and
`module` (give a `label` and a `terminals` list). Wire colors: red, black, blue, green, yellow, orange, white, purple,
brown, gray.

`fields_prompt: "Look at the picture. Write…"` on a step with a `picture` and `fields` puts the blanks in a box right under the picture, with that sentence as its heading (otherwise blanks go after the tests).

Picture type `tilt` draws a micro:bit leaning left, flat and right over a number line from -1023 to 1023 (for the accelerometer). Add `threshold: 300` and `zones: [left, middle, right]` to show the zones an `if` uses.

### Two kits on every wiring picture

Students pick **My kit** above a wiring picture (remembered on their device):

- **Breakout board**: the SparkFun micro:bit Breakout (BOB-13989) plugged into the breadboard. It is one row of 22 pins
  in holes `j1`-`j22`, in this order: GND, GND, 3V3, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20
  (taken from SparkFun's board files). A wire written `from: mb.P0` is drawn starting in another hole of P0's row.
  Because of this, a picture may not put parts or wires in holes `f`-`j` of rows 1-22; the build stops if one does.
- **Alligator clips**: clips on the micro:bit's five big pins (0, 1, 2, 3V, GND). Offered when the step only uses
  those pins. Pictures with `board: false` always use clips.

A different breakout board? Change `BREAKOUT_ORDER` in `apps_script/client/lib/breadboard.js` and `BREAKOUT_ROWS` in
`course/circuits.py`.
