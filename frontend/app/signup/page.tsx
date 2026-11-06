import AuthForm from "@/components/AuthForm";

export const metadata = { title: "회원가입 · NPD 일정·이력 관리" };

export default function Page() {
  return <AuthForm mode="signup" />;
}
