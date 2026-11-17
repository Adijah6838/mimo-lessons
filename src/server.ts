import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';

const app = express();
app.use(cors());
app.use(express.json());

const db = new Database('database.sqlite');

db.exec(`
  CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER,
    prompt TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    hint TEXT,
    difficulty TEXT DEFAULT 'beginner',
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
  );
  CREATE TABLE IF NOT EXISTS progress (
    lesson_id INTEGER PRIMARY KEY,
    status TEXT DEFAULT 'in_progress',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const count = db.prepare('SELECT COUNT(*) as count FROM lessons').get() as { count: number };
if (count.count === 0) {
  const insertLesson = db.prepare('INSERT INTO lessons (title, description) VALUES (?, ?)');
  const insertEx = db.prepare('INSERT INTO exercises (lesson_id, prompt, correct_answer, hint, difficulty) VALUES (?, ?, ?, ?, ?)');
  
  const res1 = insertLesson.run('Variables', 'Learn how to store data in variables.');
  const l1 = res1.lastInsertRowid;
  insertEx.run(l1, 'Declare a variable named "age" with the value 25.', 'let age = 25', 'Use the let keyword followed by the name and value.', 'beginner');
  insertEx.run(l1, 'Declare a constant named "PI" with value 3.14.', 'const PI = 3.14', 'Use the const keyword.', 'beginner');
  insertEx.run(l1, 'Reassign the value of the variable "x" to 10.', 'x = 10', 'Just use the assignment operator (=) with the name and value.', 'intermediate');

  const res2 = insertLesson.run('Functions', 'Create reusable blocks of code.');
  const l2 = res2.lastInsertRowid;
  insertEx.run(l2, 'Call the function "greet()" to execute it.', 'greet()', 'Just write the function name followed by parentheses.', 'beginner');
  insertEx.run(l2, 'Create a function called "add" that takes two parameters a and b.', 'function add(a, b) {}', 'Use function keyword, name, and parentheses.', 'intermediate');
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/lessons', (req, res) => {
  const lessons = db.prepare('SELECT * FROM lessons').all();
  res.json(lessons);
});

app.get('/api/lessons/:id', (req, res) => {
  const { id } = req.params;
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(id) as any;
  if (!lesson) {
    return res.status(404).json({ error: 'Lesson not found' });
  }
  
  const exercises = db.prepare('SELECT id, prompt, hint, difficulty FROM exercises WHERE lesson_id = ?').all(id);
  res.json({ ...lesson, exercises });
});

app.post('/api/lessons/:id/exercises/:exerciseId/validate', (req, res) => {
  const { exerciseId } = req.params;
  const { answer } = req.body;
  
  if (!answer) {
    return res.status(400).json({ error: 'Answer required' });
  }

  const exercise = db.prepare('SELECT correct_answer FROM exercises WHERE id = ?').get(exerciseId) as any;
  if (!exercise) {
    return res.status(404).json({ error: 'Exercise not found' });
  }

  const isCorrect = answer.trim().toLowerCase() === exercise.correct_answer.trim().toLowerCase();
  res.json({ correct: isCorrect });
});

app.post('/api/lessons/:id/complete', (req, res) => {
  const { id } = req.params;
  db.prepare(`
    INSERT INTO progress (lesson_id, status) VALUES (?, 'completed')
    ON CONFLICT(lesson_id) DO UPDATE SET status='completed', updated_at=CURRENT_TIMESTAMP
  `).run(id);
  
  res.json({ message: 'Progress saved' });
});

app.get('/api/progress', (req, res) => {
  const progress = db.prepare('SELECT * FROM progress').all();
  res.json(progress);
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
