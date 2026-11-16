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
