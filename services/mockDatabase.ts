import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, getDocs, doc, setDoc, 
  query, where, addDoc, updateDoc, deleteDoc, getDoc
} from "firebase/firestore";
import { User, Exam, ExamAttempt, UserRole } from '../types';

// --- Firebase Configuration ---
// These will be loaded from your .env file
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

// CSV Data for Initial Seeding
export const USERS_CSV = `id,name,email,password,role
101,Anurag tripathi,student@test.com,123456,STUDENT
102,Abinash Choudhury,abinash@test.com,123456,STUDENT
103,Abhirup Mishra,abhirup@test.com,123456,STUDENT
201,Prof. Shwetha,shwetha@test.com,admin123,INSTRUCTOR
202,Dr. Sowmya,sowmya@test.com,admin123,INSTRUCTOR`;

class CloudDatabase {
  
  // Helper to remove undefined fields which Firestore hates
  private sanitize<T>(data: T): T {
    return JSON.parse(JSON.stringify(data));
  }

  // --- Auth & Users ---

  async login(email: string, password: string): Promise<User | null> {
    try {
      // Query the 'users' collection
      const q = query(collection(firestore, "users"), where("email", "==", email), where("password", "==", password));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0].data() as User;
        // Store session locally for persistence across refreshes
        localStorage.setItem('currentUser', JSON.stringify(userDoc));
        return userDoc;
      }
      return null;
    } catch (e) {
      console.error("Login Error", e);
      return null;
    }
  }

  getCurrentUser(): User | null {
    const u = localStorage.getItem('currentUser');
    return u ? JSON.parse(u) : null;
  }

  async getUser(userId: string): Promise<User | null> {
    try {
        const q = query(collection(firestore, "users"), where("id", "==", userId));
        const s = await getDocs(q);
        if (!s.empty) return s.docs[0].data() as User;
        return null;
    } catch(e) { 
        console.error("Get User Error", e);
        return null; 
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const querySnapshot = await getDocs(collection(firestore, "users"));
      return querySnapshot.docs.map(doc => doc.data() as User);
    } catch (e) {
      console.error("Get All Users Error", e);
      return [];
    }
  }

  async createUser(user: User & { password?: string }) {
    try {
      // Check if email already exists
      const q = query(collection(firestore, "users"), where("email", "==", user.email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        throw new Error("User with this email already exists");
      }
      // Check if ID already exists
      const docRef = doc(firestore, "users", user.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        throw new Error("User ID already exists");
      }

      // Add to Firestore using custom ID
      await setDoc(doc(firestore, "users", user.id), this.sanitize(user));
    } catch (e) {
      console.error("Create User Error", e);
      throw e;
    }
  }

  async updateUser(user: User) {
    try {
      // In a real app, we'd use the Doc ID, but here we query by our custom ID
      const q = query(collection(firestore, "users"), where("id", "==", user.id));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docRef = snapshot.docs[0].ref;
        await updateDoc(docRef, { name: user.name });
        localStorage.setItem('currentUser', JSON.stringify(user));
      }
    } catch (e) {
      console.error("Update User Error", e);
    }
  }

  /**
   * Updates a user's ID by creating a new document and deleting the old one.
   * Also updates all foreign key references in Exams and Attempts.
   * 
   * @param currentId The current ID of the user
   * @param newId The desired new ID
   * @param role The user's role (to determine which references to update)
   * @param overrides Optional partial user object to apply changes (e.g. new name) during migration
   */
  async updateUserId(currentId: string, newId: string, role: UserRole, overrides?: Partial<User>): Promise<User> {
    try {
      if (currentId === newId) {
        // If ID is same, but we have overrides (like name change), just update standard way
        if (overrides && Object.keys(overrides).length > 0) {
            const user = (await this.getUser(currentId))!;
            const updated = { ...user, ...overrides };
            await this.updateUser(updated);
            return updated;
        }
        return (await this.getUser(currentId))!;
      }

      // 1. STRICT Uniqueness Check
      // Since we use the ID as the Document Key, we check if that key exists
      const newDocRef = doc(firestore, "users", newId);
      const newDocSnap = await getDoc(newDocRef);
      
      if (newDocSnap.exists()) {
        // Double check it's not the same doc (edge case)
        if (newDocSnap.id !== currentId) {
            throw new Error(`The ID "${newId}" is already taken by another user. Please choose a unique ID.`);
        }
      }

      // 2. Get Old User Data
      const oldDocRef = doc(firestore, "users", currentId);
      const oldDocSnap = await getDoc(oldDocRef);
      if (!oldDocSnap.exists()) throw new Error("Current user profile not found in database.");
      
      const userData = oldDocSnap.data() as User;

      // 3. Create New User Document with updated ID and any overrides (like new name)
      const updatedUser = { 
          ...userData, 
          ...overrides, // Apply name changes here if any
          id: newId 
      };
      
      await setDoc(newDocRef, this.sanitize(updatedUser));

      // 4. Update References in other collections (Exams or Attempts)
      if (role === UserRole.INSTRUCTOR) {
        // Find exams owned by old ID
        const q = query(collection(firestore, "exams"), where("instructorId", "==", currentId));
        const snap = await getDocs(q);
        const updates = snap.docs.map(d => updateDoc(d.ref, { instructorId: newId }));
        await Promise.all(updates);
      } else if (role === UserRole.STUDENT) {
        // Find attempts by old ID
        const q = query(collection(firestore, "attempts"), where("studentId", "==", currentId));
        const snap = await getDocs(q);
        const updates = snap.docs.map(d => updateDoc(d.ref, { studentId: newId }));
        await Promise.all(updates);
      }

      // 5. Delete Old User Document
      await deleteDoc(oldDocRef);

      // 6. Update Local Storage
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));

      return updatedUser;

    } catch (e: any) {
      console.error("Update ID Error", e);
      throw new Error(e.message || "Failed to update User ID");
    }
  }

  async updatePassword(userId: string, newPassword: string) {
    try {
      const q = query(collection(firestore, "users"), where("id", "==", userId));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docRef = snapshot.docs[0].ref;
        await updateDoc(docRef, { password: newPassword });
      } else {
        throw new Error("User not found");
      }
    } catch (e) {
      console.error("Update Password Error", e);
      throw e;
    }
  }

  logout() {
    localStorage.removeItem('currentUser');
  }

  // --- Exams ---

  async getExams(): Promise<Exam[]> {
    try {
      const querySnapshot = await getDocs(collection(firestore, "exams"));
      return querySnapshot.docs.map(doc => doc.data() as Exam);
    } catch (e) {
      console.error("Get Exams Error", e);
      return [];
    }
  }

  async getExam(id: string): Promise<Exam | undefined> {
    // We can filter on client side for simplicity or query specific doc
    const exams = await this.getExams();
    return exams.find(e => e.id === id);
  }

  async createExam(exam: Exam) {
    try {
      // Use setDoc with the custom ID so it's easier to find
      // CRITICAL FIX: Sanitize data to remove 'undefined' fields
      await setDoc(doc(firestore, "exams", exam.id), this.sanitize(exam));
    } catch (e) {
      console.error("Create Exam Error", e);
      throw e;
    }
  }

  async toggleExamPublishStatus(id: string, isPublished: boolean) {
    try {
      const docRef = doc(firestore, "exams", id);
      await updateDoc(docRef, { isPublished });
    } catch (e) {
      console.error("Toggle Exam Status Error", e);
      throw e;
    }
  }

  async deleteExam(id: string) {
    try {
      // 1. Delete the Exam Document
      await deleteDoc(doc(firestore, "exams", id));

      // 2. Cascade Delete: Find all attempts associated with this exam
      const q = query(collection(firestore, "attempts"), where("examId", "==", id));
      const snapshot = await getDocs(q);

      // 3. Delete all found attempts concurrently
      const deletePromises = snapshot.docs.map(docSnapshot => deleteDoc(docSnapshot.ref));
      await Promise.all(deletePromises);
      
    } catch (e) {
      console.error("Delete Exam Error", e);
      throw e;
    }
  }

  // --- Attempts ---

  async getAttempts(studentId: string): Promise<ExamAttempt[]> {
    try {
      const q = query(collection(firestore, "attempts"), where("studentId", "==", studentId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as ExamAttempt);
    } catch (e) {
      console.error("Get Attempts Error", e);
      return [];
    }
  }

  async getAttemptsForExam(examId: string): Promise<ExamAttempt[]> {
    try {
      const q = query(collection(firestore, "attempts"), where("examId", "==", examId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as ExamAttempt);
    } catch (e) {
      console.error("Get Exam Attempts Error", e);
      return [];
    }
  }

  async getAttempt(id: string): Promise<ExamAttempt | undefined> {
    try {
       // We fetch all for now or query specific. 
       // For this simple structure, let's query by ID field if document ID matches
       const q = query(collection(firestore, "attempts"), where("id", "==", id));
       const s = await getDocs(q);
       if (!s.empty) return s.docs[0].data() as ExamAttempt;
    } catch (e) { 
        console.error(e); 
    }
    return undefined;
  }

  async saveAttempt(attempt: ExamAttempt) {
    try {
      // CRITICAL FIX: Sanitize data to remove 'undefined' fields
      await setDoc(doc(firestore, "attempts", attempt.id), this.sanitize(attempt));
    } catch (e) {
      console.error("Save Attempt Error", e);
    }
  }

  // --- Seed Data (One time setup) ---
  
  async seedInitialData() {
    // Check if users exist
    const snap = await getDocs(collection(firestore, "users"));
    if (snap.empty) {
      console.log("Seeding Database with CSV Users...");
      const lines = USERS_CSV.trim().split('\n');
      const users = lines.slice(1).map(line => {
        const [id, name, email, password, role] = line.split(',').map(s => s.trim());
        return { id, name, email, password, role: role as UserRole };
      });

      for (const u of users) {
        await addDoc(collection(firestore, "users"), u);
      }
      console.log("Seeding Complete!");
      alert("Database seeded with initial users!");
    }
  }
}

export const db = new CloudDatabase();

// Run seeder once on load (safe check)
db.seedInitialData();