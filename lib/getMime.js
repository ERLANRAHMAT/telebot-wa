async function getMimeType(buffer) {
  const { fromBuffer } = require('file-type');
  const mime = await fromBuffer(buffer);
  if (!mime) throw new Error('Unable to determine MIME type');
  return mime.mime;
};

module.exports = { getMimeType };