// Tests the EXACT same flow as the cloud function
const apiKey = "AIzaSyBlKJQhfuuG00VxUQZU_vXbYbPkkq7S35E";
const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-001"];

async function testModel(model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ 
                    role: "user",
                    parts: [{ text: "Summarize this: Patient has diabetes. HbA1c: 7.2%. Doctor: Dr. Sharma." }]
                }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
            })
        });
        const data = await res.json();
        if (!res.ok) {
            console.log(`❌ ${model}: HTTP ${res.status} - ${data?.error?.message}`);
            return false;
        }
        const parts = data?.candidates?.[0]?.content?.parts || [];
        console.log(`   Parts count: ${parts.length}`);
        parts.forEach((p, i) => {
            console.log(`   Part[${i}]: thought=${p.thought || false}, text_length=${p.text?.length || 0}`);
        });
        const textPart = parts.find(p => !p.thought);
        const text = textPart?.text;
        if (text) {
            console.log(`✅ ${model}: WORKS! Response: "${text.substring(0, 80)}..."`);
            return true;
        } else {
            console.log(`⚠️  ${model}: HTTP OK but no text in response. Full response:`, JSON.stringify(data?.candidates?.[0]?.content, null, 2));
            return false;
        }
    } catch(e) {
        console.log(`❌ ${model}: Exception - ${e.message}`);
        return false;
    }
}

async function main() {
    for (const model of models) {
        await testModel(model);
        console.log("");
    }
}
main();
