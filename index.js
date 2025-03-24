const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const nodemailer = require("nodemailer");
const useragent = require('express-useragent');
const cookieParser = require('cookie-parser');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const sharp = require('sharp');
const config = require('./config.json');

const app = express();
const PORT = config.web.port;

// Database connection pool
const pool = mysql.createPool({
  host: config.database.host,
  user: config.database.username,
  password: config.database.password,
  database: config.database.db,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || 
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Formato de archivo no permitido. Por favor sube una imagen, PDF o documento Word.'), false);
    }
  }
});

// Email configuration
const transporter = nodemailer.createTransport({
  host: config.mail.host,
  port: config.mail.port,
  secure: true,
  auth: {
      user: config.mail.user,
      pass: config.mail.pass,
  }
  // logger: true,  // Habilitar logs
  // debug: true    // Ver detalles de conexión
});

// Session Configuration
app.use(session({
  secret: config.auth.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to false for development
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24
  }
}));

app.use(useragent.express());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'client/pages'));
app.set('trust proxy', true);
app.use(express.static(path.join(__dirname, 'client/public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.disable("x-powered-by");

// Security headers
app.use((req, res, next) => {
  res.removeHeader("Cf-Ray");
  res.removeHeader("Cf-Cache-Status");
  res.removeHeader("Ncl");
  res.removeHeader("Server-Tuning");
  res.removeHeader("X-Xes-Protection");
  req.app.disable("etag");
  res.removeHeader("Server");
  next();
});

const handleApiError = (res, error) => {
  console.error('API Error:', error);
  res.status(500).json({ error: 'Error interno del servidor' });
};

app.use(async (req, res, next) => {
  res.locals.getFile = function(filePath) {
    const depth = req.path.split('/').length - 1;
    const relativePath = '../'.repeat(depth) + filePath;
    return relativePath;
  };

  if (req.session.userId) {
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.session.userId]);
      if (rows[0]) {
        // Parse JSON fields before passing to template
        const user = rows[0];
        user.presential = JSON.parse(user.presential, { online: false, presential: false });
        user.patients_type = JSON.parse(user.patients_type, { niños: false, adolescentes: false, adultos: false, "parejas": false, "familias": false});
        user.languages = JSON.parse(user.languages, { languages: [] });
        res.locals.user = user;
      } else {
        res.locals.user = null;
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      res.locals.user = null;
    }
  } else {
    res.locals.user = null;
  }
  
  next();
});

const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    return res.redirect('/login');
  }
  next();
};

const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('fullname').trim().notEmpty(),
  body('password').isLength({ min: 6 }),
  body('confirm-password').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Las contraseñas no coinciden');
    }
    return true;
  })
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

app.get('/', async (req, res) => {
  try {
    const [recommendedProfessionals] = await pool.query(`
      SELECT 
        u.id, 
        u.fullname, 
        u.avatar, 
        u.patients_type,
        c.name AS category_name,
        l.name AS location_name,
        t.name AS orientation_name
      FROM users u
      LEFT JOIN categories c ON u.category_id = c.id
      LEFT JOIN locations l ON u.location_id = l.id
      LEFT JOIN orientations t ON u.orientation_id = t.id
      WHERE u.recommended = 1 AND u.status = 'active'
      ORDER BY u.fullname
    `);

    res.render('global/index', { recommendedProfessionals });
  } catch (error) {
    console.error('Error fetching recommended professionals:', error);
    res.render('global/index', { recommendedProfessionals: [] });
  }
});

app.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
  res.render('global/login', { error: null });
});

app.post('/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Por favor, verifica tus credenciales' 
      });
    }

    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        error: 'Usuario no encontrado' 
      });
    }

    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ 
        error: 'Contraseña incorrecta' 
      });
    }

    if (!user.group == 'admin'){
      if (user.status == 'pending') {
        return res.status(403).json({ 
          error: 'Tu solicitud aún no fue aprobada' 
        });
      }
    }

    

    req.session.userId = user.id;
    res.json({ success: true });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.get('/register', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
  res.render('global/register', { error: null });
});

// Test de emails
// app.get('/mandar', async (req, res) => {
//   try {
//     const info = await transporter.sendMail({
//       from: '"Integra" <integrate@e-integra.com>',
//       to: "luquijuarez2016@gmail.com",
//       subject: "Registro Profesional en Proceso",
//       html: `<h1>Gracias por registrarte</h1><p>Tu registro está siendo procesado.</p>`
//   });

//   console.log("Correo info:", info);
//     console.log('Correo enviado:', info.messageId);
//     console.log('Respuesta del servidor:', info.response);
//     res.send('holita papu');  
//   } catch (error) {
//     console.error('Error en el registro:', error);
//     res.status(500).json({ error: 'Error en el registro' });
//   }
  
