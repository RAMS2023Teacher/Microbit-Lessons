const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign, AlignmentType, ImageRun } = require("docx");
const fs = require("fs");
const H = require(process.env.SKILL_DIR + "/scripts/docx_helpers.js");
const { tokenizeLine, styleFor } = require(process.env.SKILL_DIR + "/scripts/codecolor.js");
const GREEN = "1B5E42", LIGHT = "EAF3EE", BLACK = "1A1A1A", GRAY = "5B6770";
const { noBorders, gridB, underline, runs, para, gap } = H;
const PAGE_W = 12240, PAGE_H = 15840, MARGIN = 720, CW = PAGE_W - MARGIN * 2;
const SZ = 20;
const R = (t, o = {}) => new TextRun({ text: t, size: o.size || SZ, bold: !!o.bold, italics: !!o.italics, color: o.color || BLACK, font: o.font, highlight: o.hl });
const C = (t) => R(t, { font: "Consolas", bold: true, color: "0B6EA8", size: 18 });
const BL = (n = 12) => R("_".repeat(n), { color: "777777" });
const P = (kids, after = 60, extra = {}) => new Paragraph({ spacing: { after }, children: kids, ...extra });
const heading = (t, o = {}) => new Paragraph({ pageBreakBefore: !!o.pageBreak, spacing: { before: o.before ?? 150, after: 60 }, keepNext: true, border: underline(GREEN, 4), children: [R(t, { bold: true, color: GREEN, size: 25 })] });
const check = (kids, after = 40) => new Paragraph({ spacing: { after }, keepLines: true, indent: { left: 340, hanging: 340 }, tabStops: [{ type: "left", position: 340 }], children: [R("☐\t", { bold: true, color: GREEN, size: 24 }), ...kids] });
const sub = (kids, after = 40) => new Paragraph({ spacing: { after }, indent: { left: 340 }, children: kids });
const codeBlock = (lines, w = CW, indent = 340) => new Table({ width: { size: w, type: WidthType.DXA }, columnWidths: [w], indent: { size: indent, type: WidthType.DXA }, borders: gridB("C9D3CE"),
  rows: [new TableRow({ cantSplit: true, children: [new TableCell({ width: { size: w, type: WidthType.DXA }, shading: { fill: "F1F4F7" }, margins: { top: 50, bottom: 50, left: 140, right: 140 },
    children: lines.map((l) => new Paragraph({ spacing: { after: 0 }, children: (l === "" ? [{ t: " ", k: "ws" }] : tokenizeLine(l)).map((tk) => { const st = styleFor(tk.k); return new TextRun({ text: tk.t, font: "Consolas", size: 17, color: st.color, bold: !!st.bold, italics: !!st.italic, highlight: st.hl ? "yellow" : undefined }); }) })) })] })] });
const box = (title, kids, fill = LIGHT, border = GREEN, w = CW) => { const b = { style: BorderStyle.SINGLE, size: 8, color: border }, n = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return new Table({ width: { size: w, type: WidthType.DXA }, columnWidths: [w], borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: n, insideVertical: n },
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({ width: { size: w, type: WidthType.DXA }, shading: { fill }, margins: { top: 70, bottom: 70, left: 160, right: 160 }, children: [...(title ? [P([R(title, { bold: true, color: border, size: 21 })], 30)] : []), ...kids] })] })] }); };
const two = (a, b, gapW = 240) => { const w = Math.floor((CW - gapW) / 2); const cell = (kids) => new TableCell({ width: { size: w, type: WidthType.DXA }, children: kids });
  return new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: [w, gapW, w], borders: noBorders(), rows: [new TableRow({ cantSplit: true, children: [cell(a), new TableCell({ width: { size: gapW, type: WidthType.DXA }, children: [P([])] }), cell(b)] })] }); };
