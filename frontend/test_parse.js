const fs = require('fs');
const parser = require('@babel/parser');
const code = fs.readFileSync('./src/pages/admin/EmployeesPage.tsx', 'utf8');
const lines = code.split('\n');

const fixed = code.replace('{doc.url!.startsWith', '{doc.url?.startsWith');
try {
  parser.parse(fixed, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  console.log('With optional chain: PARSES OK - doc.url! was the bug!');
} catch(e) {
  console.log('Still fails at line', e.loc?.line);
}

const problemLine = lines.findIndex(l => l.includes('doc.url!'));
console.log('Problem line', problemLine+1, ':', lines[problemLine]);
