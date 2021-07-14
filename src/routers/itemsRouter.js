const express = require("express");
const router = new express.Router();
const { db, defaultStorage } = require("../db/initialiseFirebase");
const multer = require("multer");
const cuid = require("cuid");

// get request to get particular item
router.get("/item/:id", async (req, res) => {
	const id = req.params.id;

	try {
		const docRef = db.collection("items").doc(id).get();
		res.status(200).send(await (await docRef).data());
	} catch (err) {
		res.status(500).send(err.message);
	}
});

// get request to get all items from item collection
https: router.get("/items/all", async (req, res) => {
	try {
		const itemsRef = db.collection("items");
		const snapshot = await itemsRef.get();

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

// post request to add item in items collection in database
router.post("/add/item", async (req, res) => {
	try {
		const uniqueId = cuid();
		const docRef = db.collection("items").doc(uniqueId);

		const obj = req.body;
		obj.id = uniqueId;

		if (obj.inclusiveOfTax === true) {
			obj.price = obj.purchasePrice;
		} else {
			let purchasedPrice = obj.purchasePrice,
				gstTax = obj.gstTaxRatePercentage,
				totalVal = 0;

			totalVal = purchasedPrice + purchasedPrice * (gstTax / 100);
			obj.price = totalVal;
		}

		const savedDoc = await docRef.set(obj);
		res.sendStatus(200);
	} catch (err) {
		res.status(500).send(err.message);
	}
});

// post request to edit item in items collection in database
router.post("/edit/item/:id", async (req, res) => {
	const id = req.params.id;
	try {
		const docRef = await db.collection("items").doc(id).get();
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

		const savedDoc = await db
			.collection("items")
			.doc(id)
			.set(obj, { merge: true });

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

// add or edit the image for items
router.post("/edit/items/image/:id", async (req, res) => {
	const bucket = defaultStorage.bucket("books-tab.appspot.com");
	const id = req.params.id;
	try {
		const doc = await db.collection("items").doc(id).get();
		const docData = await doc.data();
		const uniqueName = cuid();

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

		// makes file public
		let file = bucket.file(`${id}/${uniqueName}`);
		// async function makePublic() {
		// 	await defaultStorage
		// 		.bucket("books-tab.appspot.com")
		// 		.file(id)
		// 		.makePublic();
		// }
		// makePublic().catch(console.error);

		// publicUrl will be "https://storage.googleapis.com/id"
		const publicUrl = file.publicUrl();
		console.log(publicUrl);

		// updates the document with photoURL in the firestore collection
		docData.photoURL = publicUrl;
		await db.collection("items").doc(id).set(docData, { merge: true });

		res.sendStatus(200);
	} catch (err) {
		res.status(500).send(err.message);
	}
});

module.exports = router;
