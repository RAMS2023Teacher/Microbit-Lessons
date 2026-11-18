"""Course plan, XP, levels, badges and avatar parts. Everything a teacher might want to tune lives here.

The build (tools/build.py) copies these into Data.gs for the Apps Script app.
"""

# ---------------------------------------------------------------- the courses
# Each class is set to one course (grade). Students see only their course's lessons, skill tree and badges;
# XP, levels, robots, the shop and Robot Rush are shared. Lesson files: course/lessons/ (7th) and course/lessons/g6/.
COURSES = {
    "g7": {"name": "7th grade: Python & Circuits", "short": "7th grade", "editor": "python", "idea_label": "Python idea",
           "dir": "lessons"},
    "g6": {"name": "6th grade: Games, Programming & AI", "short": "6th grade", "editor": "blocks", "idea_label": "Coding idea",
           "dir": "lessons/g6"},
}
DEFAULT_COURSE = "g7"

# ---------------------------------------------------------------- 7th grade: 13 projects, in order
# id, number, title, icon, banner color, Python idea, hardware, skill-tree position (column, row)
COURSE = [
    ("name-badge",        1, "Name Badge",         "📛", "blue",   "Code runs in order · button events",   "Just the micro:bit",               (1, 0)),
    ("blink-an-led",      2, "Blink an LED",       "💡", "gold",   "while True loops",                     "LED + resistor on a breadboard",   (1, 1)),
    ("traffic-light",     3, "Traffic Light",      "🚦", "green",  "Functions with def",                   "3 LEDs",                           (1, 2)),
    ("reaction-game",     4, "Reaction Game",      "⏱️", "red",    "Variables, if / else, random",         "A push button",                    (1, 3)),
    ("making-music",      5, "Making Music",       "🎵", "purple", "for loops · frequency",                "Headphones or a buzzer",           (0, 4)),
    ("dodge-the-drop",    6, "Dodge the Drop",     "🌧️", "blue",   "while loops · tilt · sprites",         "Just the micro:bit",               (2, 4)),
    ("night-light",       7, "Night Light",        "🌙", "teal",   "Sensor readings and thresholds",       "Light sensor + LED",               (1, 5)),
    ("distance-detector", 8, "Distance Detector",  "🦇", "orange", "Functions that return a value",        "Ultrasonic sensor",                (0, 6)),
    ("heartbeat-monitor", 9, "Heartbeat Monitor",  "❤️", "red",    "Signals, thresholds and counting",     "Pulse sensor",                     (2, 6)),
    ("servo-robot",      10, "Build a Robot",      "🤖", "green",  "Functions for moves",                  "2 servos + the robot chassis",     (0, 7)),
    ("robot-eyes",       11, "Robot with Eyes",    "👀", "teal",   "Sense → decide → act",                 "Robot + ultrasonic sensor",        (0, 8)),
    ("radio-messenger",  12, "Radio Messenger",    "📡", "pink",   "Events: on radio received",            "Two micro:bits",                   (1, 9)),
    ("invent-it",        13, "Invent It",          "🚀", "purple", "Put it all together",                  "Your choice",                      (1, 10)),
]
# what has to be finished before a lesson unlocks on the skill tree (any one of them)
REQUIRES = {
    "blink-an-led": ["name-badge"], "traffic-light": ["blink-an-led"], "reaction-game": ["traffic-light"],
    "making-music": ["reaction-game"], "dodge-the-drop": ["reaction-game"],
    "night-light": ["making-music", "dodge-the-drop"],
    "distance-detector": ["night-light"], "heartbeat-monitor": ["night-light"],
    "servo-robot": ["distance-detector"], "robot-eyes": ["servo-robot"],
    "radio-messenger": ["robot-eyes", "heartbeat-monitor"], "invent-it": ["radio-messenger"],
}

