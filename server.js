const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve index_v4.html as the root page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index_v4.html'));
});

app.use(express.static(__dirname));

app.listen(PORT, () => console.log(`ALTER server running on port ${PORT}`));
