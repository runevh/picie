const express = require('express');

const app = express();
const port = process.env.PORT || 7734;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => res.send(200));

app.listen(port, () => console.log("[backend]: Application Started on", port));
