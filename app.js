require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const helmet = require("helmet");
const cors = require("cors");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

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

const upload = multer({
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only images allowed"));
    }
    cb(null, true);
  }
});

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

app.get("/", (req, res) => {
res.send(`
<!DOCTYPE html>
<html>
<head>
<title>V-Link</title>
<script src="https://cdn.tailwindcss.com"></script>
</head>

<body class="bg-gray-100">

<div id="loginPage" class="flex items-center justify-center h-screen">
  <div class="bg-white p-6 rounded shadow w-80">
    <h2 class="text-xl font-bold mb-4 text-center">V-Link Login</h2>
    <input id="email" placeholder="Email" class="border p-2 w-full mb-2"/>
    <input id="password" type="password" placeholder="Password" class="border p-2 w-full mb-3"/>
    <button onclick="login()" class="bg-blue-600 text-white w-full py-2 rounded">Login</button>
  </div>
</div>

<div id="app" class="hidden p-6">
  <h1 class="text-2xl font-bold mb-4">📢 Announcements</h1>

  <div id="adminPanel" class="hidden mb-6 bg-white p-4 rounded shadow">
    <h3 class="font-bold mb-2">Post Announcement</h3>
    <input id="title" placeholder="Title" class="border p-2 w-full mb-2"/>
    <textarea id="desc" placeholder="Description" class="border p-2 w-full mb-2"></textarea>
    <input type="file" id="image" class="mb-2"/>
    <button onclick="postAnnouncement()" class="bg-green-600 text-white px-4 py-2 rounded">Post</button>
  </div>

  <div id="announcements"></div>
</div>

<script>
let token = "";
let role = "";

async function login(){
 const res = await fetch("/login", {
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body: JSON.stringify({
     email: email.value,
     password: password.value
   })
 });

 const data = await res.json();
 token = data.token;
 role = data.role;

 document.getElementById("loginPage").classList.add("hidden");
 document.getElementById("app").classList.remove("hidden");

 if(role === "admin"){
   document.getElementById("adminPanel").classList.remove("hidden");
 }

 loadAnnouncements();
}

async function loadAnnouncements(){
 const res = await fetch("/announcements",{
   headers:{Authorization: token}
 });
 const data = await res.json();

 const container = document.getElementById("announcements");
 container.innerHTML = "";

 data.forEach(a=>{
   container.innerHTML += \`
     <div class="bg-white p-4 rounded shadow mb-3">
       <h3 class="font-bold">\${a.title}</h3>
       <p>\${a.description}</p>
       \${a.image ? '<img src="'+a.image+'" class="mt-2 w-48"/>' : ''}
     </div>
   \`;
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
