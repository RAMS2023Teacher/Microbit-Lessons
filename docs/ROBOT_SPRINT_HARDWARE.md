# Robot Sprint: hardware setup and facts

The Robot Sprint (lessons S1–S6) is written for this hardware:

| Part | What it is |
|---|---|
| micro:bit V2 | the controller |
| **Keyestudio KS0360** Sensor Shield V2 | the micro:bit plugs in; every pin gets a 3-pin **G V S** header (ground, power, signal) |
| **Keyestudio KS4009** 45-in-1 sensor kit | includes an IR obstacle sensor, a line tracking sensor, an HC-SR04 ultrasonic module, a crash sensor, a micro servo, the 6×AA battery holder and more |
| 180° servos (e.g. SG90) and **continuous-rotation** servos (e.g. FS90R) | arms and gadgets; robot wheels |
| A small robot chassis driven by 2 continuous servos | the sprint robot |
| **Keyestudio KS4033** motor driver board (DRV8833) | optional DC-motor missions |
| SparkFun micro:bit breakout (BOB-13988) + breadboard | optional, for the ultrasonic safety divider |

Facts below come from Keyestudio's official docs (docs.keyestudio.com, KS0360 / KS4009 / KS4033 pages)
unless marked *(course decision)*.

## The KS0360 sensor shield

* **Power:** DC jack **7–9 V** (the kit's 6×AA holder) or micro-USB 5 V. **Servos need the DC jack**; USB alone
  can't supply enough current and the micro:bit will reset when a servo starts. Plug USB in as well to send code.
* **Jumpers V1 / V2** pick **3.3 V or 5 V** for the headers' **V** pins. V1 sits next to the **0–10** header row and
  V2 next to the **11–20** row. Check the labels printed on your board.
* Keyestudio warns the two regulator chips get hot with sensors attached: **don't touch them.**
* Pins **3, 4, 6, 7, 10** are shared with the LED screen. Keyestudio's servo example uses P3 with
  `led enable false`; the sprint simply avoids those pins *(course decision)*.

### Sprint settings *(course decision)*

| Jumper | Setting | Why |
|---|---|---|
| **V1** (pins 0–10) | **3.3 V** | sensors run at 3.3 V, so their signals are safe for the micro:bit, whose pins are 3 V only (Keyestudio: "it does not support sensors of 5V") |
| **V2** (pins 11–20) | **5 V** | servos run at 5 V |

### Sprint pin map *(course decision; every lesson uses the same pins)*

| Pin | Header row | Device | Reads / writes |
|---|---|---|---|
| **P13** | V2 (5 V) | left wheel servo, or "servo A" in gadgets | `write_analog` |
| **P14** | V2 (5 V) | right wheel servo, or "servo B" | `write_analog` |
| **P15** | V2 (5 V) | head / arm servo (180°) | `write_analog` |
| **P0** | V1 (3.3 V) | IR obstacle sensor | `read_digital()`: **0 = something in front** |
| **P8** | V1 (3.3 V) | line tracking sensor | `read_digital()`: **1 = black line (or nothing below)**, 0 = white |
| **P1** | V1 (3.3 V) | crash (bump) sensor, *or* ultrasonic Echo | crash: **0 = pressed** |
| **P2** | V1 (3.3 V) | ultrasonic Trig | |

Keep to **3 servos at a time** (two wheels + one head). That's the most PWM outputs the sprint relies on.

## Sensors (from the KS4009 docs)

* **IR obstacle detector:** low (0) when something is in front, high (1) when clear. Range is about **2–40 cm**,
  set with the potentiometer(s). It works at 3.3–5 V.
* **Line tracking sensor (TCRT5000):** high (1) over a black line *or when nothing is below it*, low (0) over
  white. It must be 0–3 cm above the floor. Turn its potentiometer until its LED is right at the on/off point.
* **Crash sensor:** low (0) when the switch is pressed. Its LED lights on a collision.
* **HC-SR04 ultrasonic:** measures 2–450 cm. Pull **Trig** high for 10 µs, then time the high pulse on **Echo**:
  **distance (cm) = echo time (µs) ÷ 58**. Keyestudio's example uses **Trig = P2, Echo = P1**.

### ⚠ The ultrasonic sensor and 5 V

The HC-SR04 is a **5 V** module, and its Echo pin outputs **5 V**. Keyestudio's diagram powers it from a 5 V header
and wires Echo straight to P1. That's more than the micro:bit's 3 V pins are rated for, even though it often
works. Pick one of these setups:

1. **Safer (recommended):** power the sensor from a **5 V** header (any **V** pin in the 11–20 row) and connect
   **Echo → 1 kΩ → P1** and **P1 → 2 kΩ → GND**. This is a voltage divider: 5 V × 2/3 ≈ 3.3 V. 10 kΩ + 20 kΩ also works.
   Trig can go straight to P2, because 3.3 V is enough to trigger it.
2. **Keyestudio's wiring:** everything on the 0–10 row with V1 set to 5 V. This is quick, but it is outside the
   micro:bit's rating, and it puts **every** sensor on that row at 5 V. If you do this, move the IR and line sensors elsewhere.

In the sprint, the ultrasonic sensor is the **Gold** option. The IR obstacle sensor gives the same
"is something close?" answer at 3.3 V with nothing extra to wire.

## Servos in MicroPython

```python
from microbit import *
pin13.set_analog_period(20)          # one pulse every 20 ms (50 Hz)
```

* **180° servo:** a pulse of 0.5–2.5 ms sets 0°–180°. With a 20 ms period, `write_analog` values are about
  **26 (0°), 77 (90°), 128 (180°)**: `value = 26 + angle * 102 // 180`.
* **Continuous servo:** the same pulse sets **speed and direction**: about **77 = stop**, values below spin one way,
  values above spin the other way, and full speed is near **51** and **102**. Every servo's stop point is slightly
  different, so students **calibrate** theirs. Some have a small trim screw.
* `write_analog` needs a **whole number**: use `//` or `int()`, not `/`.
* Servo wires: **brown = G, red = V, orange = S** (some brands use black/red/white or yellow).
* On a two-wheel robot, the wheels face opposite ways, so "forward" means one servo spins one way and the other
  spins the opposite way.

## Ultrasonic in MicroPython

```python
from microbit import *
import utime
from machine import time_pulse_us

pin1.read_digital()                  # put the Echo pin in input mode
def distance_cm():
    pin2.write_digital(1)
    utime.sleep_us(10)
    pin2.write_digital(0)
    t = time_pulse_us(pin1, 1, 30000)   # wait up to 30 ms for the echo
    if t < 0:
        return 999                    # no echo: nothing in range
    return t // 58
```

## KS4033 motor driver board (optional DC-motor missions)

* DRV8833 chip, up to **700 mA** per motor, motor supply **VM 5–10.8 V**. Use 4×AA (6 V) for small TT gear motors.
* The micro:bit plugs straight in. **Motor A = P13 (A1) + P12 (A2), Motor B = P15 (B2) + P16 (B1).**
* It is a separate board from the sensor shield: you can't stack them. A DC-motor robot uses the KS4033's own
  3-pin sensor headers.
* Drive logic *(course decision, standard DRV8833 wiring)*: one pin gets `write_analog(speed)` and the other gets 0
  to go one way; swap them to reverse; both 0 = stop. If a motor spins the wrong way, swap its two wires.
  Keyestudio's sample code drives both pins of a motor at once in one step, which on a standard DRV8833 means
  brake, so the sprint uses the logic above and has students test it.
