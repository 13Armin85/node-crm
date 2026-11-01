const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase('tr')
  .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim();
module.exports = { normalize };