// });

app.post('/register', registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Por favor, verifica los datos ingresados' 
      });
    }

    const { email, fullname, password } = req.body;
    
    // Check if email exists
    const [existingUser] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(409).json({ 
        error: 'El correo electrónico ya está registrado' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert new user
    const [result] = await pool.query(
      'INSERT INTO users (email, fullname, password, `group`, createdAt) VALUES (?, ?, ?, ?)',
      [email, fullname, hashedPassword, new Date()]
    );

    req.session.userId = result.insertId;
    res.json({ success: true });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/settings/account', requireAuth, (req, res) => {
  res.render('global/settings/account');
});

app.get('/settings/professional', requireAuth, (req, res) => {
  res.render('global/settings/professional');
});

app.post('/api/settings/account', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.session.userId;
    const { fullname, current_password, new_password } = req.body;
    
    // Start building the query and parameters
    let query = 'UPDATE users SET fullname = ?';
    let params = [fullname];

    // If new password is provided, verify current password and update
    if (new_password) {
      const [user] = await pool.query('SELECT password FROM users WHERE id = ?', [userId]);
      
      const validPassword = await bcrypt.compare(current_password, user[0].password);
      if (!validPassword) {
        return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
      }

      const hashedPassword = await bcrypt.hash(new_password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    // If avatar is uploaded, process and save it
    if (req.file) {
      const avatarFilename = `avatar-${userId}${path.extname(req.file.originalname)}`;
      
      // Process image with sharp
      await sharp(req.file.path)
        .resize(200, 200, { fit: 'cover' })
        .toFile(path.join(__dirname, 'uploads', avatarFilename));

      // Delete original upload
      fs.unlinkSync(req.file.path);

      query += ', avatar = ?';
      params.push(avatarFilename);
    }

    // Add WHERE clause and execute
    query += ' WHERE id = ?';
    params.push(userId);

    await pool.query(query, params);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating account settings:', error);
    res.status(500).json({ error: 'Error al actualizar la configuración de la cuenta' });
  }
});

app.post('/api/settings/professional', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const {
      phone,
      online,
      presential,
      niños,
      adolescentes,
      adultos,
      parejas,
      familias,
      short_description,
      location_id,
      orientation_id,
      category_id,
      languages
    } = req.body;

    // Convert attendance preferences to JSON
    const attendanceJSON = JSON.stringify({
      online: online === 'true',
      presential: presential === 'true'
    });

    // Convert patients type to JSON
    const patientsJSON = JSON.stringify({
      niños: niños === 'true',
      adolescentes: adolescentes === 'true',
      adultos: adultos === 'true', 
      parejas: parejas === 'true',
      familias: familias === 'true'
    });

    // Convert languages to JSON
    const languagesJSON = JSON.stringify({
      languages: languages ? languages.split(',').map(lang => lang.trim()) : []
    });

    const query = `
      UPDATE users 
      SET phone = ?,
          presential = ?,
          patients_type = ?,
          short_description = ?,
          location_id = ?,
          orientation_id = ?,
          category_id = ?,
          languages = ?
      WHERE id = ?
    `;

    await pool.query(query, [
      phone,
      attendanceJSON,
      patientsJSON,
      short_description,
      location_id || null,
      orientation_id || null,
      category_id || null,
      languagesJSON,
      userId
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating professional settings:', error);
    res.status(500).json({ error: 'Error al actualizar el perfil profesional' });
  }
});

app.get('/api/settings/options', requireAuth, async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT id, name FROM categories ORDER BY name');
    const [locations] = await pool.query('SELECT id, name FROM locations ORDER BY name');
    const [orientations] = await pool.query('SELECT id, name FROM orientations ORDER BY name');
    
    res.json({ categories, locations, orientations });
  } catch (error) {
    console.error('Error fetching options:', error);
    res.status(500).json({ error: 'Error al obtener las opciones' });
  }
});

app.get('/contact', (req, res) => {
  res.render('global/contact');
});

app.get('/professionals/send', (req, res) => {
  res.render('global/send_form');
});

app.get('/professionals', (req, res) => {
  res.render('global/prev_form');
});

app.get('/registration-success', (req, res) => {
  res.render('global/registration-success');
});

app.get('/control', (req, res) => {
  res.render('admin/dashboard');
});

