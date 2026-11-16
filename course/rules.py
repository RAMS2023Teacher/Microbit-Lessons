"""Course plan, XP, levels, badges and avatar parts. Everything a teacher might want to tune lives here.

The build (tools/build.py) copies these into Data.gs for the Apps Script app.
"""

# ---------------------------------------------------------------- the course: 13 projects, in order
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

# ---------------------------------------------------------------- XP
XP = {
    "mission": 10,        # read the mission, answered the partner question
    "step": 10,           # every build step with all its tests checked
    "quiz": 30,           # passed the quiz (3 of 4, or better)
    "quiz_perfect": 20,   # every quiz answer right
    "quiz_first_try": 10,  # ...on the first try
    "extension": 25,      # each extension you add
    "ship": 50,           # turned in your MakeCode share link
    "complete": 50,       # whole lesson finished
    "badge": 25,          # every badge is also worth XP
}
LABELS = {"mission": "Mission accepted", "step": "Step done", "quiz": "Quiz passed", "quiz_perfect": "Perfect quiz",
          "quiz_first_try": "Perfect on the first try", "extension": "Extension added", "ship": "Project shipped",
          "complete": "Lesson complete!"}
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
    ("graduate", "🎓", "Graduate", "Complete all 13 lessons.", ["lessons", 13]),
    ("early-bird", "🐦", "Early Bird", "Finish an assignment before it's due.", ["early"]),
    ("robot-stylist", "🤖", "Robot Stylist", "Customize your robot.", ["avatar"]),
    ("teachers-pick", "🍎", "Teacher's Pick", "Given by your teacher for great work.", ["teacher"]),
]

# ---------------------------------------------------------------- avatar parts (unlock: None, ("level", n) or ("badge", id))
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
              ("chrome", "Chrome", ("level", 8)), ("gold", "Gold", ("badge", "halfway"))],
    "eyes": [("dots", "Dots", None), ("round", "Round", None), ("visor", "Visor", ("level", 2)),
             ("cyclops", "Cyclops", ("level", 4)), ("hearts", "Hearts", ("badge", "quiz-whiz")),
             ("leds", "LED grid", ("level", 5)), ("happy", "Happy", ("badge", "finisher"))],
    "mouth": [("smile", "Smile", None), ("flat", "Flat", None), ("open", "Open", None),
              ("grille", "Grille", ("level", 3)), ("zigzag", "Zigzag", ("badge", "remixer"))],
    "antenna": [("none", "None", None), ("ball", "Ball", None), ("double", "Double", ("level", 2)),
                ("bolt", "Lightning", ("level", 4)), ("dish", "Radar dish", ("badge", "echo-hunter")),
                ("propeller", "Propeller", ("level", 7))],
    "accessory": [("none", "None", None), ("bowtie", "Bow tie", None), ("cap", "Cap", ("level", 3)),
                  ("headphones", "Headphones", ("badge", "musician")),
                  ("goggles", "Safety goggles", ("badge", "circuit-builder")),
                  ("cape", "Cape", ("level", 9)), ("crown", "Crown", ("badge", "graduate"))],
    "bg": [("sky", "Sky", None), ("mint", "Mint", None), ("sun", "Sunny", None), ("lilac", "Lilac", None),
           ("night", "Night", None), ("circuit", "Circuit board", ("level", 5)),
           ("stars", "Starfield", ("level", 10))],
}

MAKECODE_URL = "https://makecode.microbit.org/"
