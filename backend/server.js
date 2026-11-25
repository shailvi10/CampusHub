
const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const db = new Database("campushub.db");

const PORT = 3000;
const SECRET = process.env.JWT_SECRET || "change-this-development-secret";

app.use(cors());
app.use(express.json());

// Create database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student'
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  duration INTEGER NOT NULL,
  question_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Scheduled'
);
  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    due_date TEXT NOT NULL,
    teacher_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    teacher_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS student_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  submission_text TEXT NOT NULL,
  submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(assignment_id, student_id),
  FOREIGN KEY (assignment_id) REFERENCES assignments(id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  teacher_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES users(id)
);

`);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ message: "CampusHub backend is running!" });
});

// Student registration
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password || password.length < 8) {
      return res.status(400).json({
        message: "Enter a name, valid email and password of at least 8 characters."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = db.prepare(`
      INSERT INTO users (name, email, password, role)
      VALUES (?, ?, ?, 'student')
    `).run(name.trim(), email.trim().toLowerCase(), hashedPassword);

    res.status(201).json({
      message: "Registration successful!",
      userId: result.lastInsertRowid
    });
  } catch (error) {
    res.status(400).json({ message: "Registration failed. Check whether the email is already registered." });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const user = db.prepare(
    "SELECT * FROM users WHERE email = ?"
  ).get(email.trim().toLowerCase());

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Incorrect email or password." });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    SECRET,
    { expiresIn: "2h" }
  );

  res.json({
    message: "Login successful!",
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

// Authentication middleware
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : "";

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Please log in first." });
  }

}

// Teacher and admin permission
function requireTeacher(req, res, next) {
  if (!["teacher", "admin"].includes(req.user.role)) {
    return res.status(403).json({
      message: "Only teachers and admins can manage students."
    });
  }

  next();
}

// Get all registered students
app.get("/api/students", authenticate, requireTeacher, (req, res) => {
  const students = db.prepare(`
    SELECT id, name, email
    FROM users
    WHERE role = 'student'
    ORDER BY id DESC
  `).all();

  res.json(students);
});

// Edit student details
app.put("/api/students/:id", authenticate, requireTeacher, (req, res) => {
  const { name, email } = req.body;
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || !name?.trim() || !email?.trim()) {
    return res.status(400).json({
      message: "Please enter a valid name and email."
    });
  }

  try {
    const result = db.prepare(`
      UPDATE users
      SET name = ?, email = ?
      WHERE id = ? AND role = 'student'
    `).run(name.trim(), email.trim().toLowerCase(), id);

    if (result.changes === 0) {
      return res.status(404).json({
        message: "Student not found."
      });
    }

    res.json({ message: "Student updated successfully." });
  } catch (error) {
    res.status(409).json({
      message: "This email may already be registered."
    });
  }
});

// Delete student account
app.delete("/api/students/:id", authenticate, requireTeacher, (req, res) => {
  const id = Number(req.params.id);

  const result = db.prepare(`
    DELETE FROM users
    WHERE id = ? AND role = 'student'
  `).run(id);

  if (result.changes === 0) {
    return res.status(404).json({
      message: "Student not found."
    });
  }

  res.json({ message: "Student deleted successfully." });
});


// Get logged-in user
app.get("/api/me", authenticate, (req, res) => {
  const user = db.prepare(
    "SELECT id, name, email, role FROM users WHERE id = ?"
  ).get(req.user.id);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  res.json(user);
});

// List questions (teacher/admin only)
app.get("/api/questions", authenticate, (req, res) => {
  if (!["teacher", "admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied." });
  }

  const questions = db.prepare(
    "SELECT * FROM questions ORDER BY id DESC"
  ).all();

  res.json(questions);
});

// Add question (teacher/admin only)
app.post("/api/questions", authenticate, (req, res) => {
  if (!["teacher", "admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied." });
  }

  const {
    subject, question, option_a, option_b,
    option_c, option_d, correct_answer
  } = req.body;

  if (![subject, question, option_a, option_b, option_c, option_d, correct_answer].every(
    value => typeof value === "string" && value.trim()
  )) {
    return res.status(400).json({ message: "Please complete every question field." });
  }

  const result = db.prepare(`
    INSERT INTO questions
    (subject, question, option_a, option_b, option_c, option_d, correct_answer)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    subject.trim(), question.trim(), option_a.trim(),
    option_b.trim(), option_c.trim(), option_d.trim(),
    correct_answer.trim()
  );

  res.status(201).json({
    message: "Question saved!",
    id: result.lastInsertRowid
  });
});
// Update a question
app.put("/api/questions/:id", authenticate, (req, res) => {
  if (!["teacher", "admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied." });
  }

  const {
    subject, question, option_a, option_b,
    option_c, option_d, correct_answer
  } = req.body;

  const values = [
    subject, question, option_a, option_b,
    option_c, option_d, correct_answer
  ];

  if (!values.every(v => typeof v === "string" && v.trim())) {
    return res.status(400).json({ message: "Complete every question field." });
  }

  const result = db.prepare(`
    UPDATE questions SET
      subject = ?, question = ?, option_a = ?,
      option_b = ?, option_c = ?, option_d = ?,
      correct_answer = ?
    WHERE id = ?
  `).run(...values.map(v => v.trim()), req.params.id);

  if (!result.changes) {
    return res.status(404).json({ message: "Question not found." });
  }

  res.json({ message: "Question updated!" });
});

