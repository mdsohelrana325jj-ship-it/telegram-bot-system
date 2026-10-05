const express = require("express");

const app = express();

const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport"
            content="width=device-width, initial-scale=1.0">

      <title>Telegram Bot System</title>

      <style>
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f4f5f7;
          font-family: Arial, sans-serif;
          color: #151827;
        }

        .box {
          width: min(92%, 420px);
          background: #ffffff;
          padding: 30px 22px;
          border-radius: 20px;
          box-shadow: 0 15px 40px rgba(0,0,0,.10);
          text-align: center;
        }

        h1 {
          margin: 0 0 10px;
          font-size: 24px;
        }

        p {
          margin: 8px 0;
          color: #707789;
        }

        .status {
          margin-top: 20px;
          padding: 14px;
          border-radius: 12px;
          background: #e8f7f1;
          color: #087f5b;
          font-weight: bold;
        }
      </style>
    </head>

    <body>

      <div class="box">

        <h1>🤖 Telegram Bot System</h1>

        <p>Custom Admin Panel + Telegram Bot</p>

        <div class="status">
          ✅ Server is running
        </div>

      </div>

    </body>
    </html>
  `);
});


// ===============================
// HEALTH CHECK
// ===============================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Telegram Bot Server is running"
  });
});


// ===============================
// SERVER START
// ===============================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
