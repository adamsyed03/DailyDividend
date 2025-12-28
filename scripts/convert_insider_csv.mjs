import fs from 'fs';

const csvPath = 'c:/Users/adamk/Downloads/insider_monitor_FANGS_deduped.csv';
const csv = fs.readFileSync(csvPath, 'utf8');
const lines = csv.split('\n').filter(l => l.trim());

// Parse CSV manually handling quoted fields
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += line[i];
    }
  }
  values.push(current.trim());
  return values;
}

const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ''));
const data = lines.slice(1).map(line => {
  const values = parseCSVLine(line);
  return {
    company: values[0]?.replace(/^"|"$/g, '') || '',
    position: values[1]?.replace(/^"|"$/g, '') || '',
    name: values[2] || '',
    quantity: parseFloat(values[3]) || 0,
    transactionType: values[4] || '',
    date: values[5] || ''
  };
}).filter(d => d.company && d.company !== 'company');

// Ensure data directory exists
if (!fs.existsSync('data')) {
  fs.mkdirSync('data', { recursive: true });
}

fs.writeFileSync('data/insider-moves.json', JSON.stringify(data, null, 2));
console.log(`Converted ${data.length} records to data/insider-moves.json`);