// Delete a question
app.delete("/api/questions/:id", authenticate, (req, res) => {
  if (!["teacher", "admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied." });
  }

  const result = db.prepare(
    "DELETE FROM questions WHERE id = ?"
  ).run(req.params.id);

  if (!result.changes) {
    return res.status(404).json({ message: "Question not found." });
  }

  res.json({ message: "Question deleted!" });
});

// Get quizzes (all logged-in roles)
app.get("/api/quizzes", authenticate, (req, res) => {
  const quizzes = db.prepare(
    "SELECT * FROM quizzes ORDER BY date, time"
  ).all();

  res.json(quizzes);
});

// Create a quiz
app.post("/api/quizzes", authenticate, (req, res) => {
  if (!["teacher", "admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied." });
  }

  const {
    title, subject, date, time, duration,
    question_count, status
  } = req.body;

  if (
    !title?.trim() || !subject?.trim() ||
    !date || !time ||
    !Number.isInteger(Number(duration)) || Number(duration) < 1 ||
    !Number.isInteger(Number(question_count)) || Number(question_count) < 1 ||
    !["Published", "Scheduled", "Draft"].includes(status)
  ) {
    return res.status(400).json({ message: "Please check all quiz details." });
  }

  const result = db.prepare(`
    INSERT INTO quizzes
    (title, subject, date, time, duration, question_count, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    title.trim(), subject.trim(), date, time,
    Number(duration), Number(question_count), status
  );

  res.status(201).json({
    message: "Quiz created!",
    id: result.lastInsertRowid
  });
});

// Update a quiz
app.put("/api/quizzes/:id", authenticate, (req, res) => {
  if (!["teacher", "admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied." });
  }

  const {
    title, subject, date, time, duration,
    question_count, status
  } = req.body;

  if (
    !title?.trim() || !subject?.trim() ||
    !date || !time ||
    !Number.isInteger(Number(duration)) || Number(duration) < 1 ||
    !Number.isInteger(Number(question_count)) || Number(question_count) < 1 ||
    !["Published", "Scheduled", "Draft"].includes(status)
  ) {
    return res.status(400).json({ message: "Please check all quiz details." });
  }

  const result = db.prepare(`
    UPDATE quizzes SET
      title = ?, subject = ?, date = ?, time = ?,
      duration = ?, question_count = ?, status = ?
    WHERE id = ?
  `).run(
    title.trim(), subject.trim(), date, time,
    Number(duration), Number(question_count), status,
    req.params.id
  );

  if (!result.changes) {
    return res.status(404).json({ message: "Quiz not found." });
  }

  res.json({ message: "Quiz updated!" });
});

// Delete a quiz
app.delete("/api/quizzes/:id", authenticate, (req, res) => {
  if (!["teacher", "admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied." });
  }

  const result = db.prepare(
    "DELETE FROM quizzes WHERE id = ?"
  ).run(req.params.id);

  if (!result.changes) {
    return res.status(404).json({ message: "Quiz not found." });
  }

  res.json({ message: "Quiz deleted!" });
});
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "CampusHub backend is working!"
    });
});

// ================================
// ASSIGNMENTS API
// ================================

// Get assignments
app.get("/api/assignments", authenticate, (req, res) => {
  const assignments = db.prepare(`
    SELECT * FROM assignments ORDER BY due_date ASC
  `).all();

  res.json(assignments);
});

// Create assignment
app.post("/api/assignments", authenticate, (req, res) => {
  if (!["teacher", "admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied." });
  }

  const { title, subject, description, due_date } = req.body;

  if (!title?.trim() || !subject?.trim() ||
      !description?.trim() || !due_date) {
    return res.status(400).json({
      message: "Please complete all assignment fields."
    });
  }

  const result = db.prepare(`
    INSERT INTO assignments
    (title, subject, description, due_date, teacher_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    title.trim(),
    subject.trim(),
    description.trim(),
    due_date,
    req.user.id
  );

  res.status(201).json({
    message: "Assignment created successfully!",
    id: result.lastInsertRowid
  });
});

