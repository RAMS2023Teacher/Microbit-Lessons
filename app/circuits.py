"""Breadboard circuit model.

Lessons describe circuits as a list of *parts* placed into a virtual
half-size breadboard (30 columns, rows a-j, four power rails) with a
micro:bit edge-connector breakout on the left and off-board parts
(servos, motors, battery packs, modules) on the right.

This module validates those descriptions and works out which points are
electrically connected ("nets") so lesson authors get told about mistakes
such as an LED with both legs in the same column.  The JavaScript renderer
in ``static/js/breadboard.js`` uses the same addressing scheme.

Addresses
---------
* ``a1`` .. ``j30``     breadboard holes. a-e in a column are connected,
                         f-j in a column are connected.
* ``T+1`` .. ``T+30``   top red rail, ``T-1``.. top blue rail
* ``B+1`` .. ``B-30``   bottom rails (each rail is one long strip)
* ``mb.P0`` ...         micro:bit breakout pins (see MICROBIT_PINS)
* ``<id>.<terminal>``   terminal of any part, e.g. ``led1.anode`` or ``servo1.sig``
"""
from __future__ import annotations

import re

MICROBIT_PINS = ["3V", "GND", "P0", "P1", "P2", "P8", "P12", "P13", "P14",
                 "P15", "P16", "P19", "P20"]

COLUMNS = 30
ROWS_TOP = "abcde"
ROWS_BOTTOM = "fghij"
RAILS = ["T+", "T-", "B+", "B-"]

# Parts that sit in breadboard holes: type -> ordered terminal names
BOARD_PARTS = {
    "led": ["anode", "cathode"],
    "resistor": ["a", "b"],
    "button": ["a", "b"],
    "ldr": ["a", "b"],            # photoresistor
    "diode": ["anode", "cathode"],
    "capacitor": ["a", "b"],
    "buzzer": ["plus", "minus"],
    "potentiometer": ["left", "wiper", "right"],
    "transistor": ["collector", "base", "emitter"],
}

# Parts that live off the board; wires connect to their terminals.
OFFBOARD_PARTS = {
    "servo": ["sig", "vcc", "gnd"],
    "dcmotor": ["a", "b"],
    "battery": ["plus", "minus"],
    "module": None,  # terminals listed by the lesson author
}

WIRE_COLORS = {"red", "black", "blue", "green", "yellow", "orange", "white",
               "purple", "brown", "gray"}
LED_COLORS = {"red", "green", "yellow", "blue", "white", "orange"}

_HOLE = re.compile(r"^([a-j])([1-9]|[12][0-9]|30)$")
_RAIL = re.compile(r"^(T\+|T-|B\+|B-)([1-9]|[12][0-9]|30)$")


class CircuitError(ValueError):
    pass


def hole_net(addr: str) -> str | None:
    """Return the breadboard strip an address belongs to, or None."""
    m = _HOLE.match(addr)
    if m:
        row, col = m.group(1), int(m.group(2))
        return f"col{col}{'top' if row in ROWS_TOP else 'bot'}"
    m = _RAIL.match(addr)
    if m:
        return f"rail{m.group(1)}"
    return None


def is_hole(addr: str) -> bool:
    return hole_net(addr) is not None


class _DSU:
    def __init__(self):
        self.p = {}

    def find(self, x):
        self.p.setdefault(x, x)
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def union(self, a, b):
        self.p[self.find(a)] = self.find(b)


