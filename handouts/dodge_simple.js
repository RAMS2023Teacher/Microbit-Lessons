const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign, AlignmentType, ImageRun } = require("docx");
const fs = require("fs");
const { tokenizeLine, styleFor } = require(process.env.SKILL_DIR + "/scripts/codecolor.js");
const GREEN = "1B5E42", LIGHT = "EAF3EE", BLACK = "1A1A1A", GRAY = "5B6770", FONT = "Lexend";
const PAGE_W = 12240, PAGE_H = 15840, MARGIN = 720, CW = PAGE_W - MARGIN * 2, IND = 400;
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noB = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
const R = (t, o = {}) => new TextRun({ text: t, font: o.font || FONT, size: o.size || 20, bold: !!o.bold, italics: !!o.italics, color: o.color || BLACK });
const B = (t) => R(t, { bold: true });
const C = (t) => R(t, { font: "Consolas", bold: true, color: "0B6EA8", size: 19 });
const BL = (n = 10) => R("_".repeat(n), { color: "666666" });
const P = (kids, o = {}) => new Paragraph({ spacing: { before: o.before || 0, after: o.after ?? 60 }, indent: o.indent, keepNext: o.keepNext, alignment: o.align, children: kids });
const heading = (t, before = 160) => new Paragraph({ spacing: { before, after: 70 }, keepNext: true, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GREEN } }, children: [R(t, { bold: true, color: GREEN, size: 26 })] });
// a checklist item: box + bold title, then optional fill-in line(s) indented under it
const item = (title, ...lines) => [
  new Paragraph({ spacing: { before: 70, after: lines.length ? 20 : 50 }, keepNext: lines.length > 0, indent: { left: IND, hanging: IND }, tabStops: [{ type: "left", position: IND }],
    children: [R("☐\t", { bold: true, color: GREEN, size: 26 }), ...(typeof title === "string" ? [B(title)] : title)] }),
  ...lines.map((l, i) => l instanceof Table ? l : P(l, { indent: { left: IND }, after: i === lines.length - 1 ? 60 : 30, keepNext: i < lines.length - 1 })),
];
const codeBlock = (lines, w = 6600) => new Table({ width: { size: w, type: WidthType.DXA }, columnWidths: [w], indent: { size: IND, type: WidthType.DXA },
  borders: (() => { const b = { style: BorderStyle.SINGLE, size: 4, color: "C9D3CE" }; return { top: b, bottom: b, left: b, right: b, insideHorizontal: none, insideVertical: none }; })(),
  rows: [new TableRow({ cantSplit: true, children: [new TableCell({ width: { size: w, type: WidthType.DXA }, shading: { fill: "F1F4F7" }, margins: { top: 60, bottom: 60, left: 160, right: 160 },
    children: lines.map((l) => new Paragraph({ spacing: { after: 0 }, children: (l === "" ? [{ t: " ", k: "ws" }] : tokenizeLine(l)).map((tk) => { const st = styleFor(tk.k);
      return new TextRun({ text: tk.t, font: "Consolas", size: 18, color: st.color, bold: !!st.bold, italics: !!st.italic, highlight: st.hl ? "yellow" : undefined }); }) })) })] })] });
function header(day) {
  const logo = fs.readFileSync(process.env.SKILL_DIR + "/assets/cs_logo_green.png");
  return [new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: [CW - 1300, 1300], borders: noB, rows: [new TableRow({ children: [
      new TableCell({ width: { size: CW - 1300, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [
        P([R("Dodge the Drop", { bold: true, size: 40, color: GREEN })], { after: 20 }),
        P([R(`Lesson 6 · ${day} · 7th Grade micro:bit`, { size: 21, color: GRAY })], { after: 0 })] }),
      new TableCell({ width: { size: 1300, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ data: logo, transformation: { width: 64, height: 63 }, type: "png" })] })] })] })] }),
    P([B("Name: "), BL(26), B("   Partner: "), BL(22)], { before: 120, after: 40 }),
    new Paragraph({ spacing: { after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: GREEN } }, children: [] })];
}
const bank = (words) => new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: [CW], borders: (() => { const b = { style: BorderStyle.SINGLE, size: 8, color: GREEN }; return { top: b, bottom: b, left: b, right: b, insideHorizontal: none, insideVertical: none }; })(),
  rows: [new TableRow({ children: [new TableCell({ width: { size: CW, type: WidthType.DXA }, shading: { fill: LIGHT }, margins: { top: 70, bottom: 70, left: 160, right: 160 },
    children: [P([R("Word bank:  ", { bold: true, color: GREEN }), R(words.join("     "), { bold: true })], { after: 0, align: AlignmentType.CENTER })] })] })] });
const reminder = () => P([R("❗ When you're finished, turn this sheet in to the turn-in bin.", { bold: true, color: GREEN, size: 22 })], { before: 160, after: 0 });