// ================================
// ANNOUNCEMENTS API
// ================================

// Get announcements
app.get("/api/announcements", authenticate, (req, res) => {
  const announcements = db.prepare(`
    SELECT * FROM announcements ORDER BY id DESC
  `).all();

  res.json(announcements);
});

// Publish announcement
app.post("/api/announcements", authenticate, (req, res) => {
  if (!["teacher", "admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied." });
  }

  const { message } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({
      message: "Please enter an announcement."
    });
  }

  const result = db.prepare(`
    INSERT INTO announcements (message, teacher_id)
    VALUES (?, ?)
  `).run(message.trim(), req.user.id);

  res.status(201).json({
    message: "Announcement published successfully!",
    id: result.lastInsertRowid
  });
});

// STUDENT: SUBMIT AN ASSIGNMENT
app.post("/api/assignments/:id/submit", authenticate, (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Students only." });
  }

  const assignmentId = Number(req.params.id);
  const { submission_text } = req.body;

  if (!Number.isInteger(assignmentId) || assignmentId < 1 ||
      !submission_text?.trim()) {
    return res.status(400).json({
      message: "Please enter your assignment answer."
    });
  }

  const assignment = db.prepare(
    "SELECT id FROM assignments WHERE id = ?"
  ).get(assignmentId);

  if (!assignment) {
    return res.status(404).json({ message: "Assignment not found." });
  }

  db.prepare(`
    INSERT INTO student_submissions
    (assignment_id, student_id, submission_text)
    VALUES (?, ?, ?)
    ON CONFLICT(assignment_id, student_id)
    DO UPDATE SET
      submission_text = excluded.submission_text,
      submitted_at = CURRENT_TIMESTAMP
  `).run(assignmentId, req.user.id, submission_text.trim());

  res.json({ message: "Assignment submitted successfully!" });
});

// STUDENT: VIEW THEIR SUBMISSIONS
app.get("/api/assignments/submissions/mine", authenticate, (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Students only." });
  }

  const submissions = db.prepare(`
    SELECT assignment_id, submission_text, submitted_at
    FROM student_submissions
    WHERE student_id = ?
  `).all(req.user.id);

  res.json(submissions);
});


// TEACHER: PUBLISH AN ANNOUNCEMENT
app.post("/api/announcements", authenticate, requireTeacher, (req, res) => {
  const message = req.body.message;

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      message: "Please enter an announcement."
    });
  }

  const result = db.prepare(`
    INSERT INTO announcements (message, teacher_id)
    VALUES (?, ?)
  `).run(message.trim(), req.user.id);

  res.status(201).json({
    message: "Announcement published successfully!",
    id: result.lastInsertRowid
  });
});

// STUDENT: VIEW ANNOUNCEMENTS
app.get("/api/announcements", authenticate, (req, res) => {
  const announcements = db.prepare(`
    SELECT announcements.id,
           announcements.message,
           announcements.created_at,
           users.name AS teacher_name
    FROM announcements
    JOIN users ON users.id = announcements.teacher_id
    ORDER BY announcements.id DESC
  `).all();

  res.json(announcements);
});
app.get("/api/health", (req, res) => {
    res.json({ status: "OK", message: "CampusHub API is working" });
});


app.listen(PORT, () => {
  console.log(`CampusHub backend running at http://localhost:${PORT}`);
   
});
