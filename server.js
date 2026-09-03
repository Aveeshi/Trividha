import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import dotenv from 'dotenv';
import routes from './src/routes/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// View engine setup (MVC - Views)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Static assets (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'src', 'public')));

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes (MVC - Routes & Controllers)
app.use('/', routes);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
