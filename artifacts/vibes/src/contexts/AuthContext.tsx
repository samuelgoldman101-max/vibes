import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { ref, set, get } from "firebase/database";
import { auth, db } from "@/lib/firebase";

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  bio: string;
  avatarColor: string;
  createdAt: number;
  followersCount: number;
  followingCount: number;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AVATAR_COLORS = [
  "#e040fb", "#7c4dff", "#00bcd4", "#f06292", "#69f0ae",
  "#ffab40", "#ff5252", "#40c4ff", "#b2ff59", "#ea80fc"
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(uid: string) {
    try {
      const snap = await get(ref(db, `users/${uid}`));
      if (snap.exists()) {
        setUserProfile(snap.val() as UserProfile);
        return snap.val() as UserProfile;
      }
    } catch (e) {
      console.error("fetchProfile error", e);
    }
    return null;
  }

  async function signUp(email: string, password: string, username: string, displayName: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const profile: UserProfile = {
      uid: cred.user.uid,
      username: username.toLowerCase().trim(),
      displayName,
      bio: "",
      avatarColor: color,
      createdAt: Date.now(),
      followersCount: 0,
      followingCount: 0,
    };
    await set(ref(db, `users/${cred.user.uid}`), profile);
    await set(ref(db, `usernames/${username.toLowerCase().trim()}`), cred.user.uid);
    setUserProfile(profile);
  }

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logOut() {
    await signOut(auth);
    setUserProfile(null);
  }

  async function refreshProfile() {
    if (currentUser) await fetchProfile(currentUser.uid);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchProfile(user.uid);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, signUp, signIn, logOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
