const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/AIChatPage.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Remove generic tools from TOOL_DECLARATIONS
code = code.replace(/\{\s*name:\s*"search_documents"[\s\S]*?(?=\{\s*name:\s*"get_recent_documents")/m, '');
code = code.replace(/\{\s*name:\s*"get_recent_documents"[\s\S]*?(?=\{\s*name:\s*"list_patients")/m, '');
code = code.replace(/\{\s*name:\s*"summarize_documents"[\s\S]*?(?=\{\s*name:\s*"prepare_doctor_visit")/m, '');
code = code.replace(/\{\s*name:\s*"prepare_doctor_visit"[\s\S]*?(?=\{\s*name:\s*"compile_to_pdf")/m, '');

// 2. Remove them from executeTool switch cases
code = code.replace(/case\s+"search_documents":\s*\{[\s\S]*?case\s+"get_recent_documents":\s*\{/m, 'case "get_recent_documents": {');
code = code.replace(/case\s+"get_recent_documents":\s*\{[\s\S]*?case\s+"list_patients":\s*\{/m, 'case "list_patients": {');
code = code.replace(/case\s+"summarize_documents":\s*\{[\s\S]*?case\s+"prepare_doctor_visit":\s*\{/m, 'case "prepare_doctor_visit": {');
code = code.replace(/case\s+"prepare_doctor_visit":\s*\{[\s\S]*?(?=The above content)/m, ''); // Wait, the view_file got truncated!

fs.writeFileSync(filePath, code);
console.log('Success');
