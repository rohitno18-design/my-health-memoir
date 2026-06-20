const fs = require('fs');

let code = fs.readFileSync('src/pages/DocumentsPage.tsx', 'utf8');

const modalsToWrap = [
    'viewSummary',
    'showLanguageModalForDoc',
    'addToTimelineDoc',
    'editingDoc',
    'viewingLinksDoc',
    'createFolderModalOpen',
    'renamingFolder',
    'deletingFolder',
    'addDocToEventId',
    'moveDocId',
    'shareDoc'
];

for (const m of modalsToWrap) {
    // Regex matches `{modalState && (` or `{modalState && (\n`
    // And ends with `)}` at the correct indentation
    // Since simple regex for nested parens is hard, we can do string replacement
    const searchStr = `{${m} && (`;
    let idx = code.indexOf(searchStr);
    if (idx === -1) {
        const altSearchStr = `{${m} !== null && (`;
        idx = code.indexOf(altSearchStr);
        if (idx === -1) {
             const altSearchStr2 = `{${m} ? (`;
             idx = code.indexOf(altSearchStr2);
        }
    }
    
    if (idx !== -1) {
        // Just manually replace `(` with `createPortal(`
        // And find the matching closing `)` for the modal wrapper
        // But the easiest hack since the modals are at the end of the file:
        // Search for `<div className=\"fixed inset-0` and the closing `</div>` 
        // We can just use the tool `multi_replace_file_content` instead if this is too complex.
    }
}