app.post('/register-professional', upload.fields([
  { name: 'degree_proof', maxCount: 1 },
  { name: 'transfer_ticket', maxCount: 1 },
  { name: 'payment_proof', maxCount: 1 }
]), async (req, res) => {
  try {
    const { email, fullname, password } = req.body;
    const ip = req.ip;

    // Validar campos requeridos
    if (!email || !fullname || !password || !req.files || !req.files.degree_proof || !req.files.payment_proof) {
      return res.status(400).json({ error: 'Todos los campos y archivos son requeridos' });
    }

    // Verificar si el email ya está registrado
    const [existingUser] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'El correo electrónico ya está registrado' });
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Obtener los nombres de los archivos subidos
    const universityDegree = req.files.degree_proof[0].filename;
    const transferTicket = req.files.payment_proof[0].filename;

    // Insertar usuario en la base de datos con estado "pendiente" (1)
    const [result] = await pool.query(
      `INSERT INTO users (email, fullname, password, reg_ip, university_degree, transfer_ticket) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email, fullname, hashedPassword, ip, universityDegree, transferTicket]
    );

    // Enviar email de confirmación
    await transporter.sendMail({
      from: config.mail.user,
      to: email,
      subject: 'Registro Profesional en Proceso',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h1 style="color: #f8c054; text-align: center;">Registro en proceso</h1>
        <p style="font-size: 16px;">Gracias por registrarte, <strong>${fullname}</strong>.</p>
        <p style="font-size: 16px;">Estamos procesando tu solicitud y te notificaremos cuando sea aprobada.</p>
        
        <h2 style="color: #555; border-bottom: 2px solid #ddd; padding-bottom: 5px;">Detalles del registro</h2>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Nombre:</strong> ${fullname}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>IP de registro:</strong> ${ip}</li>
          <li><strong>Fecha de registro:</strong> ${new Date().toLocaleString()}</li>
        </ul>
        
        <div style="text-align: center; margin-top: 20px;">
          <img src="https://professionals.lucasj2.com/global/assets/images/logo_black.png" style="max-width: 100px;" alt="Logo" />
        </div>
      </div>
      `
    });

    await transporter.sendMail({
      from: config.mail.user,
      to: config.mail.user,
      subject: '¡Se solicitó un registro para ' + fullname + '!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h1 style="color: #f8c054; text-align: center;">Nueva solicitud de registro</h1>
          <p style="font-size: 16px;">Se ha recibido una solicitud de registro de <strong>${fullname}</strong>.</p>
          <p style="font-size: 16px;">Para revisarla, ingresa al panel de administración.</p>
          
          <h2 style="color: #555; border-bottom: 2px solid #ddd; padding-bottom: 5px;">Detalles del registro</h2>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Nombre:</strong> ${fullname}</li>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>IP de registro:</strong> ${ip}</li>
            <li><strong>Fecha de registro:</strong> ${new Date().toLocaleString()}</li>
          </ul>
          
          <div style="text-align: center; margin-top: 20px;">
            <a href="https://e-integra.com/control/pending" style="background-color: #28a745; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-size: 16px;">Ingresar</a>
          </div>
          
          <div style="text-align: center; margin-top: 20px;">
            <img src="https://professionals.lucasj2.com/global/assets/images/logo_black.png" style="max-width: 100px;" alt="Logo" />
          </div>
        </div>
      `
    });

    res.json({ success: true, message: 'Registro enviado correctamente' });
  } catch (error) {
    console.error('Error en el registro:', error);
    res.status(500).json({ error: 'Error en el registro' });
  }
});

app.get('/control/users', requireAuth, async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT id, fullname, email, status, created_at, avatar
      FROM users 
      WHERE status IN (1, 2) 
      ORDER BY created_at DESC
    `);

    res.render('admin/users_list', { users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).render('global/return_page', { error: 500 });
  }
});

app.get('/control/pending', requireAuth, async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT id, fullname, email, created_at, university_degree, transfer_ticket 
      FROM users 
      WHERE status = 'pending' 
      ORDER BY created_at DESC
    `);

    res.render('admin/user_pending', { users });
  } catch (error) {
    console.error('Error fetching pending users:', error);
    res.status(500).render('global/return_page', { error: 500 });
  }
});

app.get('/control/users/edit/:id', requireAuth, async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.*, 
        GROUP_CONCAT(DISTINCT uf.category_id) as filter_categories,
        GROUP_CONCAT(DISTINCT uf.option_id) as filter_options
       FROM users u
       LEFT JOIN user_filters uf ON u.id = uf.user_id
       WHERE u.id = ?
       GROUP BY u.id`, 
      [req.params.id]
    );

    if (users.length === 0) {
      return res.status(404).render('global/return_page', { error: 404 });
    }

    // Get user's filters
    const [userFilters] = await pool.query(
      `SELECT uf.category_id, uf.option_id 
       FROM user_filters uf 
       WHERE uf.user_id = ?`,
      [req.params.id]
    );

    // Format filters into a more usable structure
    const filters = {};
    userFilters.forEach(filter => {
      if (!filters[filter.category_id]) {
        filters[filter.category_id] = [];
      }
      filters[filter.category_id].push(filter.option_id);
    });

    const user = users[0];
    user.filters = filters;

    res.render('admin/user_edit', { user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).render('global/return_page', { error: 500 });
  }
});

