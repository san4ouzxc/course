const express = require('express');
const { Client } = require('pg');
const session = require('express-session');
const path = require('path');
const app = express();
const bodyParser = require('body-parser');
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true })); 
app.use('/scripts', express.static(path.join(__dirname, 'public', 'scripts')));
app.use('/styles', express.static(path.join(__dirname, 'public', 'styles')));
app.use(bodyParser.json());

const client = new Client({
  user: 'postgres',        
  host: 'localhost',
  database: 'zxcursed1488',  
  password: 'Cult.141221',  
  port: 5432,
});

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } 
}));

client.connect();

app.post('/addEmployee', async (req, res) => {
  const { full_name, email, position, salary, workshop_id } = req.body;

  const query = `INSERT INTO Employees (full_name, email, position, salary, workshop_id)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`;

  try {
    const result = await client.query(query, [full_name, email, position, salary, workshop_id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка при добавлении сотрудника' });
  }
});

app.get('/employees', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM Employees');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка при получении данных' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'main.html'));  
});

app.get('/employees.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'employees.html'));
});

app.delete('/deleteEmployee/:email', async (req, res) => {
  const { email } = req.params;

  const query = 'DELETE FROM Employees WHERE email = $1';

  try {
      const result = await client.query(query, [email]);

      if (result.rowCount > 0) {
          res.status(200).json({ message: 'Сотрудник удален' });
      } else {
          res.status(404).json({ error: 'Сотрудник не найден' });   
      }
  } catch (err) {
      console.error('Ошибка при удалении сотрудника:', err);
      res.status(500).json({ error: 'Ошибка при удалении сотрудника' });
  }
});

app.get('/workshops', async (req, res) => {
  try {
      const result = await client.query('SELECT * FROM Workshops');
      res.json(result.rows);
  } catch (err) {
      console.error('Помилка при отриманні даних про заводи:', err);
      res.status(500).json({ error: 'Не вдалося отримати дані про заводи' });
  }
});


app.get('/userInfo', async (req, res) => {
  const user = req.session.user;

  if (!user) {
    return res.status(401).send('Пользователь не авторизован');
  }

  const query = `
    SELECT u.username, u.password, e.full_name, e.email, e.position, e.salary, w.name AS workshop_name, w.location
    FROM Users u
    LEFT JOIN Employees e ON u.employee_id = e.employee_id
    LEFT JOIN Workshops w ON e.workshop_id = w.workshop_id
    WHERE u.id = $1
  `;

  try {
    const result = await client.query(query, [user.id]);

    if (result.rows.length > 0) {
      const userInfo = result.rows[0];
      res.json(userInfo);  
    } else {
      res.status(404).send('Користувача не знайдено');
    }
  } catch (err) {
    console.error('Помилка при отриманні даних', err);
    res.status(500).send('Помилка сервера');
  }
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'register.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'login.html'));
});

app.get('/add', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'add.html'));
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
      const query = 'INSERT INTO Users (username, password) VALUES ($1, $2)';
      await client.query(query, [username, password]);

      res.redirect('/');
  } catch (err) {
      console.error('Помилка при реєстрації', err);
      res.status(500).send('Ошибка сервера');
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const query = 'SELECT * FROM Users WHERE username = $1';
  
  try {
    const result = await client.query(query, [username]);

    if (result.rows.length === 0) {
      return res.status(400).send('Невірний логін або пароль');
    }

    const user = result.rows[0];

    if (password === user.password) {
      req.session.user = user;

      return res.status(200).send('Вхід виконано');
    } else {
      return res.status(400).send('Невірний логін або пароль');
    }
  } catch (err) {
    console.error('Ошибка при логине:', err);
    return res.status(500).send('Ошибка сервера');
  }
});

// Маршрут для получения данных пользователя
app.get('/userInfo', async (req, res) => {
  try {
      // Для примера, используем ID пользователя 1. Вы можете заменить это на реальную логику.
      const result = await client.query('SELECT username, password, full_name, email FROM Users WHERE id = $1', [1]);
      
      if (result.rows.length > 0) {
          res.json(result.rows[0]);
      } else {
          res.status(404).send('Пользователь не найден');
      }
  } catch (err) {
      console.error(err);
      res.status(500).send('Ошибка сервера');
  }
});

app.post('/updateUserInfo', async (req, res) => {
  const { username } = req.body;  // Извлекаем новое имя пользователя из тела запроса

  if (!username) {
      return res.status(400).send('Имя пользователя не указано');
  }

  try {
      // Обновляем только поле username для пользователя с ID 1
      const result = await client.query('UPDATE Users SET username = $1 WHERE id = $2 RETURNING id, username', [username, 1]);

      if (result.rowCount > 0) {
          // Отправляем только обновленную информацию о пользователе
          const updatedUser = result.rows[0];
          res.status(200).json(updatedUser); // Отправляем новый username
      } else {
          res.status(404).send('Пользователь не найден');
      }
  } catch (err) {
      console.error(err);
      res.status(500).send('Ошибка сервера');
  }
});


app.get('/audit', async (req, res) => {
  try {
      const result = await client.query('SELECT * FROM Employee_Audit ORDER BY created_at DESC');
      res.json(result.rows);  // Отправляем данные на клиент
  } catch (error) {
      console.error('Ошибка при получении данных аудита:', error);
      res.status(500).json({ error: 'Ошибка при получении данных аудита' });
  }
});

app.listen(port, () => {
  console.log(`Сервер работает на http://localhost:${port}`);
});
