const express = require("express");
const router = new express.Router();
const { db, defaultStorage } = require("../db/initialiseFirebase");
const multer = require("multer");
const cuid = require("cuid");

// All requests for inventory collection
// get request to get all docs from inventory collection
router.get("/inventory/all", async (req, res) => {
	try {
		const inventoryRef = db.collection("inventory");
		const snapshot = await inventoryRef.get();

		let response = [];
		snapshot.forEach((doc) => {
			const obj = doc.data();
			obj.id = doc.id;
			response.push(obj);
		});
		//res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
		res.status(200).send(response);
	} catch (err) {
		res.status(500).send(err.message);
	}
});

// get request to get particular item from inventory
router.get("/inventory/:id", async (req, res) => {
	const id = req.params.id;

	try {
		const docRef = db.collection("inventory").doc(id).get();
		res.status(200).send(await (await docRef).data());
	} catch (err) {
		res.status(500).send(err.message);
	}
});

// post request to add item in inventory collection in database
router.post("/add/inventory", async (req, res) => {
	try {
		const obj = req.body;

		if (obj.inclusiveOfTax === true) {
			obj.price = obj.purchasePrice;
		} else {
			let purchasedPrice = obj.purchasePrice,
				gstTax = obj.gstTaxRatePercentage,
				totalVal = 0;

			totalVal = purchasedPrice + purchasedPrice * (gstTax / 100);
			obj.price = totalVal;
		}

		// to store in items collection
		const uniqueId = cuid();
		const docRef = db.collection("items").doc(uniqueId);

		// save in items
		const savedDoc = await docRef.set({
			...obj,
			date: undefined,
			openingStock: undefined,
			lowStockWarning: undefined,
			lowStockUnits: undefined,
			id: uniqueId,
		});

		// save in inventory
		obj.itemId = uniqueId;

		const newUniqueId = cuid();
		obj.id = newUniqueId;
		await db.collection("inventory").doc(newUniqueId).set(obj);
		console.log(obj);

		res.sendStatus(200);
	} catch (err) {
		res.status(500).send(err.message);
	}
});

// post request to edit item in inventory collection in database
router.post("/edit/inventory/:id", async (req, res) => {
	const id = req.params.id;
	try {
		const docRef = await db.collection("inventory").doc(id).get();
		const docData = await docRef.data();

		const obj = req.body;

		if (obj.inclusiveOfTax === true) {
			obj.price = obj.purchasePrice;
		} else if (
			obj.inclusiveOfTax !== docData.inclusiveOfTax ||
			obj.purchasePrice !== docData.purchasePrice ||
			obj.gstTaxRatePercentage !== docData.gstTaxRatePercentage
		) {
			let purchasedPrice = obj.purchasePrice,
				gstTax = obj.gstTaxRatePercentage,
				totalVal = 0;

			totalVal = purchasedPrice + purchasedPrice * (gstTax / 100);
			obj.price = totalVal;
		}

		// save in inventory
		const savedDoc = await db
			.collection("inventory")
			.doc(id)
			.set(obj, { merge: true });

		// edit in items collection also
		await db
			.collection("items")
			.doc(docData.itemId)
			.set(
				{
					...obj,
					date: undefined,
					openingStock: undefined,
					lowStockWarning: undefined,
					lowStockUnits: undefined,
				},
				{ merge: true }
			);

		res.sendStatus(200);
	} catch (err) {
		res.status(500).send(err.message);
	}
});

// to upload images to firebase storage
let name;

const storage = multer.diskStorage({
	destination: function (req, file, callback) {
		callback(null, "./assets/images");
	},
	filename: function (req, file, callback) {
		name = cuid() + "." + file.mimetype.substr(6);
		callback(null, name);
	},
});

const upload = multer({
	storage: storage,
}).single("image");

// add or edit the image for inventory items
router.post("/edit/inventory/image/:id", async (req, res) => {
	const bucket = defaultStorage.bucket("books-tab.appspot.com");
	const id = req.params.id;
	const uniqueName = cuid();

	try {
		const doc = await db.collection("inventory").doc(id).get();
		const docData = await doc.data();

		// file uploaded to server filesystem
		await upload(req, res, async (err) => {
			if (err) {
				console.log(err);
			}

			// uploads image to the firebase storage
			await bucket.upload(`./assets/images/${name}`, {
				destination: `${id}/${uniqueName}`,
				metadata: {
					cacheControl: "public, max-age=315360000",
					contentType: "image/jpeg",
				},
				predefinedAcl: "publicRead",
			});
		});

		let file = bucket.file(`${id}/${uniqueName}`);

		// publicUrl will be "https://storage.googleapis.com/id/photo"
		const publicUrl = file.publicUrl();
		console.log(publicUrl);

		// updates the document with photoURL in the firestore collection
		docData.photoURL = publicUrl;
		await db.collection("inventory").doc(id).set(docData, { merge: true });

		const docRef = await db.collection("items").doc(docData.itemId).get();
		const docDataObj = await docRef.data();
		docDataObj.photoURL = publicUrl;
		await db
			.collection("items")
			.doc(docData.itemId)
			.set(docDataObj, { merge: true });

		res.sendStatus(200);
	} catch (err) {
		res.status(500).send(err.message);
	}
});

module.exports = router;
