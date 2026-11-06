# micro:bit Maker Lab

A website that teaches **Python on the BBC micro:bit** together with **basic circuits**,
from a first blinking LED through sensors and motors to a radio-controlled robot.
It's built for grades 6–8, and every lesson is designed to take about **35 minutes**.

## What's inside

**For students**
- Register with a 6-letter class code. No email is needed.
- 16 step-by-step lessons. Each one has a timed agenda: warm-up → learn → build the circuit → code → debug → quiz → open-ended challenge.
- **Circuit instructions** are drawn on a virtual breadboard. Each step adds glowing new parts and has a "did you check?" box to tick.
- **A Python editor in the browser** that can:
  - **Send to micro:bit** over USB (Web Serial in Chrome, Edge or a Chromebook). It saves the code as `main.py` and runs it, and shows `print()` output and error messages. The line that caused an error is highlighted.
  - **Download .hex** in any browser. You drag the file onto the MICROBIT drive. MicroPython for both micro:bit V1 and V2 is bundled in.
- **Debug challenges**: broken code to fix, with hints and a "Check my fix" button, plus a reflection question.
- Quizzes that give an explanation for each answer.
- Open-ended **Mild / Medium / Spicy** challenges with a write-up to submit.
- A 35-minute class timer that highlights which part of the lesson you should be on.

**Gamification**
- **The Maker Map** is a skill tree of all 16 lessons. Finishing a lesson lights up the trail and unlocks the lessons that branch off it. For example, the line-following robot needs both *Drive Your Robot* and *Light Sensor*. Lessons a teacher assigns are always unlocked. The student's robot stands on the lesson they're working on, and each lesson can earn ★★★: fix the bug, get a perfect quiz, and submit the challenge.
- **XP and 12 levels**, from *Spark* to *Robotics Ace*. Students earn XP for every part of a lesson, plus bonuses for fixing a bug without hints and for a perfect quiz on the first try.
- **20 badges**, such as Bug Squasher, Hardware Hacker, Early Bird, one per unit, and Teacher's Pick.
- **A robot avatar builder** with 7 kinds of parts (body, color, eyes, mouth, antenna, accessory, background) and an optional name. Some parts unlock at higher levels or with certain badges.
- Pop-ups celebrate XP, new badges and level-ups. Rewards are given only once, and any work a student did earlier still counts.
- All the rules (XP values, levels, badges, the skill tree and avatar unlocks) are at the top of `app/gamify.py`.

**For teachers**
- Create classes and assign lessons with due dates and notes.
- A **gradebook** for each class: % complete, best quiz score, debug fixed, challenge submitted, and late work.
- **Side-by-side class responses** for each assignment, covering warm-ups, debug reflections and challenge write-ups. These are good for class discussion.
- A page per student showing their code, debug attempts, hints used, quiz history and challenge code. You can leave feedback, which the student sees at the top of the lesson. You can also re-open a debug challenge, reset a password, or export the gradebook to CSV.
- An **answer key and teacher notes** on every lesson, visible only to teachers.
- Each student's avatar, level, XP and badges show in the gradebook and on their page. You can give **bonus XP** with a reason, and optionally the 🍎 Teacher's Pick badge.
- **Standards alignment**: every lesson is aligned to the **Massachusetts DLCS framework (2016), grades 6–8**, with a line on how the lesson meets each standard. Teachers get a **Standards** page with a lessons × standards grid, coverage by strand, and the standards the course doesn't address. It's printable for administrators. The standard text is quoted exactly from the DESE framework in `app/standards.yaml`.
- A **Videos** page where you paste a YouTube, Google Drive, Vimeo or .mp4 link for any lesson. Until you add one, the lesson shows "Video coming soon".

## The course

| Unit | Lessons |
|---|---|
| 1 Light It Up | 1 Hello micro:bit · 2 Circuits 101 · 3 Blink an external LED · 4 Traffic light · 5 Dimmer (PWM) |
| 2 Sensing the World | 6 Buttons & inputs · 7 Light sensor night light · 8 Potentiometers · 9 Temperature data |
| 3 Making Things Move | 10 Motion & sound · 11 Servo motor · 12 DC motor + transistor · 13 Motor driver |
| 4 Robots | 14 Drive your robot · 15 Line follower · 16 Radio remote control |

Lessons are YAML files in `lessons/`. See [docs/LESSON_FORMAT.md](docs/LESSON_FORMAT.md) for how to edit them or write new ones.

## Run it locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
flask --app wsgi seed-demo        # optional: demo teacher/student + class
flask --app wsgi run --debug
```

Open http://localhost:5000. The demo logins are `demo_teacher` / `demo1234` and `demo_student` / `demo1234`.

Run the tests and check the lesson files:

```bash
pip install pytest
pytest
python tools/validate_lessons.py
```

## Configuration (environment variables)

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | **Required in production.** A long random string. |
| `TEACHER_SIGNUP_CODE` | The code needed to create a teacher account. The default is `teach-makers`, so **change it**. |
| `DATABASE_URL` | Defaults to SQLite in `instance/`. Use PostgreSQL in production, for example `postgresql://…`. |
| `SITE_NAME` | The name shown in the header. |

## Deploy

Any Python host works (Render, Railway, Fly.io, a school server, and so on):

```bash
gunicorn wsgi:app
```

The site needs to be served over **HTTPS**, because browsers only allow Web Serial on secure pages. Most hosts do this for you.

## Hardware kit (per pair of students)

micro:bit V2 + USB cable, edge-connector breakout for a breadboard, half-size breadboard, jumper wires,
LEDs (red, yellow, green), 220 Ω and 10 kΩ resistors, a 1 kΩ resistor, pushbuttons, a photoresistor,
a 10 kΩ potentiometer, a passive piezo buzzer, an SG90 micro servo, a small DC motor, a PN2222A NPN transistor,
a 1N4001 diode, a DRV8833 dual motor driver, 2 TT gear motors with a robot chassis, 2 TCRT5000 IR line sensor modules,
a 4×AA battery pack, and a second micro:bit for the radio remote.

## How "Send to micro:bit" works

`app/static/js/microbit.js` opens the micro:bit's USB serial port, stops the running program,
enters MicroPython's raw REPL, writes the code to `main.py` and soft-resets the board.
This only works if MicroPython is already on the micro:bit, so the first time students use **Download .hex**.
The page detects when MicroPython is missing and tells them what to do.

## Credits

- [CodeMirror 5](https://codemirror.net/5/) (MIT)
- [@microbit/microbit-fs](https://github.com/microbit-foundation/microbit-fs) (MIT)
- [MicroPython for micro:bit](https://github.com/bbcmicrobit/micropython) V1 and [V2](https://github.com/microbit-foundation/micropython-microbit-v2) firmware (MIT)

These are all bundled in `app/static/vendor/`. This project is not affiliated with the Micro:bit Educational Foundation.
