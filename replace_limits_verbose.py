import os
import re

files_to_update = [
    'index.html',
    'index-web.html',
    'main.js',
    'renderer.js',
    'renderer-web.js'
]

replacements = {
    'index.html': [
        (r'min="20" max="70"', r'min="20" max="110"'),
        (r'Expected 20-70', r'Expected 20-110'),
    ],
    'index-web.html': [
        (r'min="20" max="70"', r'min="20" max="110"'),
    ],
    'main.js': [
        (r'value 20\.\.70', r'value 20..110'),
        (r'Math\.min\(70,', r'Math.min(110,'),
        (r'value as single byte \(20-70\)', r'value as single byte (20-110)')
    ],
    'renderer.js': [
        (r'value \(20-70', r'value (20-110'),
        (r'range \(20-70', r'range (20-110'),
        (r'expected 20-70', r'expected 20-110'),
        (r'expected 20\-70', r'expected 20-110'),
        (r'<= 70', r'<= 110'),
        (r'Math\.min\(70,', r'Math.min(110,'),
        (r'temp - 20\) / \(70 - 20\)', r'temp - 20) / (110 - 20)')
    ],
    'renderer-web.js': [
        (r'temp - 20\) / \(70 - 20\)', r'temp - 20) / (110 - 20)')
    ]
}

def update_file(filepath, reps):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
    with open(filepath, 'rb') as f:
        raw = f.read()
    
    # Try utf-16le first, if not try utf-8
    encoding = 'utf-16le'
    try:
        content = raw.decode('utf-16le')
        # Check if it looks right
        if '\x00' in content: 
            encoding = 'utf-8'
    except UnicodeDecodeError:
        encoding = 'utf-8'
        
    try:
        with open(filepath, 'r', encoding=encoding) as f:
            content = f.read()
            
        modified = content
        for pattern, replacement in reps:
            old_mod = modified
            modified = re.sub(pattern, replacement, modified)
            if old_mod != modified:
                print(f"  Applied {pattern} -> {replacement}")
            
        if modified != content:
            with open(filepath, 'w', encoding=encoding) as f:
                f.write(modified)
            print(f"Updated {filepath} ({encoding})")
        else:
            print(f"No changes needed for {filepath}")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

for filepath in files_to_update:
    if filepath in replacements:
        update_file(filepath, replacements[filepath])
