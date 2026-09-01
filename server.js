require("dotenv").config();

const path = require("path");
const bcrypt = require("bcryptjs");
const express = require("express");

const app = express();
const PORT = 3000;

// Let Express read submitted HTML form data and serve the existing website files.
app.use(express.urlencoded({ extended: false }));
app.use(express.static(__dirname));

// Test route to confirm the backend is running.
app.get("/api/health", (request, response) => {
  response.json({
    status: "ok",
    message: "SkillRoom backend is running",
  });
});

// Show the existing SkillRoom homepage.
app.get("/", (request, response) => {
  response.sendFile(path.join(__dirname, "index.html"));
});

// Show the admin login page.
app.get("/admin/login", (request, response) => {
  response.sendFile(path.join(__dirname, "admin-login.html"));
});

// Check submitted admin login details against private .env settings.
app.post("/admin/login", (request, response) => {
  const email = request.body.email;
  const password = request.body.password;

  const emailMatches = email === process.env.ADMIN_EMAIL;
  const passwordMatches = bcrypt.compareSync(
    password,
    process.env.ADMIN_PASSWORD_HASH,
  );

  if (!emailMatches || !passwordMatches) {
    return response.status(401).send("Invalid admin login details.");
  }

  response.send(
    "Admin login successful. Dashboard protection will be added next.",
  );
});

// Start the local development server.
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
