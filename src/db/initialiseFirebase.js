const admin = require("firebase-admin");

const serviceAccount = require("../../config/books-tab-firebase-adminsdk-vcyqy-464df693b5.json");

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
});

admin.firestore().settings({ ignoreUndefinedProperties: true });

const db = admin.firestore();
const defaultStorage = admin.storage();

module.exports = {
	db,
	defaultStorage,
};
