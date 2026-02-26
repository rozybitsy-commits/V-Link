require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const helmet = require("helmet");
const cors = require("cors");

const app = express();

/* SECURITY */
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* DATABASE */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

/* MODELS */
const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ["admin", "student"], default: "student" }
}));

/* AUTH */
app.post("/register", async (req, res) => {
  const hashed = await bcrypt.hash(req.body.password, 10);
  await User.create({
    name: req.body.name,
    email: req.body.email,
    password: hashed
  });
  res.sendStatus(200);
});

app.post("/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(400).send("Invalid credentials");

  const valid = await bcrypt.compare(req.body.password, user.password);
  if (!valid) return res.status(400).send("Invalid credentials");

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
  res.json({ token });
});

/* FRONTEND */
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
  background:
  linear-gradient(rgba(120,0,0,.88), rgba(120,0,0,.88)),
  url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1');
  background-size: cover;
  background-position:center;
  font-family: 'Segoe UI', sans-serif;
}

.glass{
  backdrop-filter: blur(14px);
  background: rgba(255,255,255,0.92);
}

.fade{
  animation: fade .6s ease;
}

@keyframes fade{
  from{opacity:0; transform: translateY(15px);}
  to{opacity:1; transform: translateY(0);}
}
</style>
</head>

<body class="flex items-center justify-center min-h-screen px-4 fade">

<div class="w-full max-w-sm">

  <!-- LOGO & TITLE -->
  <div class="text-center text-white mb-6">
    <img src="https://cdn-icons-png.flaticon.com/512/2991/2991148.png"
         class="w-20 mx-auto mb-3 drop-shadow-lg">
    <h1 class="text-4xl font-bold tracking-wide">V-Link</h1>
    <p class="text-yellow-300 mt-1">Stay Connected. Stay Updated.</p>
  </div>

  <!-- CARD -->
  <div class="glass rounded-2xl shadow-2xl p-6">

    <!-- LOGIN -->
    <div id="loginBox">
      <h2 class="text-xl font-semibold text-center mb-4">Welcome Back!</h2>

      <input id="email" placeholder="Email / Username"
        class="border p-3 w-full mb-3 rounded-lg focus:ring-2 focus:ring-yellow-400"/>

      <input id="password" type="password" placeholder="Password"
        class="border p-3 w-full mb-3 rounded-lg focus:ring-2 focus:ring-yellow-400"/>

      <label class="text-sm flex items-center gap-2 mb-4">
        <input type="checkbox"> Remember me
      </label>

      <button onclick="login()"
        class="w-full py-3 rounded-lg font-semibold text-black
        bg-gradient-to-r from-yellow-300 to-yellow-500 hover:brightness-110 transition">
        Sign In
      </button>

      <div class="flex items-center my-4">
        <div class="flex-1 border-t"></div>
        <span class="mx-3 text-gray-400 text-sm">or</span>
        <div class="flex-1 border-t"></div>
      </div>

      <button class="w-full py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">
        Continue with Facebook
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
      <h2 class="text-xl font-semibold text-center mb-4">Create Account</h2>

      <input id="name" placeholder="Full Name"
        class="border p-3 w-full mb-3 rounded-lg"/>

      <input id="newEmail" placeholder="Email"
        class="border p-3 w-full mb-3 rounded-lg"/>

      <input id="newPassword" type="password" placeholder="Password"
        class="border p-3 w-full mb-4 rounded-lg"/>

      <button onclick="register()"
        class="w-full py-3 rounded-lg text-white font-semibold
        bg-[#6b0f1a] hover:brightness-110">
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
   body: JSON.stringify({ email: email.value, password: password.value })
 });

 if(res.ok){
   alert("Login successful!");
 } else {
   alert("Login failed");
 }
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

 alert("Account created!");
 showLogin();
}
</script>

</body>
</html>
`);
});

/* SERVER */
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});
