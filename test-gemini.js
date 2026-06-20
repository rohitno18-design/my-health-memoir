const apiKey = "AIzaSyBlKJQhfuuG00VxUQZU_vXbYbPkkq7S35E";
const model = "gemini-1.5-flash";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

async function test() {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Hello" }] }]
            })
        });
        const data = await res.text();
        console.log("Status:", res.status);
        console.log("Data:", data);
    } catch(e) {
        console.error(e);
    }
}
test();
