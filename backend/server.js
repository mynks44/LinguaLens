require('dotenv').config();
const express = require('express');
const cors = require('cors');

const translateRoutes = require('./routes/translate');
const generatorRoutes = require('./routes/generator');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/translate', translateRoutes);
app.use('/generator', generatorRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
