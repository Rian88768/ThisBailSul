#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PRESERVE_KEYWORDS = ['TODO', 'FIXME', 'NOTE', 'WARNING', 'BUG', 'export', 'import', 'type', 'interface', 'http', 'https', 'eslint', 'ts-', 'disable', 'enable', 'pragma', 'unsafe'];

function removeComments(content) {
    let result = '';
    let i = 0;
    
    while (i < content.length) {
        if (content[i] === '/' && content[i + 1] === '*') {
            const start = i;
            i += 2;
            while (i < content.length - 1) {
                if (content[i] === '*' && content[i + 1] === '/') {
                    i += 2;
                    break;
                }
                i++;
            }
            result += content.substring(start, i);
            continue;
        }
        
        if (content[i] === '/' && content[i + 1] === '/') {
            const start = i;
            let end = i + 2;
            while (end < content.length && content[end] !== '\n') {
                end++;
            }
            
            const comment = content.substring(i + 2, end).trim();
            const preserve = PRESERVE_KEYWORDS.some(kw => comment.includes(kw)) || comment.length < 10;
            
            if (preserve) {
                result += content.substring(start, end);
            }
            
            if (content[end] === '\n') {
                result += '\n';
                i = end + 1;
            } else {
                i = end;
            }
            continue;
        }
        
        if (content[i] === '"' || content[i] === "'" || content[i] === '`') {
            const quote = content[i];
            result += content[i];
            i++;
            while (i < content.length) {
                if (content[i] === '\\') {
                    result += content[i] + content[i + 1];
                    i += 2;
                    continue;
                }
                if (content[i] === quote) {
                    result += content[i];
                    i++;
                    break;
                }
                result += content[i];
                i++;
            }
            continue;
        }
        
        result += content[i];
        i++;
    }
    
    result = result.replace(/\n\n\n+/g, '\n\n');
    return result;
}

function processFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const cleaned = removeComments(content);
        if (content !== cleaned) {
            fs.writeFileSync(filePath, cleaned, 'utf-8');
            console.log(`✓ ${filePath}`);
            return true;
        }
    } catch (err) {
        console.error(`✗ ${filePath}: ${err.message}`);
    }
    return false;
}

function walkDir(dir, callback) {
    try {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const filePath = path.join(dir, file);
            try {
                const stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(file)) {
                        walkDir(filePath, callback);
                    }
                } else if ((file.endsWith('.js') || file.endsWith('.ts')) && !file.endsWith('.d.ts')) {
                    callback(filePath);
                }
            } catch (e) {}
        });
    } catch (e) {}
}

const baseDir = process.argv[2] || '/workspaces/baileys/lib';
console.log(`Scanning: ${baseDir}\n`);

let processed = 0;
let modified = 0;

walkDir(baseDir, (file) => {
    processed++;
    if (processFile(file)) {
        modified++;
    }
});

console.log(`\nDone: ${modified}/${processed} files modified`);
