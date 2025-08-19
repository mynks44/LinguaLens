const express = require('express');
const router = express.Router();
const axios = require('axios');

router.get('/:word', async (req, res) => {
  try {
    const word = req.params.word;
    const r = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
