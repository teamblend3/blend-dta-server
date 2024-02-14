const getSheetIdIndex = splitBySlash => {
  return splitBySlash.indexOf("d") + 1;
};

const isInvalidSheet = (spreadsheetIdIndex, splitBySlash) => {
  return !spreadsheetIdIndex || spreadsheetIdIndex >= splitBySlash.length;
};

module.exports = { getSheetIdIndex, isInvalidSheet };
