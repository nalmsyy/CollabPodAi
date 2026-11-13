import type { Metadata } from "next";
import { LoginScreen } from "./login-screen";

export const metadata: Metadata = {
  title: "Masuk — CollabPod AI",
  description: "Masuk ke workspace CollabPod AI dengan akun Solid Pod Anda.",
};

export default function LoginPage() {
  return <LoginScreen />;
}

