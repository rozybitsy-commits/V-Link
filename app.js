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
  if (req.user.role !== "admin") {
    return res.status(403).send("Forbidden");
  }
  next();
}

/* ================= FILE UPLOAD ================= */
const upload = multer({
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images allowed"));
    }
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
<title>V-Link Portal</title>
<script src="https://cdn.tailwindcss.com"></script>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
.fade { animation: fade .4s ease-in; }
@keyframes fade { from{opacity:0} to{opacity:1} }
</style>
</head>

<body class="bg-gray-100 fade">

<!-- HEADER -->
<header class="bg-[#6b0f1a] text-white p-3 flex justify-between items-center">
  <div>
    <h1 class="font-bold text-sm">Villamor High School</h1>
    <p class="text-xs text-yellow-200">Villamorian, updated kana ba?</p>
  </div>
  <button onclick="toggleDark()" class="bg-white text-black px-2 py-1 rounded text-sm">🌙</button>
</header>

<!-- LOGIN -->
<div id="loginPage" class="flex items-center justify-center h-screen px-4">
  <div class="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm">
    <h2 class="text-xl font-bold mb-4 text-center text-[#6b0f1a]">Welcome</h2>
    <input id="email" placeholder="Email" class="border p-3 w-full mb-3 rounded"/>
    <input id="password" type="password" placeholder="Password" class="border p-3 w-full mb-4 rounded"/>
    <button onclick="login()" class="bg-[#6b0f1a] text-white w-full py-3 rounded font-semibold">
      Login
    </button>
  </div>
</div>

<!-- APP -->
<div id="app" class="hidden pb-20">

  <div class="p-4 space-y-4">

    <div id="adminPanel" class="hidden bg-white p-4 rounded-xl shadow">
      <h3 class="font-bold text-[#6b0f1a] mb-2">Post Announcement</h3>
      <input id="title" placeholder="Title" class="border p-2 w-full mb-2 rounded"/>
      <textarea id="desc" placeholder="Description" class="border p-2 w-full mb-2 rounded"></textarea>
      <input type="file" id="image" class="mb-2"/>
      <button onclick="postAnnouncement()" class="bg-[#6b0f1a] text-white px-4 py-2 rounded w-full">
        Post
      </button>
    </div>

    <h2 class="text-lg font-bold text-[#6b0f1a]">Announcements</h2>
    <div id="announcements"></div>

  </div>
</div>

<!-- MOBILE NAV -->
<nav class="fixed bottom-0 left-0 right-0 bg-white shadow flex justify-around py-2 text-sm">
  <button onclick="scrollTopPage()">🏠</button>
  <button onclick="toggleDark()">🌙</button>
</nav>

<script>
let token="", role="";

function toggleDark(){
 document.body.classList.toggle("bg-gray-900");
 document.body.classList.toggle("text-white");
}

function scrollTopPage(){
 window.scrollTo({top:0, behavior:'smooth'});
}

async function login(){
 const res = await fetch("/login", {
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body: JSON.stringify({ email: email.value, password: password.value })
 });

 const data = await res.json();
 token=data.token;
 role=data.role;

 loginPage.style.display="none";
 app.classList.remove("hidden");

 if(role==="admin") adminPanel.classList.remove("hidden");

 loadAnnouncements();
}

async function loadAnnouncements(){
 const res = await fetch("/announcements",{ headers:{Authorization: token}});
 const data = await res.json();

 announcements.innerHTML="";
 data.forEach(a=>{
   announcements.innerHTML += \`
   <div class="bg-white p-4 rounded-xl shadow fade">
     <h3 class="font-bold text-[#6b0f1a]">\${a.title}</h3>
     <p class="text-sm">\${a.description}</p>
     \${a.image ? '<img src="'+a.image+'" class="mt-2 rounded-lg"/>' : ''}
   </div>\`;
 });
}

async function postAnnouncement(){
 const formData = new FormData();
 formData.append("title", title.value);
 formData.append("description", desc.value);
 if(image.files[0]) formData.append("image", image.files[0]);

 await fetch("/announcements",{
   method:"POST",
   headers:{Authorization: token},
   body: formData
 });

 loadAnnouncements();
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