# ---------------------------------------------------------------- 6th grade: 10 projects in MakeCode Blocks
COURSE_6 = [
    ("hello-microbit",      1, "Hello, micro:bit!",    "👋", "blue",   "Events: on start, on button pressed",  "Just the micro:bit",          (1, 0)),
    ("animate-it",          2, "Animate It",           "🎞️", "purple", "forever loops and pause",              "Just the micro:bit",          (1, 1)),
    ("rock-paper-scissors", 3, "Rock, Paper, Scissors", "✂️", "orange", "Variables, pick random, if / else",    "Just the micro:bit",          (1, 2)),
    ("step-counter",        4, "Step Counter",         "👟", "green",  "Counting with a variable · shake",     "micro:bit + battery pack",    (0, 3)),
    ("coin-catcher",        5, "Coin Catcher",         "🪙", "gold",   "Sprites, score and game over",         "Just the micro:bit",          (2, 3)),
    ("radio-hot-potato",    6, "Radio Hot Potato",     "📡", "pink",   "Radio: send and receive",              "Two micro:bits",              (1, 4)),
    ("how-machines-learn",  7, "How Machines Learn",   "🧠", "teal",   "AI learns from examples (data)",       "micro:bit + CreateAI",        (1, 5)),
    ("ai-gesture-remote",   8, "AI Gesture Remote",    "🪄", "purple", "Using a machine learning model",       "micro:bit V2 + CreateAI",     (1, 6)),
    ("ai-fitness-coach",    9, "AI Fitness Coach",     "🏋️", "red",    "Testing AI: accuracy and fairness",    "micro:bit V2 + CreateAI",     (1, 7)),
    ("game-jam",           10, "Game Jam",             "🕹️", "blue",   "Put it all together",                  "Your choice",                 (1, 8)),
]
REQUIRES_6 = {
    "animate-it": ["hello-microbit"], "rock-paper-scissors": ["animate-it"],
    "step-counter": ["rock-paper-scissors"], "coin-catcher": ["rock-paper-scissors"],
    "radio-hot-potato": ["step-counter", "coin-catcher"], "how-machines-learn": ["step-counter", "coin-catcher"],
    "ai-gesture-remote": ["how-machines-learn"], "ai-fitness-coach": ["ai-gesture-remote"],
    "game-jam": ["radio-hot-potato", "ai-fitness-coach"],
}
PLANS = {"g7": (COURSE, REQUIRES), "g6": (COURSE_6, REQUIRES_6)}

# ---------------------------------------------------------------- XP
XP = {
    "mission": 10,        # read the mission, answered the partner question
    "step": 10,           # every build step with all its tests checked
    "quiz": 30,           # passed the quiz (3 of 4, or better)
    "quiz_perfect": 20,   # every quiz answer right
    "quiz_first_try": 10,  # ...on the first try
    "extension": 25,      # each extension you add
    "ship": 50,           # turned in your MakeCode share link
    "rating": 10,         # rated the lesson (the feedback report)
    "complete": 50,       # whole lesson finished
    "badge": 25,          # every badge is also worth XP
}
LABELS = {"mission": "Mission accepted", "step": "Step done", "quiz": "Quiz passed", "quiz_perfect": "Perfect quiz",
          "quiz_first_try": "Perfect on the first try", "extension": "Extension added", "ship": "Project shipped",
          "complete": "Lesson complete!", "rating": "Thanks for rating the lesson"}
QUIZ_PASS = 0.75

# ---------------------------------------------------------------- levels
LEVELS = [  # (XP needed, title)
    (0, "Spark"), (100, "Blinker"), (250, "Wire Wrangler"), (450, "Code Cadet"),
    (700, "Circuit Scout"), (1000, "Bug Hunter"), (1350, "Sensor Sleuth"),
    (1750, "Motor Mechanic"), (2200, "Maker"), (2700, "Engineer"),
    (3250, "Inventor"), (3850, "Robotics Ace"),
]

