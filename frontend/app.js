 
 const API_URL = "https://campushub-j27p.onrender.com/api";
const $ = id => document.getElementById(id);

const state = {
  role: "student",
  page: "Dashboard",

  questions: [
    {
      id: 1,
      text: "What is a data structure?",
      subject: "Data Structures",
      type: "MCQ",
      options: ["Array", "Stack", "Queue", "Tree"],
      correct: "Stack"
    },
    {
      id: 2,
      text: "Explain database normalization.",
      subject: "Database Management",
      type: "Short Answer"
    }
  ],

  quizzes: [
    {
      id: 1,
      title: "Data Structures Basics",
      subject: "Data Structures",
      date: "2026-12-02",
      time: "10:30",
      duration: 10,
      status: "Published",
      questions: 10
    },
    {
      id: 2,
      title: "Database Fundamentals",
      subject: "Database Management",
      date: "2026-12-05",
      time: "12:00",
      duration: 15,
      status: "Scheduled",
      questions: 15
    }
  ],

  students: [
    {
      id: 1,
      name: "Aarav Sharma",
      email: "aarav@example.com",
      course: "BCA Semester 3",
      attendance: 92
    },
    {
      id: 2,
      name: "Diya Patel",
      email: "diya@example.com",
      course: "BCA Semester 3",
      attendance: 88
    },
    {
      id: 3,
      name: "Kabir Verma",
      email: "kabir@example.com",
      course: "BCA Semester 3",
      attendance: 76
    }
  ],
   activeQuiz: null,
quizAnswers: {},
quizTimeLeft: 0,
quizTimer: null,
quizSubmitted: false,

};

const menus = {
  student: [
    "Dashboard", "My Courses", "Attendance", "Grades", "Quizzes",
    "Assignments",
  ],

  teacher: [
    "Dashboard",
    "Manage Students",
    "My Subjects",
    "Create Quiz",
    "Question Bank",
    "Quiz Schedule",
    "Results & Analytics"
  ],

  admin: [
    "Dashboard",
    "Manage Students",
    "Manage Teachers",
    "All Courses",
    "Quiz Oversight"
  ]
};

