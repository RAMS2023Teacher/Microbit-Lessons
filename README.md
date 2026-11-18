# micro:bit Maker Lab

A project-based micro:bit course for middle school: **13 projects**, each teaching a little **Python** and a little
**circuitry**. Students code in **MakeCode Python** (makecode.microbit.org) in a second tab; Maker Lab guides them
step by step, checks their progress, and collects their finished projects. It runs as a **Google Apps Script web app**
in the teacher's school Google account, and student work stays in the teacher's Drive.

**To install or update it, follow [dist/apps-script/INSTALL.md](dist/apps-script/INSTALL.md)** (paste 3 Script files).

## How a lesson works (like the App Inventor curriculum)

| Stage | What students do |
|---|---|
| 🎯 **Mission** | See what they'll build and what they need, and talk a question over with their partner |
| 🛠️ **Build** | One step per screen, like the build-guide slideshows: code with the **new lines highlighted**, *What it does*, a green **Test it** box to tick, and one question. **Got it! Next ▶** unlocks when the step is done |
| 🧠 **Quiz** | 3-6 questions as colored answer tiles, graded on the server (pass at 75%) |
| 🚀 **Ship it** | Pick at least one extension, answer the reflection questions, paste the **MakeCode share link** |

Around that: XP, levels, badges and a robot avatar; a skill tree; partners on one Chromebook (work saves to both);
a teacher gradebook with each student's stage, quiz score and project link; a projector **Class display**;
Google Classroom roster import and a grades package.

## The courses

Each class is set to a course on its class page (or when you create it). Students see only their course's lessons,
skill tree and badges; XP, levels, robots, the shop and Robot Rush are shared.

### 6th grade: Games, Programming & AI (MakeCode Blocks)

| # | Project | Coding idea | Hardware |
|---|---|---|---|
| 1 | Hello, micro:bit! | events: on start, on button pressed | just the micro:bit |
| 2 | Animate It | forever loops and pause | just the micro:bit |
| 3 | Rock, Paper, Scissors | variables, pick random, if / else | just the micro:bit |
| 4 | Step Counter | counting with a variable · shake | micro:bit + battery pack |
| 5 | Coin Catcher | sprites, score and game over | just the micro:bit |
| 6 | Radio Hot Potato | radio: send and receive | two micro:bits |
| 7 | How Machines Learn | AI learns from examples (data) | micro:bit + CreateAI |
| 8 | AI Gesture Remote | using a machine learning model | micro:bit V2 + CreateAI |
| 9 | AI Fitness Coach | testing AI: accuracy and fairness | micro:bit V2 + CreateAI |
| 10 | Game Jam | put it all together | your choice |

Lessons 7-9 use micro:bit CreateAI (createai.microbit.org). Any micro:bit can collect data and train a model;
running the model in MakeCode needs a micro:bit V2.

### 7th grade: Python & Circuits (MakeCode Python)

| # | Project | Python idea | Hardware |
|---|---|---|---|
| 1 | Name Badge | code runs in order · button events | just the micro:bit |
| 2 | Blink an LED | `while True` loops | LED + resistor |
| 3 | Traffic Light | functions with `def` | 3 LEDs |
| 4 | Reaction Game | variables, `if`/`else`, random | a push button |
| 5 | Making Music | `for` loops · frequency | headphones or buzzer |
| 6 | Dodge the Drop | `while` loops · tilt · sprites | just the micro:bit |
| 7 | Night Light | sensor readings, thresholds | light sensor + LED |
| 8 | Distance Detector | functions that return a value | ultrasonic sensor |
| 9 | Heartbeat Monitor | signals, thresholds, counting | pulse sensor |
| 10 | Build a Robot | functions for moves | 2 servos + the robot chassis |
| 11 | Robot with Eyes | sense → decide → act | robot + ultrasonic sensor |
| 12 | Radio Messenger | events: on radio received | two micro:bits |
| 13 | Invent It | put it all together | your choice |

Robot lessons (10–11) assume: left servo signal on P1, right on P2, servo power from a battery pack whose − is joined to
the micro:bit GND, and the ultrasonic sensor on Trig P8 / Echo P12 through the breakout board. Change the pins in
`course/lessons/10-servo-robot.yaml` and `11-robot-eyes.yaml` if your robot is wired differently.

## Robot Rush and the shop

**Robot Rush** is a 45-second race with the student's own robot, with a class leaderboard (today and all time).
The arcade is **closed unless the teacher opens it** for a class, from the class display (🎮 Open arcade, until the bell)
or the class page. Finishing a lesson earns 5 minutes of play time; each race uses its length from that time, and only
while the arcade is open for the student's own class. The teacher can also give everyone 5 minutes.
Students spend **XP to spend** in the shop on power-ups (Turbo, Shield, Bolt magnet, Rocket dash, Overtime) and robot
parts. Levels count all XP ever earned, so spending never lowers a level. Prices, power-ups and play time are in
`course/rules.py` (`AVATAR_OPTIONS`, `POWERUPS`, `ARCADE`).

## For developers

```
course/lessons/*.yaml   the lessons (format: docs/LESSONS.md)
course/rules.py         course plan, XP, levels, badges, avatar parts, skill tree
apps_script/server/     the Apps Script server (joined into Code.gs)
apps_script/client/     the browser code and CSS (packed into Assets.gs)
tools/build.py          checks the lessons and builds dist/apps-script/
tests/                  lesson checks, and the whole app against fake Google services (Node)
legacy/flask-site/      the earlier Flask version and its 29 MicroPython lessons (not maintained)
```

After changing lessons or code: `python tools/build.py`, then commit `dist/`. `pytest` fails if `dist/` is out of date.
To click through locally with fake Google: `node tests/apps_script_app/serve.js dist/apps-script 5055`, then open
http://localhost:5055/exec (you're the teacher; add `?as=sam@students.school.org` to be a student).
