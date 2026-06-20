import sys

with open('src/pages/DocumentsPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Define the strings that start a modal
modals = [
    '{viewSummary && (',
    '{showLanguageModalForDoc && (',
    '{addToTimelineDoc && (',
    '{editingDoc && (',
    '{viewingLinksDoc && (',
    '{createFolderModalOpen && (',
    '{renamingFolder && (',
    '{deletingFolder && (',
    '{addDocToEventId && (',
    '{moveDocId && (',
    '{shareDoc && ('
]

for m in modals:
    if m in code:
        # Find the index of m
        start_idx = code.find(m)
        # We need to find the matching closing parenthesis for the ( that is opened in m.
        # m ends with a '('.
        paren_count = 1
        i = start_idx + len(m)
        while i < len(code) and paren_count > 0:
            if code[i] == '(':
                paren_count += 1
            elif code[i] == ')':
                paren_count -= 1
            i += 1
        
        # i - 1 is the index of the closing ')'
        if paren_count == 0:
            # Replace `m` with `{VAR && createPortal(`
            new_m = m.replace('&& (', '&& createPortal(')
            
            # The closing ')' needs to become `, document.body)`
            # We construct the new string
            before = code[:start_idx]
            middle = code[start_idx + len(m):i - 1]
            after = code[i - 1:]
            
            # after starts with ')'
            after = ', document.body)' + after[1:]
            
            code = before + new_m + middle + after

# Special case for activeDocMenu
# {activeDocMenu && (() => {
#     const doc = docs.find...
#     if (!doc) return null;
#     return (
#         <div className="fixed inset-0...
#     );
# })()}
m_active = '{activeDocMenu && (() => {'
if m_active in code:
    start_idx = code.find(m_active)
    
    # We find `return (` inside this block
    ret_idx = code.find('return (', start_idx)
    if ret_idx != -1:
        # Find the matching closing `)` for `return (`
        paren_count = 1
        i = ret_idx + len('return (')
        while i < len(code) and paren_count > 0:
            if code[i] == '(':
                paren_count += 1
            elif code[i] == ')':
                paren_count -= 1
            i += 1
        
        if paren_count == 0:
            before = code[:ret_idx]
            middle = code[ret_idx + len('return ('):i - 1]
            after = code[i - 1:]
            
            new_ret = 'return createPortal('
            after = ', document.body)' + after[1:]
            
            code = before + new_ret + middle + after

# Write back
with open('src/pages/DocumentsPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Modals wrapped in createPortal successfully!")
