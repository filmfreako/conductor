import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, onSnapshot, deleteDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBq9XvugqEb3IdNiur1IBDTQv7FqAZRiwA",
  authDomain: "flota-31b94.firebaseapp.com",
  projectId: "flota-31b94",
  storageBucket: "flota-31b94.firebasestorage.app",
  messagingSenderId: "171731116664",
  appId: "1:171731116664:web:453e90b393d830313f838d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const VEHICLE_ID = "camioneta1";

// ─── Live day collections (current working day) ───
export const expensesRef = () => collection(db, "vehicles", VEHICLE_ID, "expenses");
export const shiftsRef = () => collection(db, "vehicles", VEHICLE_ID, "shifts");
export const earningsRef = () => collection(db, "vehicles", VEHICLE_ID, "earnings");
export const tripsRef = () => collection(db, "vehicles", VEHICLE_ID, "trips");

// ─── Daily archive: one document per day with all data ───
export const archivesRef = () => collection(db, "vehicles", VEHICLE_ID, "dailyArchives");

// ─── Active day status ───
export const activeDayRef = () => doc(db, "vehicles", VEHICLE_ID, "meta", "activeDay");

export const getActiveDay = async () => {
  const snap = await getDoc(activeDayRef());
  return snap.exists() ? snap.data() : null;
};

export const setActiveDay = async (dateStr, startTime) => {
  if (dateStr === null) {
    await setDoc(activeDayRef(), { active: false });
  } else {
    await setDoc(activeDayRef(), { date: dateStr, startTime: startTime || "", startedAt: new Date().toISOString(), active: true });
  }
};

export const clearActiveDay = async () => {
  await setDoc(activeDayRef(), { active: false });
};

export const subscribeActiveDay = (callback) => {
  return onSnapshot(activeDayRef(), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
};

// ─── Archive current day: save all live data as one document, clear live ───
export const archiveDay = async (dateStr, liveData) => {
  await setDoc(doc(archivesRef(), dateStr), {
    date: dateStr,
    archivedAt: new Date().toISOString(),
    expenses: liveData.expenses,
    shifts: liveData.shifts,
    earnings: liveData.earnings,
    trips: liveData.trips,
  });

  const clearColl = async (ref) => {
    const snap = await getDocs(ref);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  };
  await clearColl(expensesRef());
  await clearColl(shiftsRef());
  await clearColl(earningsRef());
  await clearColl(tripsRef());
  await clearActiveDay();
};

// ─── Subscribe to archives (for weekly/historical view) ───
export const subscribeArchives = (callback) => {
  return onSnapshot(archivesRef(), (snapshot) => {
    const items = [];
    snapshot.forEach((d) => items.push({ id: d.id, ...d.data() }));
    callback(items);
  });
};

// ─── CRUD ───
export const addDocument = async (collectionRef, id, data) => {
  await setDoc(doc(collectionRef, id), { ...data, createdAt: new Date().toISOString() });
};

export const deleteDocument = async (collectionRef, id) => {
  await deleteDoc(doc(collectionRef, id));
};

export const subscribeToCollection = (collectionRef, callback) => {
  return onSnapshot(collectionRef, (snapshot) => {
    const items = [];
    snapshot.forEach((d) => items.push({ id: d.id, ...d.data() }));
    callback(items);
  });
};

export { db, VEHICLE_ID };