# ---------------------------------------------------------------- badges
# id, icon, name, description, rule. Rules are checked by apps_script/server/30_rewards.js:
#   ["steps", n] build steps done · ["lesson", id] that lesson complete · ["lessons", n] lessons complete
#   ["wired", n] lessons complete that have wiring · ["perfect", n] perfect quizzes · ["first_try", n]
#   ["extensions", n] · ["shipped", n] · ["partner", n] lessons complete with a partner
#   ["avatar"] customized the robot · ["early"] finished an assignment before it was due · ["teacher"] given by the teacher
#   ["course_done"] every lesson in the student's course complete
# A badge tied to one lesson only shows to students in that lesson's course.
BADGES = [
    ("first-step", "⚡", "First Step", "Finish your first build step.", ["steps", 1]),
    ("finisher", "🏁", "Finisher", "Complete a whole lesson.", ["lessons", 1]),
    ("shipper", "📦", "Shipper", "Turn in your first MakeCode project.", ["shipped", 1]),
    ("circuit-builder", "💡", "Circuit Builder", "Complete a lesson where you wire a circuit.", ["wired", 1]),
    ("wire-wizard", "🔌", "Wire Wizard", "Complete 4 lessons where you wire a circuit.", ["wired", 4]),
    ("musician", "🎵", "Musician", "Complete Making Music.", ["lesson", "making-music"]),
    ("game-maker", "🎮", "Game Maker", "Complete Dodge the Drop.", ["lesson", "dodge-the-drop"]),
    ("echo-hunter", "🦇", "Echo Hunter", "Complete Distance Detector.", ["lesson", "distance-detector"]),
    ("heart-hacker", "❤️", "Heart Hacker", "Complete Heartbeat Monitor.", ["lesson", "heartbeat-monitor"]),
    ("robot-builder", "🤖", "Robot Builder", "Complete Build a Robot.", ["lesson", "servo-robot"]),
    ("quiz-whiz", "🧠", "Quiz Whiz", "Get a perfect quiz score.", ["perfect", 1]),
    ("sharpshooter", "🎯", "Sharpshooter", "Get 3 quizzes perfect on the first try.", ["first_try", 3]),
    ("remixer", "🎨", "Remixer", "Add 5 extensions to your projects.", ["extensions", 5]),
    ("teamwork", "🤝", "Teamwork", "Complete a lesson with a partner.", ["partner", 1]),
    ("halfway", "⭐", "Halfway There", "Complete 5 lessons.", ["lessons", 5]),
    ("graduate", "🎓", "Graduate", "Complete every lesson in your course.", ["course_done"]),
    ("ai-trainer", "🧠", "AI Trainer", "Complete How Machines Learn.", ["lesson", "how-machines-learn"]),
    ("ai-tester", "🔬", "AI Tester", "Complete AI Fitness Coach.", ["lesson", "ai-fitness-coach"]),
    ("game-designer", "🕹️", "Game Designer", "Complete Game Jam.", ["lesson", "game-jam"]),
    ("early-bird", "🐦", "Early Bird", "Finish an assignment before it's due.", ["early"]),
    ("robot-stylist", "🤖", "Robot Stylist", "Customize your robot.", ["avatar"]),
    ("teachers-pick", "🍎", "Teacher's Pick", "Given by your teacher for great work.", ["teacher"]),
]

# ---------------------------------------------------------------- avatar parts
# unlock: None (free), ("level", n), ("badge", id) or ("cost", n): bought in the shop with XP to spend.
# Spending never lowers a level: levels count all the XP ever earned; the shop spends from "XP to spend".
AVATAR_PARTS = {"body": "Body", "color": "Color", "eyes": "Eyes", "mouth": "Mouth",
                "antenna": "Antenna", "accessory": "Accessory", "bg": "Background"}
DEFAULT_AVATAR = {"body": "box", "color": "teal", "eyes": "round", "mouth": "smile",
                  "antenna": "ball", "accessory": "none", "bg": "sky", "name": ""}
