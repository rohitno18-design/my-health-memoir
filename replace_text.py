import sys

def replace_input_text_size(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    in_input = False
    for i, line in enumerate(lines):
        if '<input' in line:
            in_input = True
        
        if in_input:
            if 'text-sm' in line:
                lines[i] = line.replace('text-sm', 'text-base')
            
            if '/>' in line or '</input>' in line:
                in_input = False

    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)

replace_input_text_size('src/pages/LoginPage.tsx')
replace_input_text_size('src/pages/RegisterPage.tsx')
replace_input_text_size('src/pages/DocumentsPage.tsx')
replace_input_text_size('src/components/GlobalSearchModal.tsx')
print("Replaced text-sm with text-base successfully")