function header(title, subtitle) {
  const logo = fs.readFileSync(process.env.SKILL_DIR + "/assets/cs_logo_green.png");
  return [new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: [CW - 1400, 1400], borders: noBorders(), rows: [new TableRow({ children: [
    new TableCell({ width: { size: CW - 1400, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [P([R(title, { bold: true, size: 36, color: GREEN })], 30), P([R(subtitle, { italics: true, size: 21 })], 0)] }),
    new TableCell({ width: { size: 1400, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ data: logo, transformation: { width: 66, height: 65 }, type: "png" })] })] }),
  ] })] }),
  P([R("Name: ", { bold: true, size: 21 }), R("______________________________", { size: 21 }), R("    Partner: ", { bold: true, size: 21 }), R("________________________", { size: 21 }), R("    Date: ", { bold: true, size: 21 }), R("__________", { size: 21 })], 30, { spacing: { before: 100, after: 30 } }),
  new Paragraph({ spacing: { after: 80 }, border: underline(GREEN, 8), children: [] })];
}
// 5x5 LED grid with x/y labels; marks: {"x,y": "label"}
function ledGrid(marks) {
  const cw = 420, cols = [380, cw, cw, cw, cw, cw];
  const cell = (t, o = {}) => new TableCell({ width: { size: o.w || cw, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, shading: o.fill ? { fill: o.fill } : undefined,
    margins: { top: 30, bottom: 30, left: 20, right: 20 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [R(t, { bold: true, size: o.size || 18, color: o.color || GRAY })] })] });
  const rows = [new TableRow({ children: [cell("", { w: 380 }), ...[0, 1, 2, 3, 4].map((x) => cell("x" + x, { color: GREEN }))] })];
  for (let y = 0; y < 5; y++) rows.push(new TableRow({ height: { value: 380, rule: "atLeast" }, children: [cell("y" + y, { w: 380, color: GREEN }), ...[0, 1, 2, 3, 4].map((x) => { const m = marks[x + "," + y]; return cell(m || "", { fill: m ? "C62828" : "2B2B2B", color: "FFFFFF", size: 16 }); })] }));
  const b = { style: BorderStyle.SINGLE, size: 4, color: "FFFFFF" };
  return new Table({ width: { size: cols.reduce((a, c) => a + c, 0), type: WidthType.DXA }, columnWidths: cols, borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b }, rows });
}
const reminder = () => P([R("❗  Reminder: ", { bold: true, color: GREEN, size: 23 }), R("When you're finished, turn this sheet in to the turn-in bin.", { bold: true, size: 23 })], 0, { spacing: { before: 140 } });