const k = [];
// ---------------- DAY 1 ----------------
k.push(...header("Day 1: Warm-ups"));
k.push(heading("Key Words", 60));
k.push(bank(["condition", "forever", "tilt", "indent", "True"]));
[[B("while loop"), R(" repeats code as long as its "), BL(12), R(" is True.")],
 [B("condition"), R(" is a question with a "), BL(8), R(" or False answer.")],
 [C("while True"), R(" runs "), BL(10), R(".")],
 [B("accelerometer"), R(" senses "), BL(8), R(".")],
 [B("Python"), R(" needs lines inside a loop to "), BL(8), R(" the same amount.")],
].forEach((kids, i) => k.push(P([R(`${i + 1}.  `, { bold: true, color: GREEN }), ...kids], { after: 70 })));
k.push(heading("Checklist"));
k.push(...item([B("Set up: "), R("open MakeCode, make a New Project called "), B("Warm-ups"), R(", and switch to "), B("Python"), R(".")]));
k.push(...item("Warm-up 1: A loop that counts", codeBlock(["count = 0", "while count < 5:", "    basic.show_number(count)", "    count += 1", "basic.show_string(\"Done!\")"]),
  [R("It counts from 0 to "), BL(5), R(", then shows "), BL(10), R(".")]));
k.push(...item("Warm-up 2: A heart that beats forever", [R("The loop that never stops is "), C("while"), R(" "), BL(8), R(" .")], [R("To beat faster, I changed 500 to "), BL(6), R(".")]));
k.push(...item("Warm-up 3: Wait for button A", [R("Nothing happens until I press button "), BL(4), R(".")]));
k.push(...item("Warm-up 4: Read the tilt", [R("Tilt left: "), BL(7), R("    Flat: "), BL(7), R("    Tilt right: "), BL(7)], [R("Tilting left gives  "), B("negative  /  positive"), R("  numbers. (circle one)")]));
k.push(...item("Warm-up 5: Build a tilt sensor (fill in the yellow blanks)", codeBlock(["while True:", "    x = input.acceleration(Dimension.X)", "    if x < ____:", "        basic.show_arrow(ArrowNames.WEST)", "    elif x > ____:", "        basic.show_arrow(ArrowNames.____)", "    else:", "        basic.clear_screen()", "    basic.pause(100)"])));
k.push(...item([B("Done: "), R("I ticked every "), B("Test it"), R(" box in Maker Lab for Day 1.")]));
k.push(reminder());

// ---------------- DAY 2 ----------------
k.push(new Paragraph({ pageBreakBefore: true, children: [] }));
k.push(...header("Day 2: Build the Game"));
k.push(heading("Key Words", 60));
k.push(bank(["sprite", "right", "bottom", "4", "random"]));
[[R("A "), BL(8), R(" is a game character you can move. On the micro:bit it's one LED.")],
 [B("x"), R(" goes from left to "), BL(8), R(".  "), B("y"), R(" goes from top to "), BL(8), R(".")],
 [R("The bottom row is "), C("y = "), BL(4), R(".")],
 [C("randint(0, 4)"), R(" picks a "), BL(8), R(" number from 0 to 4.")],
].forEach((kids, i) => k.push(P([R(`${i + 1}.  `, { bold: true, color: GREEN }), ...kids], { after: 70 })));
k.push(heading("Fill in the Game Code"));
k.push(codeBlock([
  "player = game.create_sprite(2, ___)              # bottom middle",
  "drop = game.create_sprite(randint(0, 4), ___)    # top row",
  "while not game.is_game_over():",
  "    x = input.acceleration(Dimension.X)",
  "    if x < -300:",
  "        player.change(LedSpriteProperty.X, ___)  # move left",
  "    elif x > 300:",
  "        player.change(LedSpriteProperty.X, ___)  # move right",
  "    basic.pause(300)",
  "    drop.change(LedSpriteProperty.___, 1)        # fall down",
  "    if drop.is_touching(______):                 # hit you?",
  "        game.game_over()",
  "    elif drop.get(LedSpriteProperty.Y) ___ 4:    # equal to 4?",
  "        game.add_score(1)",
  "        drop.set(LedSpriteProperty.Y, ___)       # back to top",
  "        drop.set(LedSpriteProperty.X, randint(0, 4))",
], CW - IND));
k.push(heading("Checklist"));
[["New Project called ", B("Dodge the Drop"), R(" (Python)")], [R("Make the two sprites")], [R("Tilt to move the player")], [R("Make the drop fall")],
 [R("Score a point and send the drop back up")], [R("Game over when the drop hits you")], [R("Checkpoint: the whole game works")],
 [B("Quiz"), R(" passed")], [R("Add one "), B("extension"), R(" (circle):  "), R("Press A to start · Sound · Buttons · Speed up · Second drop", { size: 18 })],
 [B("Ship it: "), R("Share → copy the link → paste it in Maker Lab")],
].forEach((kids) => k.push(...item(kids.map((x) => (typeof x === "string" ? R(x) : x)))));
k.push(P([B("My high score: "), BL(6), B("     My partner's: "), BL(6)], { before: 100 }));
k.push(reminder());

const doc = new Document({ styles: { default: { document: { run: { font: FONT } } } }, sections: [{ properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } }, children: k }] });
Packer.toBuffer(doc).then((b) => { fs.writeFileSync("/home/claude/work/Dodge_the_Drop_Checklist_7th.docx", b); console.log("done"); });