AVATAR_OPTIONS = {
    "body": [("box", "Boxy", None), ("round", "Dome", None), ("tall", "Tall", ("level", 3)),
             ("tank", "Tank treads", ("level", 6)), ("hover", "Hover jets", ("badge", "robot-builder"))],
    "color": [("teal", "Teal", None), ("red", "Red", None), ("orange", "Orange", None),
              ("yellow", "Yellow", None), ("green", "Green", None), ("blue", "Blue", None),
              ("purple", "Purple", None), ("pink", "Pink", None), ("white", "White", None),
              ("chrome", "Chrome", ("level", 8)), ("gold", "Gold", ("badge", "halfway")),
              ("lime", "Neon lime", ("cost", 100)), ("galaxy", "Galaxy", ("cost", 250))],
    "eyes": [("dots", "Dots", None), ("round", "Round", None), ("visor", "Visor", ("level", 2)),
             ("cyclops", "Cyclops", ("level", 4)), ("hearts", "Hearts", ("badge", "quiz-whiz")),
             ("leds", "LED grid", ("level", 5)), ("happy", "Happy", ("badge", "finisher")),
             ("shades", "Sunglasses", ("cost", 150)), ("star", "Star eyes", ("cost", 150))],
    "mouth": [("smile", "Smile", None), ("flat", "Flat", None), ("open", "Open", None),
              ("grille", "Grille", ("level", 3)), ("zigzag", "Zigzag", ("badge", "remixer")),
              ("fangs", "Fangs", ("cost", 100)), ("mustache", "Mustache", ("cost", 150))],
    "antenna": [("none", "None", None), ("ball", "Ball", None), ("double", "Double", ("level", 2)),
                ("bolt", "Lightning", ("level", 4)), ("dish", "Radar dish", ("badge", "echo-hunter")),
                ("propeller", "Propeller", ("level", 7)),
                ("flower", "Flower", ("cost", 100)), ("halo", "Halo", ("cost", 200))],
    "accessory": [("none", "None", None), ("bowtie", "Bow tie", None), ("cap", "Cap", ("level", 3)),
                  ("headphones", "Headphones", ("badge", "musician")),
                  ("goggles", "Safety goggles", ("badge", "circuit-builder")),
                  ("cape", "Cape", ("level", 9)), ("crown", "Crown", ("badge", "graduate")),
                  ("scarf", "Scarf", ("cost", 120)), ("wizard", "Wizard hat", ("cost", 250)), ("jetpack", "Jetpack", ("cost", 300))],
    "bg": [("sky", "Sky", None), ("mint", "Mint", None), ("sun", "Sunny", None), ("lilac", "Lilac", None),
           ("night", "Night", None), ("circuit", "Circuit board", ("level", 5)),
           ("stars", "Starfield", ("level", 10)),
           ("ocean", "Ocean", ("cost", 150)), ("lava", "Volcano", ("cost", 150)), ("rainbow", "Rainbow", ("cost", 250))],
}

# ---------------------------------------------------------------- Robot Rush (the arcade game)
# Closed unless the teacher opens the arcade for a class. Finishing a lesson earns "minutes" of play time;
# each race uses "race_seconds" of it (more with the Overtime power-up).
ARCADE = {"minutes": 5, "race_seconds": 45}
# Power-ups bought with XP to spend: id, icon, name, what it does, cost of each level
POWERUPS = [
    ("turbo", "⚡", "Turbo", "Your robot runs faster.", [100, 200, 350]),
    ("shield", "🛡️", "Shield", "Start each race with a shield that blocks one hit. More levels, more shields.", [120, 240, 400]),
    ("magnet", "🧲", "Bolt magnet", "Pull in bolts from farther away.", [80, 160, 300]),
    ("dash", "🚀", "Rocket dash", "Press Space for a burst of speed that smashes through bugs. One dash per level.", [100, 200, 350]),
    ("time", "⏱️", "Overtime", "5 more seconds on the race clock for each level.", [150, 300]),
]

MAKECODE_URL = "https://makecode.microbit.org/"
