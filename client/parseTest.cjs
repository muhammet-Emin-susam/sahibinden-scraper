const XLSX = require("xlsx-js-style");
var wb = XLSX.utils.book_new();
var ws = XLSX.utils.aoa_to_sheet([ ["Name", "Age"], ["John", 30] ]);
ws["B2"].s = { fill: { fgColor: { rgb: "FFFF00" } }, font: { color: { rgb: "FF0000" } } };
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
const buffer = XLSX.write(wb, { type: "buffer", cellStyles: true });

const wb2 = XLSX.read(buffer, { type: "buffer", cellStyles: true });
console.log(wb2.Sheets.Sheet1["B2"].s);
