require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const helmet = require("helmet");
const cors = require("cors");

const app = express();

/* ================= SECURITY ================= */
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= DATABASE ================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

/* ================= MODELS ================= */
const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ["admin", "student"], default: "student" }
}));

const Announcement = mongoose.model("Announcement", new mongoose.Schema({
  title: String,
  description: String,
  image: String,
  author: String,
  createdAt: { type: Date, default: Date.now }
}));

/* ================= AUTH ================= */
function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).send("Access Denied");

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch {
    res.status(400).send("Invalid Token");
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).send("Forbidden");
  next();
}

/* ================= FILE UPLOAD ================= */
const upload = multer({
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only images allowed"));
    cb(null, true);
  }
});

/* ================= AUTH ROUTES ================= */
app.post("/register", async (req, res) => {
  const hashed = await bcrypt.hash(req.body.password, 10);
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: hashed,
    role: req.body.role || "student"
  });
  res.json(user);
});

app.post("/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(400).send("Invalid credentials");

  const valid = await bcrypt.compare(req.body.password, user.password);
  if (!valid) return res.status(400).send("Invalid credentials");

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({ token, role: user.role });
});

/* ================= ANNOUNCEMENTS ================= */
app.post("/announcements", auth, adminOnly, upload.single("image"), async (req, res) => {
  let imageBase64 = null;
  if (req.file) {
    imageBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
  }
  const announcement = await Announcement.create({
    title: req.body.title,
    description: req.body.description,
    image: imageBase64,
    author: req.user.id
  });
  res.json(announcement);
});

app.get("/announcements", auth, async (req, res) => {
  const data = await Announcement.find().sort({ createdAt: -1 });
  res.json(data);
});

/* ================= FRONTEND ================= */
app.get("/", (req, res) => {
res.send(`
<!DOCTYPE html>
<html>
<head>
<title>V-Link</title>
<script src="https://cdn.tailwindcss.com"></script>
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>
body{
 background: linear-gradient(rgba(107,15,26,.92), rgba(107,15,26,.92)),
 url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1');
 background-size: cover;
 background-position:center;
}
.fade{animation:fade .5s ease}
@keyframes fade{from{opacity:0;transform:translateY(10px)}to{opacity:1}}
</style>
</head>

<body class="fade text-gray-800">

<div class="min-h-screen flex flex-col items-center justify-center px-4">

<!-- LOGO -->
<div class="text-center text-white mb-6">
  <img src="https://cdn-icons-png.flaticon.com/512/2991/2991148.png"
       class="w-16 mx-auto mb-3">
  <h1 class="text-3xl font-bold">V-Link</h1>
  <p class="text-yellow-300 text-sm">Villamorian, updated kana ba?</p>
</div>

<!-- CARD -->
<div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">

  <!-- LOGIN -->
  <div id="loginBox">
    <h2 class="text-xl font-bold text-center mb-4">Welcome Back!</h2>

    <input id="email" placeholder="Email / Username"
      class="border p-3 w-full mb-3 rounded-lg"/>

    <input id="password" type="password" placeholder="Password"
      class="border p-3 w-full mb-3 rounded-lg"/>

    <button onclick="login()"
      class="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold w-full py-3 rounded-lg">
      Sign In
    </button>

    <p class="text-center text-sm mt-4">
      Don't have an account?
      <span onclick="showSignup()" class="text-yellow-500 font-semibold cursor-pointer">
        Register
      </span>
    </p>
  </div>

  <!-- SIGNUP -->
  <div id="signupBox" class="hidden">
    <h2 class="text-xl font-bold text-center mb-4">Create Account</h2>

    <input id="name" placeholder="Full Name"
      class="border p-3 w-full mb-3 rounded-lg"/>

    <input id="newEmail" placeholder="Email"
      class="border p-3 w-full mb-3 rounded-lg"/>

    <input id="newPassword" type="password" placeholder="Password"
      class="border p-3 w-full mb-3 rounded-lg"/>

    <button onclick="register()"
      class="bg-[#6b0f1a] text-white w-full py-3 rounded-lg">
      Sign Up
    </button>

    <p class="text-center text-sm mt-4">
      Already have an account?
      <span onclick="showLogin()" class="text-yellow-500 font-semibold cursor-pointer">
        Login
      </span>
    </p>
  </div>

</div>
</div>

<script>
function showSignup(){
 loginBox.style.display="none";
 signupBox.style.display="block";
}

function showLogin(){
 signupBox.style.display="none";
 loginBox.style.display="block";
}

async function login(){
 const res = await fetch("/login",{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body: JSON.stringify({
     email: email.value,
     password: password.value
   })
 });
 const data = await res.json();
 if(data.token){ location.reload(); }
 else alert("Login failed");
}

async function register(){
 await fetch("/register",{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body: JSON.stringify({
     name: name.value,
     email: newEmail.value,
     password: newPassword.value
   })
 });
 alert("Account created! You can now login.");
 showLogin();
}
</script>

</body>
</html>
`);
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});
