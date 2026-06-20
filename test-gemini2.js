const apiKey = "AIzaSyBlKJQhfuuG00VxUQZU_vXbYbPkkq7S35E";
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

async function test() {
    try {
        const res = await fetch(url);
        const data = await res.json();
        const models = data.models.filter(m => m.name.includes("flash")).map(m => m.name);
        console.log(models);
    } catch(e) {
        console.error(e);
    }
}
test();