def analyze(steps: list[dict]) -> dict:
    """Validate every part across all steps and compute nets.

    Returns {"errors": [...], "warnings": [...], "nets": callable}.
    """
    errors: list[str] = []
    warnings: list[str] = []
    parts: dict[str, dict] = {}
    terminals: dict[str, str] = {}      # "id.term" -> address/net seed
    occupied: dict[str, str] = {}       # hole -> what is in it
    dsu = _DSU()

    for pin in MICROBIT_PINS:
        dsu.find(f"mb.{pin}")

    def endpoint(addr: str, where: str) -> str | None:
        """Resolve a wire endpoint to a node in the DSU."""
        if addr.startswith("mb."):
            if addr[3:] not in MICROBIT_PINS:
                errors.append(f"{where}: unknown micro:bit pin '{addr}'")
                return None
            return addr
        net = hole_net(addr)
        if net:
            if addr in occupied:
                errors.append(f"{where}: hole {addr} already used by {occupied[addr]}")
            occupied[addr] = where
            return net
        if addr in terminals:
            return terminals[addr]
        errors.append(f"{where}: unknown endpoint '{addr}' (hole, rail, mb.PIN or part terminal "
                      f"defined in an earlier or same step)")
        return None

    for si, step in enumerate(steps, 1):
        add = step.get("add") or []
        # first pass: register parts (so wires in same step can reference them)
        for pi, part in enumerate(add, 1):
            where = f"step {si} part {pi}"
            ptype = part.get("type")
            if ptype == "wire":
                continue
            pid = part.get("id")
            if not pid or not re.match(r"^[a-z][a-z0-9_]*$", str(pid)):
                errors.append(f"{where}: part needs a lowercase id")
                continue
            if pid in parts:
                errors.append(f"{where}: duplicate part id '{pid}'")
                continue
            parts[pid] = part
            if ptype in BOARD_PARTS:
                for term in BOARD_PARTS[ptype]:
                    addr = part.get(term)
                    if not addr:
                        errors.append(f"{where}: {ptype} '{pid}' missing '{term}'")
                        continue
                    net = hole_net(str(addr))
                    if not net:
                        errors.append(f"{where}: {pid}.{term} = '{addr}' is not a breadboard hole")
                        continue
                    if addr in occupied:
                        errors.append(f"{where}: hole {addr} already used by {occupied[addr]}")
                    occupied[addr] = f"{pid}.{term}"
                    terminals[f"{pid}.{term}"] = net
                    dsu.find(net)
                if ptype == "led" and part.get("color", "red") not in LED_COLORS:
                    errors.append(f"{where}: LED color must be one of {sorted(LED_COLORS)}")
            elif ptype in OFFBOARD_PARTS:
                terms = OFFBOARD_PARTS[ptype]
                if terms is None:
                    terms = part.get("terminals") or []
                    if not terms:
                        errors.append(f"{where}: module '{pid}' needs a 'terminals' list")
                    if not part.get("label"):
                        errors.append(f"{where}: module '{pid}' needs a 'label'")
                for term in terms:
                    node = f"{pid}.{term}"
                    terminals[node] = node
                    dsu.find(node)
            else:
                errors.append(f"{where}: unknown part type '{ptype}'")

        # second pass: wires
        for pi, part in enumerate(add, 1):
            if part.get("type") != "wire":
                continue
            where = f"step {si} wire {pi}"
            if part.get("color", "red") not in WIRE_COLORS:
                errors.append(f"{where}: wire color must be one of {sorted(WIRE_COLORS)}")
            a = endpoint(str(part.get("from", "")), where)
            b = endpoint(str(part.get("to", "")), where)
            if a and b:
                dsu.union(a, b)

    def node_of(name: str) -> str | None:
        if name.startswith("mb."):
            return name
        if name in terminals:
            return terminals[name]
        return hole_net(name)

    def connected(x: str, y: str) -> bool:
        nx, ny = node_of(x), node_of(y)
        if nx is None or ny is None:
            return False
        return dsu.find(nx) == dsu.find(ny)

    # automatic sanity checks
    if connected("mb.3V", "mb.GND"):
        errors.append("SHORT CIRCUIT: 3V is wired directly to GND")
    for pid, part in parts.items():
        ptype = part.get("type")
        if ptype in BOARD_PARTS:
            terms = BOARD_PARTS[ptype]
            for i in range(len(terms)):
                for j in range(i + 1, len(terms)):
                    a, b = f"{pid}.{terms[i]}", f"{pid}.{terms[j]}"
                    if a in terminals and b in terminals and connected(a, b):
                        msg = f"{ptype} '{pid}': {terms[i]} and {terms[j]} are connected together (shorted)"
                        if ptype == "potentiometer":
                            warnings.append(msg)
                        else:
                            errors.append(msg)

    return {"errors": errors, "warnings": warnings, "connected": connected,
            "known": lambda n: node_of(n) is not None}


def check_circuit(circuit: dict) -> list[str]:
    """Validate a lesson's ``circuit`` block. Returns a list of error strings."""
    steps = circuit.get("steps") or []
    result = analyze(steps)
    errors = list(result["errors"])
    verify = circuit.get("verify") or {}
    for pair in verify.get("connected", []):
        for n in pair:
            if not result["known"](n):
                errors.append(f"verify: unknown point '{n}'")
        if all(result["known"](n) for n in pair):
            for n in pair[1:]:
                if not result["connected"](pair[0], n):
                    errors.append(f"verify: expected {pair[0]} to be connected to {n}")
    for pair in verify.get("not_connected", []):
        for n in pair:
            if not result["known"](n):
                errors.append(f"verify: unknown point '{n}'")
        if all(result["known"](n) for n in pair) and result["connected"](pair[0], pair[1]):
            errors.append(f"verify: expected {pair[0]} NOT to be connected to {pair[1]}")
    return errors
