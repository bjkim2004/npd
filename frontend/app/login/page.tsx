import AuthForm from "@/components/AuthForm";

export const metadata = { title: "로그인 · NPD 일정·이력 관리" };

export default function Page() {
  return <AuthForm mode="login" />;
}
