const { Document, Packer, Paragraph, TextRun, BorderStyle } = require("docx");
const fs = require("fs");
const G = "1B5E42", F = "Lexend";
const R = (t, o = {}) => new TextRun({ text: t, font: o.font || F, size: o.size || 21, bold: !!o.bold, color: o.color || "1A1A1A" });
const C = (t) => R(t, { font: "Consolas", bold: true, color: "0B6EA8", size: 20 });
const H = (t) => new Paragraph({ spacing: { before: 180, after: 70 }, keepNext: true, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: G } }, children: [R(t, { bold: true, color: G, size: 25 })] });
const L = (...kids) => new Paragraph({ spacing: { after: 60 }, indent: { left: 260, hanging: 220 }, children: [R("•  ", { bold: true, color: G }), ...kids] });
const k = [
  new Paragraph({ spacing: { after: 30 }, children: [R("Answer Key: Dodge the Drop Checklist", { bold: true, color: G, size: 34 })] }),
  new Paragraph({ spacing: { after: 80 }, children: [R("Teacher only · Lesson 6 · 7th Grade micro:bit", { color: "5B6770" })] }),
  H("Day 1: Key Words"),
  L(R("1. condition   2. True   3. forever   4. tilt   5. indent")),
  H("Day 1: Checklist"),
  L(R("Warm-up 1: counts 0 to "), R("4", { bold: true }), R(", then shows "), R("Done!", { bold: true })),
  L(R("Warm-up 2: "), C("while True"), R(". Any number smaller than 500 beats faster (for example 250).")),
  L(R("Warm-up 3: button "), R("A", { bold: true })),
  L(R("Warm-up 4: readings vary by micro:bit (about -1000 to 1000, flat near 0). Tilting left gives "), R("negative", { bold: true }), R(" numbers.")),
  L(R("Warm-up 5: "), C("-300"), R(",  "), C("300"), R(",  "), C("EAST")),
  H("Day 2: Key Words"),
  L(R("1. sprite   2. right, bottom   3. 4   4. random")),
  H("Day 2: Game Code (top to bottom)"),
  L(C("4"), R(",  "), C("0"), R(",  "), C("-1"), R(",  "), C("1"), R(",  "), C("Y"), R(",  "), C("player"), R(",  "), C("=="), R(",  "), C("0")),
];
const doc = new Document({ styles: { default: { document: { run: { font: F } } } }, sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 900, bottom: 900, left: 900, right: 900 } } }, children: k }] });
Packer.toBuffer(doc).then((b) => { fs.writeFileSync("Dodge_the_Drop_Checklist_ANSWER_KEY.docx", b); console.log("ok"); });
