// Load Node.js's built-in path module.
// Benefit: It helps us create safe file paths that work on Windows, Mac, and Linux.
const path = require("path");

// Load Express, a helper framework for building servers with Node.js.
// Benefit: Express makes routes easier to write and understand.
const express = require("express");

// Create the Express application.
// This app receives browser requests and sends responses.
const app = express();

// Choose the port where our local server will run.
// 3000 is commonly used for local backend development.
const PORT = 3000;

// Tell Express to serve normal website files from this project folder.
// Benefit: index.html, styles.css, app.js, and assets can load through Node.js.
app.use(express.static(__dirname));

// Create a simple backend test route.
// When the browser visits http://localhost:3000/api/health,
// the server sends back a small JSON response.
app.get("/api/health", (request, response) => {
  response.json({
    status: "ok",
    message: "SkillRoom backend is running",
  });
});

// Send index.html when someone visits the homepage.
// Benefit: http://localhost:3000 will show your existing SkillRoom homepage.
app.get("/", (request, response) => {
  response.sendFile(path.join(__dirname, "index.html"));
});

// Start the Express server.
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
