const http = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const nodemailer = require("nodemailer");

const port = Number(process.env.PORT) || 3000;
const adminEmail = process.env.ADMIN_EMAIL || "ankitvchaudhari@gmail.com";
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpConfigured = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);
const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: process.env.SMTP_SECURE === "true" || smtpPort === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;
const recentSubmissions = new Map();
const submissionWindowMs = 10 * 60 * 1000;
const submissionLimit = 5;
const maxRequestBytes = 10 * 1024;
const indexPath = path.join(__dirname, "index.html");

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > maxRequestBytes) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Send the form using valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function getSubmissionError(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Please provide the requested form details.";
  }
  const { name, email, phone, message, company } = body;
  if ([name, email, phone, message, company].some((value) => value !== undefined && typeof value !== "string")) {
    return "Form fields must contain text.";
  }
  if (typeof name !== "string" || name.trim().length < 1 || name.trim().length > 100) {
    return "Enter your name (up to 100 characters).";
  }
  if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Enter a valid email address.";
  }
  if (typeof phone !== "string" || phone.length > 30) {
    return "The mobile number must be 30 characters or fewer.";
  }
  if (typeof message !== "string" || message.trim().length < 1 || message.trim().length > 3000) {
    return "Enter a message (up to 3,000 characters).";
  }
  return null;
}

function isRateLimited(request) {
  const now = Date.now();
  const clientAddress = request.socket.remoteAddress || "unknown";
  const recent = (recentSubmissions.get(clientAddress) || []).filter(
    (timestamp) => now - timestamp < submissionWindowMs
  );
  if (recent.length >= submissionLimit) {
    recentSubmissions.set(clientAddress, recent);
    return true;
  }
  recent.push(now);
  recentSubmissions.set(clientAddress, recent);
  return false;
}

async function handleContact(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "Use POST to send a message." });
    return;
  }
  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
    sendJson(response, 415, { error: "Send the form as JSON." });
    return;
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message });
    return;
  }

  const validationError = getSubmissionError(body);
  if (validationError) {
    sendJson(response, 400, { error: validationError });
    return;
  }
  if (body.company.trim()) {
    sendJson(response, 200, { success: true });
    return;
  }
  if (isRateLimited(request)) {
    sendJson(response, 429, { error: "Too many messages. Please try again later." });
    return;
  }
  if (!transporter) {
    console.error("Contact form email is unavailable: SMTP environment settings are missing.");
    sendJson(response, 503, { error: "Message sending is not configured yet. Please try again later." });
    return;
  }

  const name = body.name.trim();
  const email = body.email.trim();
  const phone = body.phone.trim();
  const message = body.message.trim();
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: adminEmail,
      replyTo: email,
      subject: "New message from your personal website",
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        `Mobile: ${phone || "Not provided"}`,
        "",
        "Message:",
        message
      ].join("\n")
    });
    sendJson(response, 200, { success: true });
  } catch (error) {
    console.error("Contact form email delivery failed:", error.message);
    sendJson(response, 502, { error: "We could not deliver your message. Please try again later." });
  }
}

const server = http.createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  const requestPath = new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname;
  if (requestPath === "/api/contact") {
    await handleContact(request, response);
    return;
  }
  if ((requestPath === "/" || requestPath === "/index.html") && request.method === "GET") {
    try {
      const html = await readFile(indexPath);
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache"
      });
      response.end(html);
    } catch (error) {
      console.error("Could not read the website HTML:", error.message);
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("The website could not be loaded.");
    }
    return;
  }
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

server.listen(port, () => {
  console.log(`Website listening at http://localhost:${port}`);
  if (!transporter) {
    console.warn("Contact form is offline until SMTP_HOST, SMTP_USER, and SMTP_PASS are configured.");
  }
});
