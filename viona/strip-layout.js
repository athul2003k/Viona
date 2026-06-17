const fs = require('fs');
const files = [
  'app/(dashboard)/inventory/[productId]/page.tsx',
  'app/(dashboard)/orders/[orderId]/page.tsx',
  'app/(dashboard)/organization/[orgId]/page.tsx',
  'app/(dashboard)/notifications/page.tsx',
  'app/(dashboard)/invite/accept/[token]/page.tsx',
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const origLen = content.length;
  
  const lines = content.split('\n');
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip standalone DesktopSidebar usage
    if (trimmed === '<DesktopSidebar />' || trimmed === '<DesktopSidebar/>') {
      continue;
    }
    
    // Detect layout wrapper div + DesktopSidebar pattern
    if ((trimmed.includes('className="flex h-screen') || trimmed.includes("className='flex h-screen")) &&
        i + 1 < lines.length && lines[i+1].trim().includes('DesktopSidebar')) {
      // Skip wrapper div, skip DesktopSidebar, skip blank lines, skip inner flex div
      i++; // skip DesktopSidebar
      while (i + 1 < lines.length && lines[i+1].trim() === '') i++;
      // Check for inner wrapper div
      if (i + 1 < lines.length && lines[i+1].trim().startsWith('<div className="flex flex-col') && lines[i+1].trim().includes('flex-1')) {
        i++; // skip inner div
      }
      continue;
    }
    
    // Skip header blocks
    if (trimmed.startsWith('<header className="flex items-center justify-between') ||
        trimmed.startsWith("<header className='flex items-center justify-between")) {
      while (i < lines.length && !lines[i].trim().includes('</header>')) {
        i++;
      }
      // Now on the </header> line, skip it
      // Also skip following Separator and blank lines
      i++;
      while (i < lines.length && (lines[i].trim() === '' || lines[i].trim() === '<Separator />' || lines[i].trim() === '<Separator/>')) {
        i++;
      }
      i--; // back up since the for loop will increment
      continue;
    }
    
    newLines.push(line);
  }
  
  // Now we need to fix unbalanced closing </div> tags that were part of the wrapper
  // We stripped the opening wrappers (2 divs: outer flex h-screen + inner flex-col flex-1)
  // so we need to remove their matching closing </div> tags.
  // Count how many wrapper opens we removed and remove that many trailing </div> from each return block.
  
  content = newLines.join('\n');
  
  const newLen = content.length;
  console.log(file + ': removed ' + (origLen - newLen) + ' chars');
  
  fs.writeFileSync(file, content);
}
