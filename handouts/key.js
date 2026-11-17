const { Document, Packer, Paragraph, TextRun, BorderStyle } = require("docx");
const fs = require("fs");
const G = "1B5E42";
const R = (t, o = {}) => new TextRun({ text: t, size: o.size || 21, bold: !!o.bold, italics: !!o.italics, color: o.color || "1A1A1A", font: o.font });
const C = (t) => R(t, { font: "Consolas", bold: true, color: "0B6EA8", size: 19 });
const H = (t) => new Paragraph({ spacing: { before: 160, after: 60 }, keepNext: true, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: G } }, children: [R(t, { bold: true, color: G, size: 25 })] });
const L = (kids) => new Paragraph({ spacing: { after: 50 }, indent: { left: 260, hanging: 220 }, children: [R("•  ", { bold: true, color: G }), ...kids] });
const k = [
  new Paragraph({ spacing: { after: 30 }, children: [R("Answer Key: Dodge the Drop Checklist", { bold: true, color: G, size: 34 })] }),
  new Paragraph({ spacing: { after: 100 }, children: [R("Teacher only · 7th Grade micro:bit · Lesson 6", { italics: true })] }),
  H("Key Words (page 1)"),
  L([R("while loop: "), R("condition", { bold: true })]), L([R("condition: "), R("True", { bold: true })]), L([R("while True: "), R("forever", { bold: true })]),
  L([R("accelerometer: "), R("tilt", { bold: true })]), L([R("indent: "), R("indent", { bold: true }), R(" (be indented)")]), L([R("threshold: "), R("300", { bold: true })]),
  H("Day 1 Checklist"),
  L([R("Warm-up 1 shows "), R("0, 1, 2, 3, 4, then “Done!”", { bold: true }), R(". Without "), C("count += 1"), R(" it shows 0 forever (the condition never becomes False).")]),
  L([R("Warm-up 2: any number smaller than 500 beats faster (e.g. 250).")]),
  L([R("Warm-up 3: keeps waiting until A is "), R("pressed", { bold: true }), R(" (True).")]),
  L([R("Warm-up 4: numbers vary by device (roughly -1000 to 1000, flat near 0). Tilting "), R("left", { bold: true }), R(" is negative, "), R("right", { bold: true }), R(" is positive.")]),
  L([R("Warm-up 5 blanks: "), C("-300"), R(", "), C("300"), R(", "), C("EAST"), R(". At 600 it is "), R("LESS", { bold: true }), R(" sensitive: you must tilt farther before an arrow shows.")]),
  H("Day 2: Game Board"),
  L([R("x goes left to right; y goes top to bottom. Player x = 1, y = 4. Drop x = 3, y = 0. Bottom row is y = 4.")]),
  H("Day 2: Game Code Blanks (top to bottom)"),
  L([C("4"), R(", "), C("0"), R(", "), C("-1"), R(", "), C("1"), R(", "), C("Y"), R(", "), C("player"), R(", "), C("=="), R(", "), C("0")]),
  H("Quick Check"),
  L([R("1. If the drop reaches the bottom on top of the player, it should be game over, not a point. Checking the hit first (and using "), C("elif"), R(") stops a hit from scoring.")]),
  L([R("2. A while loop repeats "), R("as long as its condition is True", { bold: true }), R(". Games use it because they don't know ahead of time how long you'll last.")]),
  L([R("3. You could stay in one place and never get hit, so the game would be too easy.")]),
];
const doc = new Document({ sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 900, bottom: 900, left: 900, right: 900 } } }, children: k }] });
Packer.toBuffer(doc).then((b) => { fs.writeFileSync("Dodge_the_Drop_Checklist_ANSWER_KEY.docx", b); console.log("ok"); });
