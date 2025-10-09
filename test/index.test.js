const { FirebaseAuth } = require("../lib/firebaseAuth");
const { getAuth, connectAuthEmulator, } = require("@firebase/auth");
const { initializeApp } = require("@firebase/app");
const { getFirestore, connectFirestoreEmulator } = require("firebase/firestore");
const { FirestoreDatabase } = require("../lib/FirestoreDatabase");

const emulator_uri = "http://localhost:9099";
const projectId = "fakeproject";
const apiKey = "fakeApiKey";

const userInfo = {
    email: "test@gmail.com",
    password: "123456",
};

const app = initializeApp({ projectId, apiKey });

const auth = getAuth(app);
const db = getFirestore(app);

connectAuthEmulator(auth, emulator_uri);
connectFirestoreEmulator(db, "localhost", 8080);


const firebaseAuth = new FirebaseAuth(undefined, undefined, auth);
const firestoreDatabase = new FirestoreDatabase({ firebaseApp: app }, db);

(async function Test() {
    // await register();

    await login();
    console.log("Logged in successfully");

    await createData();
    
    await testCustomMethod();

    auth.currentUser.delete();
})();



async function register() {
    await firebaseAuth.handleRegister(userInfo);
}

async function login() {
    await firebaseAuth.handleLogIn(userInfo);
}

async function createData() {
    try {
        const data = await firestoreDatabase.createData({
            resource: "TEST",
            variables: {
                name: "test",
                age: 20,
                id: "test"
            }
        });

        console.log(data);
    } catch (error) {
        console.log(error);
    }
}

async function testCustomMethod() {
    try {
        console.log("Testing custom method with setDoc...");
        
        // Test 1: Create/update document with specific ID using custom method
        const result1 = await firestoreDatabase.custom({
            url: "TEST/custom-doc-1",
            method: "post",
            payload: {
                name: "Custom Test",
                age: 25,
                description: "Created via custom method"
            }
        });
        console.log("Custom setDoc result:", result1);

        // Test 2: Update document using merge with custom method
        const result2 = await firestoreDatabase.custom({
            url: "TEST/custom-doc-1",
            method: "patch",
            payload: {
                age: 30,
                updatedAt: new Date().toISOString()
            }
        });
        console.log("Custom patch result:", result2);

        // Test 3: Read document using custom method
        const result3 = await firestoreDatabase.custom({
            url: "TEST/custom-doc-1",
            method: "get"
        });
        console.log("Custom get result:", result3);

        console.log("Custom method tests passed!");
    } catch (error) {
        console.error("Custom method test error:", error);
    }
}

module.exports = { register, login, testCustomMethod };

