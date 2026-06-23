const fetch = require('node-fetch');

async function testProxy() {
    const url = "https://us-central1-im-smrti.cloudfunctions.net/proxyGemini";
    
    const payload = {
        data: {
            contents: [
                {
                    role: "user",
                    parts: [{ text: "Respond with the word SUCCESS if you can hear me." }]
                }
            ],
            // We omit userId to bypass rate limiting during this quick test
            // Or we can provide a dummy userId
            userId: "test-user-123"
        }
    };

    console.log("Testing proxyGemini at", url);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const status = response.status;
        const body = await response.text();
        
        console.log(`Status: ${status}`);
        if (status === 200) {
            console.log("Response JSON:", JSON.stringify(JSON.parse(body), null, 2));
            console.log("o. proxyGemini successfully connected to Gemini API and returned a valid response!");
        } else {
            console.error("?O proxyGemini failed:", body);
        }
    } catch (err) {
        console.error("Fetch error:", err.message);
    }
}

testProxy();
