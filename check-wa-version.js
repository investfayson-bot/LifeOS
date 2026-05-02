const https = require("https");
https.get(
  "https://web.whatsapp.com/check-update?version=1&platform=web",
  { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } },
  (r) => {
    let d = "";
    r.on("data", (c) => (d += c));
    r.on("end", () => console.log(d.substring(0, 300)));
  }
).on("error", (e) => console.log("ERR:" + e.message));
