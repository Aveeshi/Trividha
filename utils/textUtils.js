function cleanJsonString(raw) {
  if (!raw) return "{}";
  let cleaned = raw.trim();
  if (cleaned.startsWith("\`\`\`json")) {
    cleaned = cleaned.replace(/^\`\`\`json\s*/, "").replace(/\s*\`\`\`$/, "");
  } else if (cleaned.startsWith("\`\`\`")) {
    cleaned = cleaned.replace(/^\`\`\`\s*/, "").replace(/\s*\`\`\`$/, "");
  }
  return cleaned.trim();
}

module.exports = {
  cleanJsonString
};