app.get('/api/users/filter', requireAuth, async (req, res) => {
  try {
      const { search, status, sort } = req.query;
      
      let query = `
          SELECT id, fullname, email, status, created_at, avatar
          FROM users 
          WHERE 1=1
      `;
      
      const params = [];

      // Search filter
      if (search) {
          query += ` AND (fullname LIKE ? OR email LIKE ?)`;
          params.push(`%${search}%`, `%${search}%`);
      }

      // Status filter
      if (status) {
          query += ` AND status = ?`;
          params.push(status);
      }

      // Sorting
      switch (sort) {
          case 'date_desc':
              query += ` ORDER BY created_at DESC`;
              break;
          case 'date_asc':
              query += ` ORDER BY created_at ASC`;
              break;
          default:
              query += ` ORDER BY fullname`;
      }

      const [users] = await pool.query(query, params);

      res.json({ users });
  } catch (error) {
      console.error('Error filtering users:', error);
      res.status(500).json({ error: 'Error al filtrar usuarios' });
  }
});

app.post('/api/users/:id/update', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      fullname, 
      email, 
      phone, 
      status, 
      password,
      recommended,
      category_id,
      location_id,
      orientation_id,
      filters,
      userData
    } = req.body;

    let query = `
      UPDATE users 
      SET fullname = ?, 
          email = ?, 
          phone = ?, 
          status = ?,
          recommended = ?,
          category_id = ?,
          location_id = ?,
          orientation_id = ?
    `;
    
    let params = [
      fullname, 
      email, 
      phone, 
      status,
      recommended === '1' ? 1 : 0,
      category_id || null,
      location_id || null,
      orientation_id || null
    ];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    if (filters) {
      const parsedFilters = JSON.parse(filters);
      
      // First delete existing user filters
      await pool.query('DELETE FROM user_filters WHERE user_id = ?', [id]);
      
      // Insert new filters
      for (const [categoryId, optionIds] of Object.entries(parsedFilters)) {
          for (const optionId of optionIds) {
              await pool.query(
                  'INSERT INTO user_filters (user_id, category_id, option_id) VALUES (?, ?, ?)',
                  [id, categoryId, optionId]
              );
          }
      }
  }

    query += ' WHERE id = ?';
    params.push(id);

    await pool.query(query, params);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
});

app.delete('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Error al eliminar el usuario' });
  }
});

app.get('/control/users/register', (req, res) => {
  res.render('admin/register');
});

app.get('/control/settings', (req, res) => {
  res.render('admin/settings');
});

app.get('/profile/:id', async (req, res) => {
  try {
    const [professionals] = await pool.query(`
      SELECT 
        u.id,
        u.fullname,
        u.avatar,
        u.languages,
        u.short_description,
        c.name AS category_name,
        l.name AS location_name,
        t.name AS orientation_name,
        u.presential,
        u.patients_type,
        u.phone,
        u.email
      FROM users u
      LEFT JOIN categories c ON u.category_id = c.id
      LEFT JOIN locations l ON u.location_id = l.id
      LEFT JOIN orientations t ON u.orientation_id = t.id
      WHERE u.id = ? AND u.status = 'active'
    `, [req.params.id]);

    if (professionals.length === 0) {
      return res.status(404).render('global/return_page', { error: 404 });
    }

    const professional = professionals[0];

    // Parse JSON fields
    try {
      if (professional.presential) {
        const presentialData = JSON.parse(professional.presential);
        professional.online = presentialData.online === true;
        professional.presential = presentialData.presential === true;
      }

      if (professional.patients_type) {
        professional.patients_type = JSON.parse(professional.patients_type);
      }

      if (professional.languages) {
        professional.languages = JSON.parse(professional.languages);
      }
    } catch (error) {
      console.error('Error parsing JSON fields:', error);
    }

    res.render('global/profile', { professional });
  } catch (error) {
    console.error('Error fetching professional data:', error);
    res.status(500).render('global/return_page', { error: 500 });
  }
});