const k = [];
// ================= PAGE 1: DAY 1 =================
k.push(...header("Lesson 6: Dodge the Drop", "7th Grade Computer Science · micro:bit · MakeCode Python · Day 1: Warm-ups"));
k.push(box("🌧️  Your mission", [P([R("Build your first micro:bit game. You are the LED on the bottom row. A raindrop falls from the top. "), R("Tilt", { bold: true }), R(" the micro:bit to move left and right. Dodge the drop to score. Get hit and it's game over! Today you'll practice the pieces you need.")], 0)]));
k.push(heading("Key Words"));
k.push(P([R("Fill in each blank with a word from the box:  ", { italics: true, color: GRAY }), R("True  ·  forever  ·  tilt  ·  condition  ·  indent  ·  300", { bold: true, color: GREEN })], 50));
[
  [R("while loop", { bold: true, color: GREEN }), R(" – repeats code as long as its "), BL(14), R(" is True.")],
  [R("condition", { bold: true, color: GREEN }), R(" – a question with a "), BL(10), R(" or False answer, like "), C("count < 5"), R(".")],
  [R("while True", { bold: true, color: GREEN }), R(" – a loop that runs "), BL(12), R(". Games need this.")],
  [R("accelerometer", { bold: true, color: GREEN }), R(" – the micro:bit sensor that feels "), BL(10), R(".")],
  [R("indent", { bold: true, color: GREEN }), R(" – pushing a line in with spaces. Lines inside a loop must "), BL(10), R(" the same amount.")],
  [R("threshold", { bold: true, color: GREEN }), R(" – a number that decides when something counts. In our tilt code it is "), BL(10), R(".")],
].forEach((kids) => k.push(P([R("•  ", { bold: true, color: GREEN }), ...kids], 45, { indent: { left: 260, hanging: 220 } })));
k.push(heading("Day 1 Checklist"));
k.push(check([R("Set up: ", { bold: true }), R("Open MakeCode → New Project named "), R("Warm-ups", { bold: true }), R(" → switch from Blocks to "), R("Python", { bold: true }), R(" → delete the starter code.")]));
k.push(check([R("Warm-up 1 – A loop that counts. ", { bold: true }), R("Type it, but "), R("predict first!", { bold: true })], 30));
k.push(codeBlock(["count = 0", "while count < 5:", "    basic.show_number(count)", "    count += 1", "basic.show_string(\"Done!\")"], 6400));
k.push(sub([R("I predict it shows: "), BL(22), R("   It really showed: "), BL(22)], 30));
k.push(sub([R("If I delete "), C("count += 1"), R(", I think it will "), BL(30), R(". Was I right?  Yes  /  No")], 70));
k.push(check([R("Warm-up 2 – A loop that never stops. ", { bold: true }), R("Beating heart with "), C("while True"), R(". To beat faster I changed 500 to "), BL(8), R(".")]));
k.push(check([R("Warm-up 3 – Wait for a button. ", { bold: true }), C("while not input.button_is_pressed(Button.A):"), R(" keeps waiting until A is "), BL(12), R(".")]));
k.push(check([R("Warm-up 4 – Read the tilt. ", { bold: true }), R("Write the numbers you see:")], 30));
k.push(new Table({ width: { size: 6000, type: WidthType.DXA }, columnWidths: [2000, 2000, 2000], indent: { size: 340, type: WidthType.DXA }, borders: gridB(),
  rows: [new TableRow({ children: ["Tilt left", "Flat", "Tilt right"].map((t) => new TableCell({ width: { size: 2000, type: WidthType.DXA }, shading: { fill: GREEN }, children: [P([R(t, { bold: true, color: "FFFFFF", size: 19 })], 0, { alignment: AlignmentType.CENTER })] })) }),
    new TableRow({ height: { value: 400, rule: "atLeast" }, children: [0, 1, 2].map(() => new TableCell({ width: { size: 2000, type: WidthType.DXA }, children: [P([])] })) })] }));
k.push(sub([R("Tilting "), BL(8), R(" gives negative numbers. Tilting "), BL(8), R(" gives positive numbers.")], 70));
k.push(check([R("Warm-up 5 – Build a tilt sensor. ", { bold: true }), R("Fill in the blanks, then type it:")], 30));
k.push(codeBlock(["while True:", "    x = input.acceleration(Dimension.X)", "    if x < _____:", "        basic.show_arrow(ArrowNames.WEST)", "    elif x > _____:", "        basic.show_arrow(ArrowNames.____)", "    else:", "        basic.clear_screen()", "    basic.pause(100)"], 6400));
k.push(sub([R("When I changed 300 to 600, it got  "), R("MORE  /  LESS", { bold: true }), R("  sensitive (circle one) because "), BL(26), R(".")], 70));
k.push(check([R("I ticked every "), R("Test it", { bold: true }), R(" box in Maker Lab and answered every question for Day 1.")]));

