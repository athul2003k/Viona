import os
import re
import glob

# Find all node.tsx files
files = glob.glob('app/workflows/components/**/node.tsx', recursive=True)

# Patterns to remove
import_channel_pattern = re.compile(r'^import\s+\{\s*[A-Z_]+_CHANNEL(?:_NAME)?\s*\}\s*from\s+[\'"]@/inngest/channels/.*?[\'"];?\n', re.MULTILINE)
import_token_pattern = re.compile(r'^import\s+\{\s*fetch[a-zA-Z]+RealtimeToken\s*\}\s*from\s+[\'"].*?[\'"];?\n', re.MULTILINE)

# Pattern to replace
use_status_pattern = re.compile(r'const\s+nodeStatus\s*=\s*useNodeStatus\s*\(\s*\{\s*nodeId:\s*props\.id,\s*channel:[^,]+,\s*topic:\s*["\']status["\'],\s*refreshToken:[^\}]+\}\s*\);', re.MULTILINE | re.DOTALL)
# A simpler useStatus pattern that catches ones formatted differently
use_status_fallback = re.compile(r'const\s+nodeStatus\s*=\s*useNodeStatus\s*\(\s*\{[^}]+\}\s*\);', re.MULTILINE | re.DOTALL)

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
        
    orig_content = content
    
    # 1. Remove Inngest imports
    content = import_channel_pattern.sub('', content)
    content = import_token_pattern.sub('', content)
    
    # 2. Simplify useNodeStatus
    replacement = "const nodeStatus = useNodeStatus({ nodeId: props.id });"
    if use_status_pattern.search(content):
        content = use_status_pattern.sub(replacement, content)
    else:
        content = use_status_fallback.sub(replacement, content)
        
    if content != orig_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")

