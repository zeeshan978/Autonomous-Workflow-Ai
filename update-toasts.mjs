import fs from 'fs';
import path from 'path';

const dir = 'src/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const p = path.join(dir, file);
  let content = fs.readFileSync(p, 'utf8');
  let changed = false;

  content = content.replace(/catch\s*\((error|err)\)\s*\{\s*console\.error\([^)]+\);\s*toast\(\{\s*title:\s*([^,]+),\s*variant:\s*'destructive'\s*\}\);/g, (match, errName, title) => {
    changed = true;
    return `catch (${errName}: any) { console.error(${errName}); toast({ title: ${title}, description: ${errName}?.message || String(${errName}), variant: 'destructive' });`;
  });

  content = content.replace(/catch\s*\((error|err)\)\s*\{\s*toast\(\{\s*title:\s*([^,]+),\s*variant:\s*'destructive'\s*\}\);/g, (match, errName, title) => {
    changed = true;
    return `catch (${errName}: any) { toast({ title: ${title}, description: ${errName}?.message || String(${errName}), variant: 'destructive' });`;
  });

  content = content.replace(/catch\s*\((error|err)\)\s*\{\s*toast\(\{\s*title:\s*([^,}]+)\s*\}\);/g, (match, errName, title) => {
    changed = true;
    return `catch (${errName}: any) { toast({ title: ${title}, description: ${errName}?.message || String(${errName}), variant: 'destructive' });`;
  });

  if (changed) {
    fs.writeFileSync(p, content);
    console.log('Updated ' + file);
  }
}
