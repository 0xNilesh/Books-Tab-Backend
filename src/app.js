const express = require("express");

const itemsRouter = require("./routers/itemsRouter");
const inventoryRouter = require("./routers/inventoryRouter");

const app = express();

app.use(express.json());
app.use(itemsRouter);
app.use(inventoryRouter);

module.exports = app;
