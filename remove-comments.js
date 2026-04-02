#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script untuk menghapus single-line comments (//)
 * - Preserve block comments (/** ... */)
 * - Preserve comments yang penting
 * - Preserve URLs dan strings
 */

const PRESERVE_PATTERNS = [
    /http:\/\/|https:\/\//,  // URLs
    /\/\/ TODO|\/\/ FIXME|\/\/ NOTE|\/\/ WARNING|\/\/ BUG/,  // Important markers
    /\/\/ export|\/\/ import|\/\/ type|\/\/ interface/,  // Type annotations
];

const IMPORTANT_KEYWORDS = [
    'ignore',
    'disable',
    'enable',
    'prefer',
    'unsafe',
    'ts-',
    'eslint',
    'pragma'
];

function shouldPreserveComment(comment) {
    // Check important patterns
    if (PRESERVE_PATTERNS.some(pattern => pattern.test(comment))) {
        return true;
    }
    
    // Check important keywords
    if (IMPORTANT_KEYWORDS.some(keyword => comment.toLowerCase().includes(keyword))) {
        return true;
    }
    
    // Preserve very short comments (might be code instruction)
    if (comment.length < 10) {
        return true;
    }
    
    return false;
}

function removeComments(content) {
    let result = '';
    let i = 0;
    
    while (i < content.length) {
        // Check for block comment /* */
        if (content[i] === '/' && content[i + 1] === '*') {
            const start = i;
            i += 2;
            
            // Find end of block comment
            while (i < content.length - 1) {
                if (content[i] === '*' && content[i + 1] === '/') {
                    i += 2;
                    break;
                }
                i++;
            }
            
            // Preserve block comment
            result += content.substring(start, i);
            continue;
        }
        
        // Check for single-line comment //
        if (content[i] === '/' && content[i + 1] === '/') {
            const start = i;
            const commentStart = i + 2;
            let end = commentStart;
            
            // Find end of line
            while (end < content.length && content[end] !== '\n') {
                end++;
            }
            
            const comment = content.substring(commentStart, end).trim();
            
            // Check if should preserve
            if (shouldPreserveComment(comment)) {
                result += content.substring(start, end);
            } else {
                // Remove comment but keep newline
                if (content[end] === '\n') {
                    result += '\n';
                    end++;
                }
            }
            
            i = end;
            continue;
        }
        
        // Check for string literals to avoid removing // inside strings
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
    
    // Clean up extra blank lines (max 2 consecutive)
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
        return false;
    } catch (err) {
        console.error(`✗ ${filePath}: ${err.message}`);
        return false;
    }
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
            } catch (e) {
                // skip
            }
        });
    } catch (e) {
        // skip
    }
}

// Main
const baseDir = process.argv[2] || '/workspaces/baileys/lib';
console.log(`🔍 Scanning: ${baseDir}\n`);

let processed = 0;
let modified = 0;

walkDir(baseDir, (file) => {
    processed++;
    if (processFile(file)) {
        modified++;
    }
});

console.log(`\n📊 Summary: ${modified}/${processed} files modified`);
