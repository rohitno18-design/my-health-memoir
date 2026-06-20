const apiKey = "AIzaSyBlKJQhfuuG00VxUQZU_vXbYbPkkq7S35E";
const model = "gemini-2.5-flash";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

async function test() {
    console.log("Testing Gemini API with model:", model);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Say hello in 3 words." }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 100 }
            })
        });
        const data = await res.json();
        console.log("Status:", res.status);
        if (res.ok) {
            console.log("✅ AI WORKS! Response:", data?.candidates?.[0]?.content?.parts?.[0]?.text);
        } else {
            console.log("❌ FAILED:", JSON.stringify(data, null, 2));
        }
    } catch(e) {
        console.error("EXCEPTION:", e.message);
    }
}
test();