app.get('/search', async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT * FROM categories ORDER BY name');
    const [locations] = await pool.query('SELECT * FROM locations ORDER BY name');
    const [orientations] = await pool.query('SELECT * FROM orientations ORDER BY name');

    const [professionals] = await pool.query(`
      SELECT 
        u.id, u.fullname, u.avatar, u.short_description,
        c.name AS category_name,
        l.name AS location_name,
        t.name AS orientation_name,
        u.presential,
        u.patients_type
      FROM users u
      LEFT JOIN categories c ON u.category_id = c.id
      LEFT JOIN locations l ON u.location_id = l.id
      LEFT JOIN orientations t ON u.orientation_id = t.id
      WHERE u.status = 'active'
      ORDER BY u.fullname
      LIMIT 10
    `);

    const formattedProfessionals = professionals.map(professional => {
        let presentialData = { online: false, presential: false };
        let patientsType = { "niños": false, "adolescentes": false, "adultos": false, "parejas": false, "familias": false };

        if (professional.presential) {
            try {
                presentialData = JSON.parse(professional.presential);
            } catch (error) {
                console.error(`Error parsing JSON for user ${professional.id}:`, error);
            }
        }

        if (professional.patients_type) {
            try {
                patientsType = JSON.parse(professional.patients_type);
            } catch (error) {
                console.error(`Error parsing JSON for patients_type of user ${professional.id}:`, error);
            }
        }

        professional.fullname = professional.fullname.toUpperCase();

        return {
            ...professional,
            online: presentialData.online === true,
            presential: presentialData.presential === true,
            patients_type: patientsType
        };
    });

    const [totalCount] = await pool.query('SELECT COUNT(*) as total FROM users WHERE status = "active"');
    const totalPages = Math.ceil(totalCount[0].total / 10);

    res.render('global/search', {
      categories,
      locations,
      orientations,
      professionals: formattedProfessionals,
      currentPage: 1,
      totalPages
    });
  } catch (error) {
    console.error('Error fetching search data:', error);
    res.status(500).render('global/return_page', { error: 500 });
  }
});

