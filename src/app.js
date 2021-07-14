const express = require("express");

const itemsRouter = require("./routers/itemsRouter");
const inventoryRouter = require("./routers/inventoryRouter");

const app = express();

app.use(express.json());
app.use(function (req, res, next) {
	res.setHeader("Access-Control-Allow-Origin", "*");
	next();
});
app.use(inventoryRouter);
app.use(itemsRouter);

module.exports = app;