// ================= PAGE 2: DAY 2 =================
k.push(new Paragraph({ pageBreakBefore: true, children: [] }));
k.push(...header("Lesson 6: Dodge the Drop", "7th Grade Computer Science · micro:bit · MakeCode Python · Day 2: Build the Game"));
k.push(heading("The Game Board", { before: 0 }));
k.push(two([
  ledGrid({ "3,0": "drop", "1,4": "you" }),
], [
  P([R("A "), R("sprite", { bold: true, color: GREEN }), R(" is a game character: one glowing LED you can move.")], 60),
  P([R("x", { bold: true }), R(" goes 0 to 4, "), BL(14), R(" to right.")], 60),
  P([R("y", { bold: true }), R(" goes 0 to 4, "), BL(14), R(" to bottom.")], 60),
  P([R("The player (you) is at  x = "), BL(4), R("  y = "), BL(4)], 60),
  P([R("The drop is at  x = "), BL(4), R("  y = "), BL(4)], 60),
  P([R("A drop that reaches  y = "), BL(4), R("  has hit the bottom row.")], 0),
]));
k.push(heading("Fill in the Game Code"));
k.push(P([R("Use the lesson steps to fill in each yellow blank. Then check your code against the Checkpoint step.", { italics: true, color: GRAY })], 50));
k.push(codeBlock([
  "player = game.create_sprite(2, ___)                # bottom middle",
  "drop = game.create_sprite(randint(0, 4), ___)      # top row, random column",
  "while not game.is_game_over():",
  "    x = input.acceleration(Dimension.X)",
  "    if x < -300:",
  "        player.change(LedSpriteProperty.X, ___)    # move LEFT",
  "    elif x > 300:",
  "        player.change(LedSpriteProperty.X, ___)    # move RIGHT",
  "    basic.pause(300)",
  "    drop.change(LedSpriteProperty.___, 1)          # fall one row",
  "    if drop.is_touching(______):                   # did it hit you?",
  "        game.game_over()",
  "    elif drop.get(LedSpriteProperty.Y) ___ 4:      # is it EQUAL to 4?",
  "        game.add_score(1)",
  "        drop.set(LedSpriteProperty.Y, ___)         # back to the top",
  "        drop.set(LedSpriteProperty.X, randint(0, 4))",
], CW - 340));
k.push(heading("Day 2 Checklist"));
k.push(two([
  check([R("New Project named "), R("Dodge the Drop", { bold: true }), R(" (Python)")]),
  check([R("Make the two sprites")]),
  check([R("Tilt to move (stops at the edges)")]),
  check([R("Make the drop fall")]),
  check([R("Score a point, drop goes back up")]),
  check([R("Game over when it hits you")]),
  check([R("Checkpoint: whole game works")]),
], [
  check([R("Quiz", { bold: true }), R(" passed (3 of 4 or better)")]),
  check([R("Add one "), R("extension", { bold: true }), R(". Circle it:")], 20),
  sub([R("Press A to start  ·  Add sound  ·  Use buttons  ·  Speed it up  ·  A second drop", { size: 18 })], 50),
  check([R("Ship it:", { bold: true }), R(" Share → copy the MakeCode link → paste it in Maker Lab")]),
  check([R("Answer the reflection questions")]),
  P([R("My high score: "), BL(6), R("  Partner's: "), BL(6)], 0, { spacing: { before: 80 } }),
]));
k.push(heading("Quick Check"));
k.push(P([R("1.  Why do we check "), C("is_touching"), R(" "), R("before", { bold: true }), R(" checking if the drop reached row 4? "), BL(28)], 70));
k.push(P([R("2.  A "), R("for", { bold: true }), R(" loop repeats a set number of times. A "), R("while", { bold: true }), R(" loop repeats "), BL(30), R(". Why does a game use a while loop? "), BL(26)], 70));
k.push(P([R("3.  What would happen if the drop always came back in the same column? "), BL(34)], 0));
k.push(reminder());

const doc = new Document({ sections: [{ properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } }, children: k }] });
Packer.toBuffer(doc).then((b) => { fs.writeFileSync("/home/claude/work/Dodge_the_Drop_Checklist_7th.docx", b); console.log("done"); });