app.post('/api/users/:id/approve', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('UPDATE users SET status = "active" WHERE id = ?', [id]);
    const [user] = await pool.query('SELECT email FROM users WHERE id = ?', [id]);
    
    await transporter.sendMail({
      from: config.mail.user,
      to: user[0].email,
      subject: 'Registro Aprobado',
      html: `
        <h1>¡Tu registro ha sido aprobado!</h1>
        <p>Ya puedes acceder a tu cuenta y completar tu perfil profesional.</p>
      `
    });

    res.json({ success: true });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post('/api/users/:id/reject', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [user] = await pool.query('SELECT email FROM users WHERE id = ?', [id]);
    
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    
    await transporter.sendMail({
      from: config.mail.user,
      to: user[0].email,
      subject: 'Registro No Aprobado',
      html: `
        <h1>Tu registro no ha sido aprobado</h1>
        <p>Lo sentimos, pero tu solicitud de registro no cumple con nuestros requisitos.</p>
      `
    });

    res.json({ success: true });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const { 
      search, 
      categories, 
      orientations,
      gender, 
      patientTypes, 
      location, 
      dynamicFilters,
      page = 1 
    } = req.query;
    
    const limit = 10;
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        u.id, 
        u.fullname, 
        u.avatar, 
        u.short_description, 
        u.gender,
        u.presential,
        u.patients_type,
        c.name as category_name,
        l.name as location_name,
        t.name as orientation_name
      FROM users u
      LEFT JOIN categories c ON u.category_id = c.id
      LEFT JOIN locations l ON u.location_id = l.id
      LEFT JOIN orientations t ON u.orientation_id = t.id
      LEFT JOIN user_filters uf ON u.id = uf.user_id
      WHERE u.status = 'active'
    `;

    const params = [];

    // Search filter
    if (search && search.trim() !== '') {
      query += ` AND (
        LOWER(u.fullname) LIKE LOWER(?) OR 
        LOWER(c.name) LIKE LOWER(?) OR 
        LOWER(t.name) LIKE LOWER(?) OR
        LOWER(u.short_description) LIKE LOWER(?)
      )`;
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Categories filter
    if (categories && categories !== '') {
      const categoryIds = categories.split(',').filter(Boolean);
      if (categoryIds.length > 0) {
        query += ` AND u.category_id IN (${categoryIds.map(() => '?').join(',')})`;
        params.push(...categoryIds);
      }
    }

    // Orientations filter
    if (orientations && orientations !== '') {
      const orientationIds = orientations.split(',').filter(Boolean);
      if (orientationIds.length > 0) {
        query += ` AND u.orientation_id IN (${orientationIds.map(() => '?').join(',')})`;
        params.push(...orientationIds);
      }
    }

    // Gender filter
    if (gender && gender !== '') {
      const genderValues = gender.split(',').filter(Boolean);
      if (genderValues.length > 0) {
        query += ` AND u.gender IN (${genderValues.map(() => '?').join(',')})`;
        params.push(...genderValues);
      }
    }

    // Patient types filter
    if (patientTypes && patientTypes !== '') {
      const types = patientTypes.split(',').filter(Boolean);
      if (types.length > 0) {
        const conditions = types.map(type => `JSON_EXTRACT(u.patients_type, '$.${type}') = true`);
        query += ` AND (${conditions.join(' OR ')})`;
      }
    }

    // Location filter
    if (location && location !== '') {
      query += ` AND u.location_id = ?`;
      params.push(location);
    }

    // Dynamic filters
    if (dynamicFilters) {
      try {
        const filters = JSON.parse(dynamicFilters);
        for (const [categoryId, optionIds] of Object.entries(filters)) {
          if (optionIds && optionIds.length > 0) {
            query += ` AND EXISTS (
              SELECT 1 FROM user_filters uf2 
              WHERE uf2.user_id = u.id 
              AND uf2.category_id = ? 
              AND uf2.option_id IN (${optionIds.map(() => '?').join(',')})
            )`;
            params.push(categoryId, ...optionIds);
          }
        }
      } catch (error) {
        console.error('Error parsing dynamic filters:', error);
      }
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT(DISTINCT id) as total FROM (${query}) as subquery`;
    const [countResult] = await pool.query(countQuery, params);
    const totalCount = countResult[0].total;

    // Add sorting and pagination
    query += ` GROUP BY u.id ORDER BY u.fullname ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // Execute the main query
    const [professionals] = await pool.query(query, params);

    // Format the results
    const formattedProfessionals = professionals.map(professional => {
      try {
        // Parse presential JSON
        let presentialData = { online: false, presential: false };
        if (professional.presential) {
          try {
            presentialData = JSON.parse(professional.presential);
          } catch (e) {
            console.error('Error parsing presential JSON:', e);
          }
        }
        professional.online = presentialData.online === true;
        professional.presential = presentialData.presential === true;

        // Parse patients_type JSON
        let patientsType = {
          niños: false,
          adolescentes: false,
          adultos: false,
          parejas: false,
          familias: false
        };
        if (professional.patients_type) {
          try {
            patientsType = { ...patientsType, ...JSON.parse(professional.patients_type) };
          } catch (e) {
            console.error('Error parsing patients_type JSON:', e);
          }
        }
        professional.patients_type = patientsType;

        return professional;
      } catch (error) {
        console.error(`Error formatting professional ${professional.id}:`, error);
        return professional;
      }
    });

    res.json({
      professionals: formattedProfessionals,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / limit)
    });

  } catch (error) {
    console.error('Search API Error:', error);
    res.status(500).json({ error: 'Error al buscar profesionales' });
  }
});

app.post('/api/admin/register', requireAuth, async (req, res) => {
  try {
    const { fullname, email, password, role, status } = req.body;

    // Check if email exists
    const [existingUser] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'El correo electrónico ya está registrado' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Default values for new user
    const presential = JSON.stringify({ online: false, presential: false });
    const patients_type = JSON.stringify({ "niños": false, "adolescentes": false, "adultos": false, "parejas": false, "familias": false });
    const languages = JSON.stringify({ "languages": ["Español"] });

    // Insert new user
    const [result] = await pool.query(
      `INSERT INTO users (
        email, 
        fullname, 
        password, 
        status, 
        \`group\`,
        presential,
        patients_type,
        languages,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [email, fullname, hashedPassword, status, role, presential, patients_type, languages]
    );

    res.json({ 
      success: true, 
      message: 'Usuario registrado correctamente',
      userId: result.insertId 
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Error al registrar el usuario' });
  }
});

app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    // Get total users count
    const [totalUsersResult] = await pool.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = totalUsersResult[0].count;

    // Get verified professionals count
    const [verifiedResult] = await pool.query('SELECT COUNT(*) as count FROM users WHERE status = "active"');
    const verifiedProfessionals = verifiedResult[0].count;

    // Get pending requests count
    const [pendingResult] = await pool.query('SELECT COUNT(*) as count FROM users WHERE status = "pending"');
    const pendingRequests = pendingResult[0].count;

    // Get recent users
    const [recentUsers] = await pool.query(`
      SELECT id, fullname, email, status, created_at, avatar
      FROM users
      ORDER BY created_at DESC
      LIMIT 3
    `);

    res.json({
      totalUsers,
      verifiedProfessionals,
      pendingRequests,
      recentUsers
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.get('/stats', requireAuth, async (req, res) => {
  if (req.session.userId) {
      try {
          const [user] = await pool.query('SELECT * FROM users WHERE id = ?', [req.session.userId]);
          if (user[0]) {
              res.render('global/stats', { user: user[0] });
          } else {
              res.redirect('/login');
          }
      } catch (error) {
          console.error('Error fetching user stats:', error);
          res.status(500).render('global/return_page', { error: 500 });
      }
  } else {
      res.redirect('/login');
  }
});

app.get('/api/admin/locations', requireAuth, async (req, res) => {
  try {
      const [locations] = await pool.query('SELECT * FROM locations ORDER BY name');
      res.json(locations);
  } catch (error) {
      console.error('Error fetching locations:', error);
      res.status(500).json({ error: 'Error al obtener las ubicaciones' });
  }
});

app.post('/api/admin/locations', requireAuth, async (req, res) => {
  try {
      const { name } = req.body;
      if (!name) {
          return res.status(400).json({ error: 'El nombre es requerido' });
      }

      const [result] = await pool.query('INSERT INTO locations (name) VALUES (?)', [name]);
      res.json({ id: result.insertId, name });
  } catch (error) {
      console.error('Error creating location:', error);
      res.status(500).json({ error: 'Error al crear la ubicación' });
  }
});

app.put('/api/admin/locations/:id', requireAuth, async (req, res) => {
  try {
      const { id } = req.params;
      const { name } = req.body;
      
      if (!name) {
          return res.status(400).json({ error: 'El nombre es requerido' });
      }

      await pool.query('UPDATE locations SET name = ? WHERE id = ?', [name, id]);
      res.json({ success: true });
  } catch (error) {
      console.error('Error updating location:', error);
      res.status(500).json({ error: 'Error al actualizar la ubicación' });
  }
});

app.delete('/api/admin/locations/:id', requireAuth, async (req, res) => {
  try {
      const { id } = req.params;
      await pool.query('DELETE FROM locations WHERE id = ?', [id]);
      res.json({ success: true });
  } catch (error) {
      console.error('Error deleting location:', error);
      res.status(500).json({ error: 'Error al eliminar la ubicación' });
  }
});

app.get('/api/admin/categories', requireAuth, async (req, res) => {
  try {
      const [categories] = await pool.query('SELECT * FROM categories ORDER BY name');
      res.json(categories);
  } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Error al obtener las categorías' });
  }
});

app.post('/api/admin/categories', requireAuth, async (req, res) => {
  try {
      const { name } = req.body;
      if (!name) {
          return res.status(400).json({ error: 'El nombre es requerido' });
      }

      const [result] = await pool.query('INSERT INTO categories (name) VALUES (?)', [name]);
      res.json({ id: result.insertId, name });
  } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ error: 'Error al crear la categoría' });
  }
});

app.put('/api/admin/categories/:id', requireAuth, async (req, res) => {
  try {
      const { id } = req.params;
      const { name } = req.body;
      
      if (!name) {
          return res.status(400).json({ error: 'El nombre es requerido' });
      }

      await pool.query('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
      res.json({ success: true });
  } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({ error: 'Error al actualizar la categoría' });
  }
});

app.delete('/api/admin/categories/:id', requireAuth, async (req, res) => {
  try {
      const { id } = req.params;
      await pool.query('DELETE FROM categories WHERE id = ?', [id]);
      res.json({ success: true });
  } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({ error: 'Error al eliminar la categoría' });
  }
});

app.get('/api/admin/orientations', requireAuth, async (req, res) => {
  try {
      const [orientations] = await pool.query('SELECT * FROM orientations ORDER BY name');
      res.json(orientations);
  } catch (error) {
      console.error('Error fetching orientations:', error);
      res.status(500).json({ error: 'Error al obtener las categorías' });
  }
});

app.post('/api/admin/orientations', requireAuth, async (req, res) => {
  try {
      const { name } = req.body;
      if (!name) {
          return res.status(400).json({ error: 'El nombre es requerido' });
      }

      const [result] = await pool.query('INSERT INTO orientations (name) VALUES (?)', [name]);
      res.json({ id: result.insertId, name });
  } catch (error) {
      console.error('Error creating orientation:', error);
      res.status(500).json({ error: 'Error al crear la categoría' });
  }
});

app.put('/api/admin/orientations/:id', requireAuth, async (req, res) => {
  try {
      const { id } = req.params;
      const { name } = req.body;
      
      if (!name) {
          return res.status(400).json({ error: 'El nombre es requerido' });
      }

      await pool.query('UPDATE orientations SET name = ? WHERE id = ?', [name, id]);
      res.json({ success: true });
  } catch (error) {
      console.error('Error updating orientation:', error);
      res.status(500).json({ error: 'Error al actualizar la categoría' });
  }
});

app.delete('/api/admin/orientations/:id', requireAuth, async (req, res) => {
  try {
      const { id } = req.params;
      await pool.query('DELETE FROM orientations WHERE id = ?', [id]);
      res.json({ success: true });
  } catch (error) {
      console.error('Error deleting orientation:', error);
      res.status(500).json({ error: 'Error al eliminar la categoría' });
  }
});

app.post('/api/contact/:id', async (req, res) => {
  try {
      const { id } = req.params;
      const clientIp = req.ip;
      const currentTime = Date.now();
      
      // Check if this IP has accessed this profile's contact info recently
      const contactKey = `contact:${id}:${clientIp}`;
      
      // Get stored contact attempt from database
      const [attempts] = await pool.query(
          'SELECT created_at FROM contact_attempts WHERE profile_id = ? AND ip_address = ? ORDER BY created_at DESC LIMIT 1',
          [id, clientIp]
      );

      if (attempts.length > 0) {
          const lastAttempt = attempts[0].created_at.getTime();
          const hoursSinceLastAttempt = (currentTime - lastAttempt) / (1000 * 60 * 60);

          // If less than 24 hours have passed
          if (hoursSinceLastAttempt < 24) {
            // Record this attempt
             await pool.query(
               'INSERT INTO contact_attempts (profile_id, ip_address, created_at) VALUES (?, ?, NOW())',
               [id, clientIp]
           );
 
           // Increment contact_clicks counter
           await pool.query(
               'UPDATE users SET contact_clicks = IFNULL(contact_clicks, 0) + 1 WHERE id = ?',
               [id]
           ); 
       }
      }

      res.json({ success: true });
  } catch (error) {
      console.error('Error handling contact request:', error);
      res.status(500).json({ error: 'Error al procesar la solicitud de contacto' });
  }
});

app.get('/api/admin/filter-categories', async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT * FROM filter_categories ORDER BY name');
    res.json(categories);
  } catch (error) {
    console.error('Error fetching filter categories:', error);
    res.status(500).json({ error: 'Error al obtener las categorías de filtros' });
  }
});

app.post('/api/admin/filter-categories', requireAuth, async (req, res) => {
  try {
      const { name } = req.body;
      if (!name) {
          return res.status(400).json({ error: 'El nombre es requerido' });
      }

      const [result] = await pool.query('INSERT INTO filter_categories (name) VALUES (?)', [name]);
      res.json({ id: result.insertId, name });
  } catch (error) {
      console.error('Error creating filter category:', error);
      res.status(500).json({ error: 'Error al crear la categoría de filtro' });
  }
});

app.put('/api/admin/filter-categories/:id', requireAuth, async (req, res) => {
  try {
      const { id } = req.params;
      const { name } = req.body;
      
      if (!name) {
          return res.status(400).json({ error: 'El nombre es requerido' });
      }

      await pool.query('UPDATE filter_categories SET name = ? WHERE id = ?', [name, id]);
      res.json({ success: true });
  } catch (error) {
      console.error('Error updating filter category:', error);
      res.status(500).json({ error: 'Error al actualizar la categoría de filtro' });
  }
});

app.delete('/api/admin/filter-categories/:id', requireAuth, async (req, res) => {
  try {
      const { id } = req.params;
      await pool.query('DELETE FROM filter_categories WHERE id = ?', [id]);
      res.json({ success: true });
  } catch (error) {
      console.error('Error deleting filter category:', error);
      res.status(500).json({ error: 'Error al eliminar la categoría de filtro' });
  }
});

app.get('/api/admin/filter-categories/:categoryId/options', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const [options] = await pool.query(
      'SELECT * FROM filter_options WHERE category_id = ? ORDER BY name',
      [categoryId]
    );
    res.json(options);
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({ error: 'Error al obtener las opciones de filtro' });
  }
});

app.post('/api/admin/filter-categories/:categoryId/options', requireAuth, async (req, res) => {
  try {
      const { categoryId } = req.params;
      const { name } = req.body;
      
      if (!name) {
          return res.status(400).json({ error: 'El nombre es requerido' });
      }

      const [result] = await pool.query(
          'INSERT INTO filter_options (category_id, name) VALUES (?, ?)',
          [categoryId, name]
      );
      
      res.json({ id: result.insertId, category_id: categoryId, name });
  } catch (error) {
      console.error('Error creating filter option:', error);
      res.status(500).json({ error: 'Error al crear la opción de filtro' });
  }
});

app.delete('/api/admin/filter-categories/:categoryId/options/:optionId', requireAuth, async (req, res) => {
  try {
      const { optionId } = req.params;
      await pool.query('DELETE FROM filter_options WHERE id = ?', [optionId]);
      res.json({ success: true });
  } catch (error) {
      console.error('Error deleting filter option:', error);
      res.status(500).json({ error: 'Error al eliminar la opción de filtro' });
  }
});

app.use('/api', (err, req, res, next) => {
  handleApiError(res, err);
});

app.use((req, res) => {
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(404).json({ error: 'Ruta no encontrada' });
  }
  res.status(404).render('global/return_page', { error: 404 });
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
  res.status(500).render('global/return_page', { error: 500 });
});

app.listen(PORT, () => {
  console.log(`Server running on port: ${PORT}`);
});