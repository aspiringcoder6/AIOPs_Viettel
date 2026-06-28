export function formatDate(value) {
  if (!value) {
    return "n/a";
  }

  return new Date(value).toISOString().replace("T", " ").slice(0, 19);
}

export function formatList(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return "none";
  }

  return values
    .map((value, index) => `${index + 1}. ${value}`)
    .join("\n");
}

export function printRows(rows, emptyMessage, formatter) {
  if (rows.length === 0) {
    console.log(emptyMessage);
    return;
  }

  rows.forEach((row, index) => {
    if (index > 0) {
      console.log("");
    }

    console.log(formatter(row));
  });
}