const roleNames = {
  student: "Student Portal",
  teacher: "Teacher Portal",
  admin: "Admin Portal"
};

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function notify(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(notify.timer);

  notify.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

function switchRole(role) {
  state.role = role;
  state.page = "Dashboard";
  render();
}

function openPage(page) {
  state.page = page;
  $("sidebar").classList.remove("open");
  render();
}

function header(title, description) {
  return `
    <div class="page-heading">
      <div class="eyebrow">${state.role} workspace</div>
      <h1>${title}</h1>
      <p>${description}</p>
    </div>
  `;
}

function stat(icon, value, label) {
  return `
    <div class="stat-card">
      <div class="stat-icon">${icon}</div>
      <h3>${value}</h3>
      <p>${label}</p>
    </div>
  `;
}

function panel(title, content) {
  return `
    <section class="panel">
      <h2>${title}</h2>
      ${content}
    </section>
  `;
}

 function quizList() {
  if (!state.quizzes.length) {
    return "<p>No quizzes available.</p>";
  }

  return state.quizzes.map(q => `
    <div class="quiz-row">
      <div class="subject-icon">📝</div>

      <div class="row-main">
        <b>${escapeHTML(q.title)}</b>
        <small>${escapeHTML(q.subject)}</small>
        <small>
          ${escapeHTML(q.date)} ·
          ${escapeHTML(q.time)} ·
          ${q.duration} minutes
        </small>
      </div>

      <span class="pill green">
        ${escapeHTML(q.status)}
      </span>

      <button class="btn primary"
    onclick="openQuiz(${q.id})">
    Attempt Quiz
</button>
  `).join("");
}

function openQuiz(quizId) {
  const quiz = state.quizzes.find(q => Number(q.id) === Number(quizId));

  if (!quiz) {
    alert("Quiz not found!");
    return;
  }

  const matchingQuestions = state.questions.filter(
    q => q.subject === quiz.subject
  );

  if (matchingQuestions.length < 10) {
    alert(
      `This quiz needs at least 10 questions. Currently available: ${matchingQuestions.length}. Please ask your teacher to add more questions.`
    );
    return;
  }

  const questionCount = Math.min(
    20,
    Math.max(10, Number(quiz.questions) || 10),
    matchingQuestions.length
  );

  state.activeQuiz = {
    ...quiz,
    quizQuestions: matchingQuestions.slice(0, questionCount)
  };

  state.quizAnswers = {};
  state.quizSubmitted = false;
  state.quizTimeLeft = Math.max(1, Number(quiz.duration) || 10) * 60;
  state.page = "Attempt Quiz";

  renderQuizPage();
  startQuizTimer();
}

function renderQuizPage() {
  const quiz = state.activeQuiz;
  if (!quiz) return;

  const questions = quiz.quizQuestions;

  const app = document.querySelector("#app") ||
              document.querySelector("main") ||
              document.body;

  app.innerHTML = `
    <section class="quiz-container">
      <div class="quiz-top">
        <div>
          <h1>${escapeHTML(quiz.title)}</h1>
          <p>${escapeHTML(quiz.subject)} · ${questions.length} Questions</p>
        </div>

        <div class="quiz-clock" id="quizTimer">
          00:00
        </div>
      </div>

      <div class="quiz-progress">
        <span id="answeredCount">0</span> /
        ${questions.length} answered
      </div>

      <div id="quizQuestions">
        ${questions.map((q, index) => `
          <article class="question-card">
            <h3>Question ${index + 1}</h3>
            <p>${escapeHTML(q.text)}</p>

            ${
              q.options && q.options.length
              ? q.options.map((option, optionIndex) => `
                <label class="answer-option">
                  <input
                    type="radio"
                    name="question_${q.id}"
                    value="${escapeHTML(option)}"
                    onchange="saveQuizAnswer(${Number(q.id)}, this.value)"
                  >
                  ${escapeHTML(option)}
                </label>
              `).join("")
              : `
                <textarea
                  class="short-answer"
                  placeholder="Write your answer..."
                  onchange="saveQuizAnswer(${Number(q.id)}, this.value)"
                ></textarea>
              `
            }
          </article>
        `).join("")}
      </div>

      <div class="quiz-actions">
        <button class="submit-quiz-btn" onclick="submitQuiz()">
          Submit Quiz
        </button>
      </div>
    </section>
  `;

  updateQuizProgress();
}

function saveQuizAnswer(questionId, answer) {
  if (state.quizSubmitted) return;

  state.quizAnswers[questionId] = answer;
  updateQuizProgress();
}

function updateQuizProgress() {
  const count = Object.keys(state.quizAnswers).length;
  const display = document.getElementById("answeredCount");

  if (display) display.textContent = count;
}

function startQuizTimer() {
  clearInterval(state.quizTimer);

  updateTimerDisplay();

  state.quizTimer = setInterval(() => {
    if (state.quizSubmitted) {
      clearInterval(state.quizTimer);
      return;
    }

    state.quizTimeLeft--;

    updateTimerDisplay();

    if (state.quizTimeLeft <= 0) {
      clearInterval(state.quizTimer);
      alert("Time is up! Your quiz will be submitted.");
      submitQuiz();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const timer = document.getElementById("quizTimer");
  if (!timer) return;

  const minutes = Math.floor(state.quizTimeLeft / 60);
  const seconds = state.quizTimeLeft % 60;

  timer.textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  timer.classList.toggle("timer-warning", state.quizTimeLeft <= 60);
}

function submitQuiz() {
  if (state.quizSubmitted) return;

  const confirmed = confirm("Are you sure you want to submit your quiz?");
  if (!confirmed) return;

  state.quizSubmitted = true;
  clearInterval(state.quizTimer);

  const questions = state.activeQuiz.quizQuestions;
  let score = 0;

  questions.forEach(q => {
    const given = state.quizAnswers[q.id];

    if (
      given !== undefined &&
      q.correct !== undefined &&
      String(given).trim().toLowerCase() ===
      String(q.correct).trim().toLowerCase()
    ) {
      score++;
    }
  });

  const percentage = Math.round((score / questions.length) * 100);

  const app = document.querySelector("#app") ||
              document.querySelector("main") ||
              document.body;

  app.innerHTML = `
    <section class="quiz-result">
      <h1>Quiz Submitted!</h1>
      <div class="result-score">${score} / ${questions.length}</div>
      <h2>${percentage}%</h2>
      <p>You have completed ${escapeHTML(state.activeQuiz.title)}.</p>

      <button onclick="backToQuizzes()">
        Back to Quizzes
      </button>
    </section>
  `;
}

function backToQuizzes() {
  clearInterval(state.quizTimer);
  state.activeQuiz = null;
  state.page = "Quizzes";

  render();
}


function attemptQuiz(quizId) {
   const quiz = state.quizzes.find(
    q => Number(q.id) === Number(quizId)
);

  if (!quiz) {
    alert("Quiz not found!");
    return;
  }

  if (quiz.status !== "Published") {
    alert("This quiz is not available yet.");
    return;
  }

  const questions = state.questions.filter(
    q => q.subject === quiz.subject && q.type === "MCQ"
  );

  if (!questions.length) {
    alert("No multiple-choice questions are available for this quiz yet.");
    return;
  }

  let score = 0;

  questions.forEach((q, index) => {
    const answer = prompt(
      `Question ${index + 1} of ${questions.length}\n\n` +
      `${q.text}\n\n` +
      q.options.map((option, i) =>
        `${i + 1}. ${option}`
      ).join("\n") +
      "\n\nEnter the option number:"
    );

    if (answer === null) return;

    const selected = Number(answer);

    if (
      selected >= 1 &&
      selected <= q.options.length &&
      q.options[selected - 1] === q.correct
    ) {
      score++;
    }
  });

  alert(
    `Quiz completed!\nYour score: ${score}/${questions.length}`
  );
}

function studentDashboard() {
  return header(
    "Student Dashboard",
    "Welcome to your academic workspace."
  ) + `
    <div class="welcome-card">
      <div>
        <h2>Welcome, Student</h2>
        <p>Role: Student · BCA Semester 3</p>
      </div>
      <span class="pill green">Good standing</span>
    </div>

    <div class="grid stats-grid">
      ${stat("◷", "92%", "Attendance")}
      ${stat("★", "8.7", "CGPA")}
      ${stat("✎", "2", "Pending Quizzes")}
      ${stat("₹", "₹12,500", "Fee Due")}
    </div>

    <div class="grid content-grid">
      ${panel("Upcoming Quizzes", quizList())}

      ${panel("Attendance Summary", `
        <h2>92%</h2>
        <div class="progress">
          <span style="width:92%"></span>
        </div>
        <p>Keep up your attendance.</p>
      `)}
    </div>
  `;
}

function studentPage() {
  const p = state.page;

  if (p === "Dashboard") return studentDashboard();

  if (p === "My Courses") {
    return header(p, "Your enrolled subjects.") +
      panel("My Courses", `
        ${[
          "Data Structures",
          "Database Management",
          "Operating Systems",
          "Computer Networks"
        ].map(course => `
          <div class="list-row">
            <div class="row-main">
              <b>${course}</b>
              <small>BCA Semester 3</small>
            </div>
            <span class="pill green">Active</span>
          </div>
        `).join("")}
      `);
  }

  if (p === "Attendance") {
    return header(p, "Your attendance record.") +
      panel("Attendance Overview", `
        <h2>92%</h2>
        <div class="progress">
          <span style="width:92%"></span>
        </div>
      `);
  }

  if (p === "Grades") {
    return header(p, "Your academic results.") +
      panel("Grade Summary", `
        <div class="list-row">
          <b>Current CGPA</b> 8.7
        </div>
        <div class="list-row">
          <b>Semester</b> 3
        </div>
        <div class="list-row">
          <b>Result</b>
          <span class="pill green">Passed</span>
        </div>
      `);
  }

  if (p === "Quizzes") {
    return header(p, "View your upcoming quizzes.") +
      panel("Available Quizzes", quizList());
  }


if (p === "Announcements") {
  return header(p, "Read announcements from your teachers.") +
    panel("Teacher Announcements", `
      <div id="studentAnnouncementList">
        Loading announcements...
      </div>
    `);
}

if (p === "Assignments") {
  return header(p, "Manage student assignments.") +
    panel("Create Assignment", `
      <form id="assignmentForm">
        <div class="field">
          <label>Assignment Title</label>
          <input name="title" placeholder="Enter assignment title" required>
        </div>

        <div class="field">
          <label>Subject</label>
          <select name="subject" required>
            <option>Data Structures</option>
            <option>Database Management</option>
            <option>Operating Systems</option>
            <option>Computer Networks</option>
          </select>
        </div>

        <div class="field">
          <label>Description</label>
          <textarea name="description" placeholder="Enter assignment details" required></textarea>
        </div>

        <div class="field">
          <label>Due Date</label>
          <input type="date" name="due_date" required>
        </div>

        <button class="btn primary" type="submit">
          Create Assignment
        </button>
      </form>

      <hr>
      <h2>Saved Assignments</h2>
      <div id="assignmentList">Loading assignments...</div>
    `);
}

  return studentDashboard();
}

 
function studentTable() {
  return `
     <div>
  <button class="btn primary" onclick="addStudent()">
    + Add Student
  </button>

  <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Email</th>
            <th>Course</th>
            <th>Attendance</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${state.students.map((s, index) => `
            <tr>
              <td>${escapeHTML(s.name)}</td>
              <td>${escapeHTML(s.email)}</td>
              <td>${escapeHTML(s.course)}</td>
              <td>${s.attendance ?? 0}%</td>
              <td>
                <button class="btn primary"
                  onclick="editStudent(${index})">Edit</button>
                <button class="btn"
                  onclick="deleteStudent(${index})">Delete</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    </div>
  `;
}

function addStudent() {
  const name = prompt("Enter student name:");
  if (!name || !name.trim()) return;

  const email = prompt("Enter student email:");
  if (!email || !email.trim()) return;

  const course = prompt("Enter student course:");
  if (!course || !course.trim()) return;

  state.students.push({
    name: name.trim(),
    email: email.trim(),
    course: course.trim(),
    attendance: 0
  });

  render();
  notify("Student added successfully!");
}

function editStudent(index) {
  const student = state.students[index];
  if (!student) return;

  const name = prompt("Enter student name:", student.name);
  if (name === null) return;

  const email = prompt("Enter student email:", student.email);
  if (email === null) return;

  const course = prompt("Enter student course:", student.course);
  if (course === null) return;

  student.name = name.trim();
  student.email = email.trim();
  student.course = course.trim();

  render();
  notify("Student updated in this demo.");
}

function deleteStudent(index) {
  if (!confirm("Are you sure you want to delete this student?")) {
    return;
  }

  state.students.splice(index, 1);
  render();
  notify("Student deleted from this demo.");
}


function questionTable() {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Question</th>
            <th>Subject</th>
            <th>Type</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          ${state.questions.map(q => `
            <tr>
              <td>${escapeHTML(q.text)}</td>
              <td>${escapeHTML(q.subject)}</td>
              <td>${escapeHTML(q.type)}</td>
              <td>
                <div class="action-group">
                  <button class="btn secondary"
                    data-edit-question="${q.id}">
                    Edit
                  </button>

                  <button class="btn danger"
                    data-delete-question="${q.id}">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function quizTable() {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Quiz</th>
            <th>Date</th>
            <th>Time</th>
            <th>Duration</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          ${state.quizzes.map(q => `
            <tr>
              <td>${escapeHTML(q.title)}</td>
              <td>${escapeHTML(q.date)}</td>
              <td>${escapeHTML(q.time)}</td>
              <td>${q.duration} min</td>
              <td>${escapeHTML(q.status)}</td>
              <td>
                <div class="action-group">
                  <button class="btn secondary"
                    data-edit-quiz="${q.id}">
                    Edit
                  </button>

                  <button class="btn danger"
                    data-delete-quiz="${q.id}">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function teacherDashboard() {
  return header(
    "Teacher Dashboard",
    "Manage classes, questions and quizzes."
  ) + `
    <div class="welcome-card">
      <div>
        <h2>Welcome, Teacher!</h2>
        <p>Manage your academic activities.</p>
      </div>
      <span class="pill green">Teacher Account</span>
    </div>

    <div class="grid stats-grid">
      ${stat("♙", state.students.length, "Total Students")}
      ${stat("▣", state.questions.length, "Question Bank")}
      ${stat("✎", state.quizzes.length, "Total Quizzes")}
      ${stat("◷", "3", "Upcoming Tests")}
    </div>

    <div class="grid content-grid">
      ${panel("Recent Quizzes", quizList())}

      ${panel("Quick Actions", `
        <div class="list-row">
          <b>Create Quiz</b>
          <button class="btn primary" data-page="Create Quiz">
            Open
          </button>
        </div>

        <div class="list-row">
          <b>Question Bank</b>
          <button class="btn secondary" data-page="Question Bank">
            Open
          </button>
        </div>

        <div class="list-row">
          <b>Manage Students</b>
          <button class="btn secondary" data-page="Manage Students">
            Open
          </button>
        </div>
      `)}
    </div>
  `;
}

function teacherPage() {
  const p = state.page;

  if (p === "Dashboard") return teacherDashboard();

  if (p === "Manage Students") {
    return header(p, "View your enrolled students.") +
      panel("Student Directory", studentTable());
  }

if (p === "My Subjects") {
    return header(p, "Manage your assigned subjects.") +
        subjectManagerPanel();
}

   

  if (p === "Question Bank") {
    return header(
      p,
      "Add, edit and delete your questions."
    ) + `
      <div class="panel">
        <button class="btn primary" id="addQuestionBtn">
          + Add Question
        </button>
        <br><br>
        ${questionTable()}
      </div>
    `;
  }

  if (p === "Create Quiz") {
    return header(p, "Create and schedule a new quiz.") +
      panel("Quiz Details", `
        <form id="quizForm">

          <div class="field">
            <label>Quiz Title</label>
            <input name="title" required
              placeholder="Enter quiz title">
          </div>

          <div class="field">
            <label>Subject</label>
            <select name="subject">
              <option>Data Structures</option>
              <option>Database Management</option>
              <option>Operating Systems</option>
              <option>Computer Networks</option>
            </select>
          </div>

          <div class="form-grid">
            <div class="field">
              <label>Quiz Date</label>
              <input type="date" name="date" required>
            </div>

            <div class="field">
              <label>Start Time</label>
              <input type="time" name="time" required>
            </div>

            <div class="field">
              <label>Duration (Minutes)</label>
              <input type="number" name="duration"
                min="1" value="10" required>
            </div>

            <div class="field">
              <label>Number of Questions</label>
              <input type="number" name="questions"
                min="1" value="10" required>
            </div>
          </div>

          <div class="field">
            <label>Quiz Status</label>
            <select name="status">
              <option>Published</option>
              <option>Scheduled</option>
              <option>Draft</option>
            </select>
          </div>

          <button class="btn primary" type="submit">
            Create Quiz
          </button>
        </form>
      `);
  }

  if (p === "Quiz Schedule") {
    return header(p, "Edit, update or delete scheduled quizzes.") +
      panel("Quiz Schedule", quizTable());
  }

  if (p === "Results & Analytics") {
    return header(p, "Check student performance.") +
      `<div class="grid stats-grid">
        ${stat("✓", "86", "Submissions")}
        ${stat("◷", "12", "Pending Evaluation")}
        ${stat("★", "78%", "Average Score")}
        ${stat("♙", "120", "Students")}
      </div>` +
      panel("Performance Overview", `
        <div class="chart-bars">
          <div class="chart-bar" style="height:58%"></div>
          <div class="chart-bar" style="height:72%"></div>
          <div class="chart-bar" style="height:66%"></div>
          <div class="chart-bar" style="height:84%"></div>
        </div>
      `);
  }


if (p === "Announcements") {
  return header(p, "Send notices to students.") +
    panel("New Announcement", `
      <div class="field">
        <label>Announcement</label>
        <textarea id="announcementText"
          placeholder="Write your announcement..."></textarea>
      </div>

      <button class="btn primary" id="announcementBtn">
        Publish Announcement
      </button>

      <hr>
      <h2>Published Announcements</h2>
      <div id="announcementList">Loading announcements...</div>
    `);
}



  return teacherDashboard();
}

function adminDashboard() {
  return header(
    "Admin Dashboard",
    "Manage your complete institution."
  ) + `
    <div class="welcome-card">
      <div>
        <h2>Welcome, Administrator!</h2>
        <p>Manage students, teachers and academics.</p>
      </div>
      <span class="pill green">Admin Account</span>
    </div>

    <div class="grid stats-grid">
      ${stat("♙", state.students.length, "Students")}
      ${stat("♧", "12", "Teachers")}
      ${stat("▤", "8", "Courses")}
      ${stat("▣", state.quizzes.length, "Quizzes")}
    </div>

    <div class="grid content-grid">
      ${panel("User Management", `
        <div class="list-row">
          <b>Student Accounts</b>
          <button class="btn secondary"
            data-page="Manage Students">Manage</button>
        </div>

        <div class="list-row">
          <b>Teacher Accounts</b>
          <button class="btn secondary"
            data-page="Manage Teachers">Manage</button>
        </div>
      `)}

      ${panel("Platform Management", `
        <div class="list-row">
          <b>Quiz Oversight</b>
          <button class="btn secondary"
            data-page="Quiz Oversight">Open</button>
        </div>

        <div class="list-row">
          <b>Reports</b>
          <button class="btn secondary"
            data-page="Reports & Analytics">Open</button>
        </div>
      `)}
    </div>
  `;
}

function adminPage() {
  const p = state.page;

  if (p === "Dashboard") return adminDashboard();

  if (p === "Manage Students") {
    return header(p, "Manage student accounts.") +
      panel("Student Directory", studentTable());
  }

  if (p === "Manage Teachers") {
    return header(p, "Manage teacher accounts.") +
      panel("Teacher Directory", `
        <div class="list-row">
          <b>Priya Mehta</b>
          <span class="pill green">Active</span>
        </div>
        <div class="list-row">
          <b>Rahul Joshi</b>
          <span class="pill green">Active</span>
        </div>
      `);
  }

  if (p === "All Courses") {
    return header(p, "Manage academic courses.") +
      panel("Courses", `
        <div class="list-row">BCA Semester 1</div>
        <div class="list-row">BCA Semester 2</div>
        <div class="list-row">BCA Semester 3</div>
        <div class="list-row">BSc Computer Science</div>
      `);
  }

  if (p === "Quiz Oversight") {
    return header(p, "Review all quizzes.") +
      panel("All Quizzes", quizTable());
  }
  
  return adminDashboard();
}

// Render dashboard and navigation

function render() {
  $("roleSelect").value = state.role;
  $("roleLabel").textContent = roleNames[state.role];

  $("navigation").innerHTML = menus[state.role].map(item => `
    <button class="nav-link ${state.page === item ? "active" : ""}"
      data-page="${item}">
      ${item}
    </button>
  `).join("");

  if (state.role === "student") {
  $("pageContent").innerHTML = studentPage();

  if (state.page === "Announcements") {
    loadStudentAnnouncements();
  }

  if (state.page === "Assignments") {
    loadStudentAssignments();
  }
}

if (state.role === "teacher") {
  $("pageContent").innerHTML = teacherPage();

  if (state.page === "Assignments") {
    loadAssignments();
  }
}

if (state.role === "admin") {
  $("pageContent").innerHTML = adminPage();
}
}



// Question modal

function openQuestionModal(id = null) {
  const q = state.questions.find(x => x.id === id);

  $("questionForm").reset();
  $("questionId").value = q ? q.id : "";
  $("modalTitle").textContent = q ? "Edit Question" : "Add Question";

  $("questionText").value = q ? q.text : "";
  $("questionSubject").value = q ? q.subject : "Data Structures";
  $("questionType").value = q ? q.type : "MCQ";

  $("optionA").value = q?.options?.[0] || "Array";
  $("optionB").value = q?.options?.[1] || "Stack";
  $("optionC").value = q?.options?.[2] || "Queue";
  $("optionD").value = q?.options?.[3] || "Tree";

  updateOptions(q?.correct || "Stack");

  $("mcqFields").style.display =
    $("questionType").value === "MCQ" ? "block" : "none";

  $("modal").hidden = false;
}

function updateOptions(selected) {
  const values = [
    $("optionA").value,
    $("optionB").value,
    $("optionC").value,
    $("optionD").value
  ];

  $("correctAnswer").innerHTML = values.map(value => `
    <option ${value === selected ? "selected" : ""}>
      ${escapeHTML(value)}
    </option>
  `).join("");
}

// Navigation and buttons

document.addEventListener("click", event => {
  const page = event.target.closest("[data-page]");

  if (page) {
    openPage(page.dataset.page);
    return;
  }

  const editQuestion = event.target.closest("[data-edit-question]");

  if (editQuestion) {
    openQuestionModal(Number(editQuestion.dataset.editQuestion));
    return;
  }

  const deleteQuestion = event.target.closest("[data-delete-question]");

  if (deleteQuestion) {
    const id = Number(deleteQuestion.dataset.deleteQuestion);

    state.questions = state.questions.filter(q => q.id !== id);

    render();
    notify("Question deleted.");
    return;
  }

  const editQuiz = event.target.closest("[data-edit-quiz]");

  if (editQuiz) {
    editQuizDetails(Number(editQuiz.dataset.editQuiz));
    return;
  }

  const deleteQuiz = event.target.closest("[data-delete-quiz]");

  if (deleteQuiz) {
    const id = Number(deleteQuiz.dataset.deleteQuiz);

    state.quizzes = state.quizzes.filter(q => q.id !== id);

    render();
    notify("Quiz deleted.");
    return;
  }

  if (event.target.closest("#addQuestionBtn")) {
    openQuestionModal();
  }
});

// Edit quiz details

function editQuizDetails(id) {
  const quiz = state.quizzes.find(q => q.id === id);

  const newTitle = prompt("Enter quiz title:", quiz.title);
  if (newTitle === null || !newTitle.trim()) return;

  const newDate = prompt("Enter date (YYYY-MM-DD):", quiz.date);
  if (newDate === null) return;

  const newTime = prompt("Enter start time (HH:MM):", quiz.time);
  if (newTime === null) return;

  const newDuration = prompt("Enter duration in minutes:", quiz.duration);
  if (newDuration === null || Number(newDuration) < 1) return;

  quiz.title = newTitle.trim();
  quiz.date = newDate;
  quiz.time = newTime;
  quiz.duration = Number(newDuration);

  render();
  notify("Quiz updated successfully.");
}

// Form submissions

$("questionForm").addEventListener("submit", event => {
  event.preventDefault();

  const id = Number($("questionId").value);
  const type = $("questionType").value;

  const question = {
    id: id || Date.now(),
    text: $("questionText").value.trim(),
    subject: $("questionSubject").value,
    type
  };

  if (type === "MCQ") {
    question.options = [
      $("optionA").value,
      $("optionB").value,
      $("optionC").value,
      $("optionD").value
    ];

    question.correct = $("correctAnswer").value;
  }

  if (id) {
    state.questions = state.questions.map(q =>
      q.id === id ? question : q
    );
  } else {
    state.questions.push(question);
  }

  $("modal").hidden = true;
  render();

  notify(id ? "Question updated." : "Question added.");
});

document.addEventListener("submit", event => {
  if (event.target.id === "quizForm") {
    event.preventDefault();

    const data = new FormData(event.target);

    state.quizzes.push({
      id: Date.now(),
      title: data.get("title"),
      subject: data.get("subject"),
      date: data.get("date"),
      time: data.get("time"),
      duration: Number(data.get("duration")),
      questions: Number(data.get("questions")),
      status: data.get("status")
    });

    render();
    notify("Quiz created successfully.");
  }
});

// Other controls

$("roleSelect").addEventListener("change", event => {
  switchRole(event.target.value);
});

$("menuBtn").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

$("closeModal").addEventListener("click", () => {
  $("modal").hidden = true;
});

$("questionType").addEventListener("change", () => {
  $("mcqFields").style.display =
    $("questionType").value === "MCQ" ? "block" : "none";
});

["optionA", "optionB", "optionC", "optionD"].forEach(id => {
  $(id).addEventListener("input", () => {
    updateOptions($("correctAnswer").value);
  });
});


// ==================================
// CAMPUSHUB LOGIN AND REGISTRATION
// ==================================

const authScreen = $("authScreen");
const authMessage = $("authMessage");

function showAuthMessage(message) {
  if (authMessage) {
    authMessage.textContent = message;
  }
}

// Show registration form
$("showRegister")?.addEventListener("click", () => {
  $("loginForm").hidden = true;
  $("registerForm").hidden = false;
  showAuthMessage("");
});

// Show login form
$("showLogin")?.addEventListener("click", () => {
  $("registerForm").hidden = true;
  $("loginForm").hidden = false;
  showAuthMessage("");
});

// Student registration
$("registerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = $("registerName").value.trim();
  const email = $("registerEmail").value.trim();
  const password = $("registerPassword").value;

  try {
    const response = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Registration failed");
    }

    showAuthMessage("Account created! Please log in.");

    $("registerForm").reset();
    $("registerForm").hidden = true;
    $("loginForm").hidden = false;

    $("loginEmail").value = email;

  } catch (error) {
    showAuthMessage(error.message);
  }
});

// User login
$("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  try {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }

    sessionStorage.setItem("campushubToken", data.token);
    sessionStorage.setItem(
      "campushubUser",
      JSON.stringify(data.user)
    );

    state.role = data.user.role;

    if ($("roleSelect")) {
      $("roleSelect").value = data.user.role;
    }

    if ($("roleLabel")) {
      $("roleLabel").textContent =
        data.user.role.charAt(0).toUpperCase() +
        data.user.role.slice(1) + " Portal";
    }

    if ($("authScreen")) {
      $("authScreen").style.display = "none";
    }

    showAuthMessage("");
    render();

  } catch (error) {
    showAuthMessage(error.message);
  }
});

async function loadAssignments() {
  const list = $("assignmentList");
  if (!list) return;

  try {
    const token = sessionStorage.getItem("campushubToken");

    const response = await fetch(`${API_URL}/assignments`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const assignments = await response.json();

    if (!response.ok) {
      throw new Error(assignments.message || "Could not load assignments.");
    }

    list.innerHTML = assignments.length
      ? assignments.map(a => `
          <div class="list-row">
            <div class="row-main">
              <b>${escapeHTML(a.title)}</b>
              <small>${escapeHTML(a.subject)}</small>
              <p>${escapeHTML(a.description)}</p>
              <small>Due: ${escapeHTML(a.due_date)}</small>
            </div>
          </div>
        `).join("")
      : "<p>No assignments created yet.</p>";

  } catch (error) {
    list.textContent = error.message;
  }
}

document.addEventListener("submit", async event => {
  if (event.target.id !== "assignmentForm") return;

  event.preventDefault();

  const form = event.target;
  const data = new FormData(form);

  const assignment = {
    title: data.get("title").trim(),
    subject: data.get("subject"),
    description: data.get("description").trim(),
    due_date: data.get("due_date")
  };

  try {
    const token = sessionStorage.getItem("campushubToken");

    const response = await fetch(`${API_URL}/assignments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(assignment)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Could not create assignment.");
    }

    form.reset();
    notify("Assignment created successfully!");
    loadAssignments();

  } catch (error) {
    notify(error.message);
  }
});

document.addEventListener("click", async event => {
  if (event.target.id !== "announcementBtn") return;

  const message = $("announcementText").value.trim();

  if (!message) {
    notify("Please enter an announcement.");
    return;
  }

  try {
    const token = sessionStorage.getItem("campushubToken");

    const response = await fetch(`${API_URL}/announcements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ message })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Could not publish announcement.");
    }

    $("announcementText").value = "";
    notify("Announcement published successfully!");

  } catch (error) {
    notify(error.message);
  }
});


function escapeStudentHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

async function loadStudentAnnouncements() {
  const list = $("studentAnnouncementList");
  if (!list) return;

  try {
    const token = sessionStorage.getItem("campushubToken");
    const response = await fetch(`${API_URL}/announcements`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const announcements = await response.json();
    if (!response.ok) throw new Error(announcements.message);

    list.innerHTML = announcements.length
      ? announcements.map(a => `
          <div class="list-row">
            <p>${escapeStudentHTML(a.message)}</p>
            <small>${escapeStudentHTML(a.created_at || "")}</small>
          </div>
        `).join("")
      : "<p>No announcements yet.</p>";

  } catch (error) {
    list.textContent = error.message;
  }
}

async function loadStudentAssignments() {
  const list = $("studentAssignmentList");
  if (!list) return;

  try {
    const token = sessionStorage.getItem("campushubToken");
    const headers = { Authorization: `Bearer ${token}` };

    const [aResponse, sResponse] = await Promise.all([
      fetch(`${API_URL}/assignments`, { headers }),
      fetch(`${API_URL}/assignments/submissions/mine`, { headers })
    ]);

    const assignments = await aResponse.json();
    const submissions = await sResponse.json();

    if (!aResponse.ok) throw new Error(assignments.message);
    if (!sResponse.ok) throw new Error(submissions.message);

    list.innerHTML = assignments.length
      ? assignments.map(a => {
          const submitted = submissions.find(
            s => Number(s.assignment_id) === Number(a.id)
          );

          return `
            <div class="list-row">
              <h3>${escapeStudentHTML(a.title)}</h3>
              <p>Subject: ${escapeStudentHTML(a.subject)}</p>
              <p>${escapeStudentHTML(a.description)}</p>
              <p>Due: ${escapeStudentHTML(a.due_date)}</p>

              <form class="studentSubmissionForm" data-id="${Number(a.id)}">
                <label>Your Answer</label>
                <textarea name="submission_text" required>${escapeStudentHTML(submitted?.submission_text || "")}</textarea>
                <button class="btn primary" type="submit">
                  ${submitted ? "Update Submission" : "Submit Assignment"}
                </button>
              </form>
            </div>
          `;
        }).join("")
      : "<p>No assignments available yet.</p>";

  } catch (error) {
    list.textContent = error.message;
  }
}

document.addEventListener("submit", async event => {
  const form = event.target;
  if (!form.classList.contains("studentSubmissionForm")) return;

  event.preventDefault();

  try {
    const token = sessionStorage.getItem("campushubToken");
    const response = await fetch(
      `${API_URL}/assignments/${form.dataset.id}/submit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          submission_text: form.elements.submission_text.value.trim()
        })
      }
    );

    const result = await response.json();
    if (!response.ok) throw new Error(result.message);

    notify(result.message);
    loadStudentAssignments();

  } catch (error) {
    notify(error.message);
  }
});


// Start website

render();
